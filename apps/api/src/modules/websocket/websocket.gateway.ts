import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { prisma } from "@creator-hub/database";
import { STTEngineService } from "@creator-hub/stt-engine";
import { CreditService } from "@creator-hub/billing";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import {
  VoiceAllowanceService,
  VoiceSettingsService,
} from "@creator-hub/voice-settings";
import {
  FREE_VOICE_LIMIT_CODE,
  FREE_VOICE_LIMIT_MESSAGE,
  MAX_STT_SESSION_MS,
  MIN_CREDITS_FOR_STT,
  voiceSecondsAffordable,
  type STTProviderName,
} from "@creator-hub/shared-types";
import * as Sentry from "@sentry/nestjs";
import { CORS_ALLOWED_ORIGINS } from "../../common/cors";

@WebSocketGateway({
  cors: { origin: [...CORS_ALLOWED_ORIGINS], credentials: true },
  transports: ["websocket"],
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger("AppGateway");
  /**
   * Price of each socket's live STT session, locked at start, and the
   * timer that ends it when the balance runs out.
   */
  private billing = new Map<
    string,
    {
      rate: number;
      maxMs: number;
      timer: ReturnType<typeof setTimeout> | null;
      /** Robotina session of a limited Free user: its time is counted. */
      countFreeTime: boolean;
    }
  >();

  constructor(
    private jwtService: JwtService,
    private sttEngine: STTEngineService,
    private creditService: CreditService,
    private usageLogger: PlatformUsageLogger,
    private voiceSettings: VoiceSettingsService,
    private voiceAllowance: VoiceAllowanceService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace(
          "Bearer ",
          "",
        );

      const refreshToken = client.handshake.auth?.refreshToken as string;

      if (!token) {
        this.logger.warn("Connection rejected: no token provided");
        client.disconnect();
        return;
      }

      let payload: any;

      try {
        payload = await this.jwtService.verifyAsync(token);
      } catch (err: any) {
        // If access token expired, attempt to validate refresh token (if provided)
        if (err?.name === "TokenExpiredError" && refreshToken) {
          try {
            const refreshPayload =
              await this.jwtService.verifyAsync(refreshToken);

            // Issue a short-lived replacement access token and notify client
            const newAccess = this.jwtService.sign(
              {
                sub: refreshPayload.sub,
                email: refreshPayload.email,
                role: refreshPayload.role,
              },
              { expiresIn: "15m" },
            );

            client.emit("auth:refreshed", { accessToken: newAccess });
            payload = refreshPayload;
            this.logger.log("Access token refreshed via refreshToken", {
              socketId: client.id,
              userId: refreshPayload.sub,
            });
          } catch (err2: any) {
            this.logger.warn("Connection rejected: invalid refresh token", {
              error: err2?.message,
            });
            try {
              client.emit("auth_error", {
                code: "INVALID_REFRESH_TOKEN",
                message: err2?.message,
              });
            } catch {}
            client.disconnect();
            return;
          }
        } else {
          this.logger.warn("Connection rejected: invalid token", {
            error: err?.message,
          });
          try {
            client.emit("auth_error", {
              code: "INVALID_TOKEN",
              message: err?.message,
            });
          } catch {}
          client.disconnect();
          return;
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          currentCredits: true,
          purchasedCredits: true,
          plan: true,
        },
      });

      if (!user || !user.isActive) {
        this.logger.warn("Connection rejected: user not found or inactive");
        try {
          client.emit("auth_error", {
            code: "USER_INACTIVE",
            message: "User not found or inactive",
          });
        } catch {}
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.user = user;
      client.join(user.id);

      this.logger.log(`Client connected`, {
        userId: user.id,
        socketId: client.id,
      });
    } catch (error) {
      this.logger.warn("Connection rejected: unexpected error", {
        error: (error as Error).message,
      });
      try {
        client.emit("auth_error", {
          code: "UNEXPECTED_ERROR",
          message: (error as Error).message,
        });
      } catch {}
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    this.logger.log(`Client disconnected`, { userId, socketId: client.id });

    this.clearBilling(client.id);
    if (this.sttEngine.hasActiveSession(client.id)) {
      this.logger.log("Cleaning up STT session on disconnect", {
        userId,
        clientId: client.id,
      });
      await this.sttEngine.closeSession(client.id, "client-disconnected");
    }
  }

  @SubscribeMessage("stt:start")
  async handleSTTStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      language?: string;
      provider?: STTProviderName;
      requestId?: string;
      /** "voice-assistant": Robotina's ears (Free plan minutes apply). */
      purpose?: string;
    },
  ) {
    // Echoed in every stt:* event of this session (see STTSessionManager).
    const requestId =
      typeof data?.requestId === "string" && data.requestId.length <= 64
        ? data.requestId
        : undefined;
    const withId = (payload: Record<string, unknown>) =>
      requestId ? { ...payload, requestId } : payload;
    const userId = client.data?.userId;
    if (!userId) {
      client.emit(
        "stt:error",
        withId({ code: "UNAUTHORIZED", message: "Not authenticated" }),
      );
      return;
    }

    if (this.sttEngine.hasActiveSession(client.id)) {
      this.logger.warn("Cleaning up stale STT session before new start", {
        userId,
        clientId: client.id,
      });
      this.clearBilling(client.id);
      await this.sttEngine.closeSession(client.id, "replaced-by-new-session");
    }

    // Model and price per minute: Admin → Voice (STT & TTS).
    const settings = await this.voiceSettings.get();
    const rate = settings.stt.creditsPerMinute;
    const balance = await this.currentBalance(client, userId);
    const affordableMs = voiceSecondsAffordable(balance, rate) * 1000;
    if (balance < MIN_CREDITS_FOR_STT || affordableMs < 1000) {
      client.emit(
        "stt:error",
        withId({
          code: "INSUFFICIENT_CREDITS",
          message: `You need at least ${MIN_CREDITS_FOR_STT} credits to use voice recording`,
        }),
      );
      return;
    }

    // Robotina: the Free plan's minutes with her (Admin → Voice).
    const forAssistant = data?.purpose === "voice-assistant";
    const allowance = forAssistant
      ? await this.voiceAllowance.get(userId)
      : null;
    if (allowance?.exhausted) {
      client.emit(
        "stt:error",
        withId({
          code: FREE_VOICE_LIMIT_CODE,
          message: FREE_VOICE_LIMIT_MESSAGE,
        }),
      );
      return;
    }
    const freeMs =
      allowance?.remainingSeconds != null
        ? allowance.remainingSeconds * 1000
        : Infinity;

    try {
      const session = this.sttEngine.startSession(
        userId,
        client,
        data?.provider,
        data?.language,
        requestId,
        settings.stt.model,
      );

      // The balance (or the Free plan's minutes left) pays for fewer
      // seconds than the 3-minute limit: the recording ends (and is billed)
      // when they run out.
      const limitMs = Math.min(affordableMs, freeMs);
      const limitedBy = freeMs < affordableMs ? "free-limit" : "credit-limit";
      const maxMs = Math.min(limitMs, MAX_STT_SESSION_MS);
      const timer =
        limitMs < MAX_STT_SESSION_MS
          ? setTimeout(() => {
              this.logger.log(`STT session reached the ${limitedBy}`, {
                userId,
                clientId: client.id,
                maxMs,
              });
              void this.finishSession(client, requestId, limitedBy);
            }, limitMs)
          : null;
      timer?.unref?.();
      this.billing.set(client.id, {
        rate,
        maxMs,
        timer,
        countFreeTime: !!allowance?.limited,
      });

      client.emit(
        "stt:started",
        withId({ sessionId: session.sessionId, language: session.language }),
      );

      this.logger.log("STT session started via gateway", {
        userId,
        sessionId: session.sessionId,
        clientId: client.id,
        model: settings.stt.model,
        creditsPerMinute: rate,
        maxMs,
      });

      // Breadcrumb: STT session started
      Sentry.addBreadcrumb({
        type: "default",
        category: "stt.session",
        message: `STT session started for user ${userId}`,
        level: "info",
        data: {
          userId,
          sessionId: session.sessionId,
          clientId: client.id,
          language: session.language,
          provider: data?.provider,
          model: settings.stt.model,
        },
      });
    } catch (error) {
      client.emit(
        "stt:error",
        withId({
          code: "START_FAILED",
          message: (error as Error).message || "Failed to start recording",
        }),
      );

      // Breadcrumb: STT session failed to start
      Sentry.addBreadcrumb({
        type: "default",
        category: "stt.session",
        message: `STT session failed to start for user ${userId}`,
        level: "error",
        data: {
          userId,
          clientId: client.id,
          error: (error as Error).message,
        },
      });
    }
  }

  @SubscribeMessage("stt:chunk")
  handleSTTChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() chunk: ArrayBuffer,
  ) {
    if (!this.sttEngine.hasActiveSession(client.id)) return;
    this.sttEngine.writeAudioChunk(client.id, Buffer.from(chunk));
  }

  @SubscribeMessage("stt:end")
  async handleSTTEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { requestId?: string },
  ) {
    const requestId =
      typeof data?.requestId === "string" ? data.requestId : undefined;
    await this.finishSession(client, requestId);
  }

  /**
   * Ends the socket's session gracefully — the user stopped, or the balance
   * ran out (`endedBy: "credit-limit"`) — then bills the seconds recorded
   * and sends the transcript.
   */
  private async finishSession(
    client: Socket,
    requestId?: string,
    endedBy?: "credit-limit" | "free-limit",
  ) {
    const userId = client.data?.userId;
    const billing = this.billing.get(client.id);
    this.clearBilling(client.id);
    if (!this.sttEngine.hasActiveSession(client.id)) {
      // Already gone (provider closed it, the socket reconnected…): say so
      // instead of leaving the client waiting for a result.
      this.logger.warn("stt:end without an active session", {
        userId,
        clientId: client.id,
        requestId,
      });
      client.emit("stt:error", {
        code: "SESSION_LOST",
        message: "The voice session was lost",
        ...(requestId ? { requestId } : {}),
      });
      return;
    }

    const result = await this.sttEngine.endSession(client.id);

    if (result) {
      // Price locked when the session started; never beyond what the
      // balance paid for (the credit-limit timer fires a few ms late).
      const rate =
        billing?.rate ?? (await this.voiceSettings.get()).stt.creditsPerMinute;
      const billedMs = Math.min(
        result.durationMs,
        billing?.maxMs ?? MAX_STT_SESSION_MS,
      );
      const credits = this.sttEngine.calculateCredits(billedMs, rate);

      // Breadcrumb: STT session ended
      Sentry.addBreadcrumb({
        type: "default",
        category: "stt.session",
        message: `STT session ended for user ${userId}`,
        level: "info",
        data: {
          userId,
          clientId: client.id,
          durationMs: result.durationMs,
          wordCount: result.wordCount,
          credits,
          endedBy,
        },
      });

      if (userId && credits > 0) {
        try {
          const deducted = await this.creditService.deduct(
            userId,
            credits,
            "speech-to-text",
            `STT session (${result.wordCount} words, ${(billedMs / 1000).toFixed(1)}s)`,
          );

          if (deducted) {
            const balance = await this.creditService.getBalance(userId);
            this.server.to(userId).emit("credits.deducted", {
              currentCredits: balance,
              purchasedCredits: 0,
              totalCredits: balance,
            });
          }
        } catch (error) {
          this.logger.error("Failed to deduct STT credits", {
            userId,
            credits,
            error: (error as Error).message,
          });

          Sentry.addBreadcrumb({
            type: "default",
            category: "billing.credit",
            message: `Failed to deduct ${credits} credits for STT session`,
            level: "error",
            data: {
              userId,
              credits,
              error: (error as Error).message,
            },
          });
        }
      }

      // Time with Robotina counts towards the Free plan's minutes.
      if (userId && billing?.countFreeTime) {
        await this.voiceAllowance.record(userId, billedMs);
      }

      client.emit("stt:result", {
        fullTranscript: result.fullTranscript,
        durationMs: result.durationMs,
        wordCount: result.wordCount,
        credits,
        ...(endedBy ? { endedBy } : {}),
        ...(result.requestId ? { requestId: result.requestId } : {}),
      });

      this.logger.log("STT session ended", {
        userId,
        clientId: client.id,
        durationMs: result.durationMs,
        wordCount: result.wordCount,
        credits,
        creditsPerMinute: rate,
        endedBy: endedBy ?? "client",
      });

      // Platform usage log
      await this.usageLogger.logUsage({
        userId,
        toolId: "speech-to-text",
        duration: result.durationMs,
        success: true,
        credits,
        metadata: {
          wordCount: result.wordCount,
          provider: "deepgram",
          endedBy,
        },
      });
    } else {
      client.emit("stt:error", {
        code: "SESSION_LOST",
        message: "The voice session was lost",
        ...(requestId ? { requestId } : {}),
      });
    }
  }

  /** Fresh balance (the one cached on the socket is from connect time). */
  private async currentBalance(client: Socket, userId: string) {
    try {
      return await this.creditService.getBalance(userId);
    } catch {
      return Number(client.data?.user?.currentCredits ?? 0);
    }
  }

  private clearBilling(clientId: string) {
    const billing = this.billing.get(clientId);
    if (billing?.timer) clearTimeout(billing.timer);
    this.billing.delete(clientId);
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(userId).emit(event, data);
  }
}

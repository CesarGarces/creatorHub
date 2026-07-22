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
  MIN_CREDITS_FOR_STT,
  type STTProviderName,
} from "@creator-hub/shared-types";
import * as Sentry from "@sentry/nestjs";

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

@WebSocketGateway({
  cors: { origin: allowedOrigins, credentials: true },
  transports: ["websocket"],
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger("AppGateway");

  constructor(
    private jwtService: JwtService,
    private sttEngine: STTEngineService,
    private creditService: CreditService,
    private usageLogger: PlatformUsageLogger,
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

    if (this.sttEngine.hasActiveSession(client.id)) {
      this.logger.log("Cleaning up STT session on disconnect", {
        userId,
        clientId: client.id,
      });
      await this.sttEngine.closeSession(client.id);
    }
  }

  @SubscribeMessage("stt:start")
  async handleSTTStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { language?: string; provider?: STTProviderName },
  ) {
    const userId = client.data?.userId;
    if (!userId) {
      client.emit("stt:error", {
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
      return;
    }

    if (this.sttEngine.hasActiveSession(client.id)) {
      this.logger.warn("Cleaning up stale STT session before new start", {
        userId,
        clientId: client.id,
      });
      await this.sttEngine.closeSession(client.id);
    }

    const user = client.data?.user;
    if (user) {
      const totalCredits = user.currentCredits || 0;
      if (totalCredits < MIN_CREDITS_FOR_STT) {
        client.emit("stt:error", {
          code: "INSUFFICIENT_CREDITS",
          message: `You need at least ${MIN_CREDITS_FOR_STT} credits to use voice recording`,
        });
        return;
      }
    }

    try {
      const session = this.sttEngine.startSession(
        userId,
        client,
        data?.provider,
        data?.language,
      );

      client.emit("stt:started", {
        sessionId: session.sessionId,
        language: session.language,
      });

      this.logger.log("STT session started via gateway", {
        userId,
        sessionId: session.sessionId,
        clientId: client.id,
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
        },
      });
    } catch (error) {
      client.emit("stt:error", {
        code: "START_FAILED",
        message: (error as Error).message || "Failed to start recording",
      });

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
  async handleSTTEnd(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (!this.sttEngine.hasActiveSession(client.id)) {
      return;
    }

    const result = await this.sttEngine.endSession(client.id);

    if (result) {
      const credits = this.sttEngine.calculateCredits(result.durationMs);

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
        },
      });

      if (userId && credits > 0) {
        try {
          const deducted = await this.creditService.deduct(
            userId,
            credits,
            "speech-to-text",
            `STT session (${result.wordCount} words, ${(result.durationMs / 1000).toFixed(1)}s)`,
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

      client.emit("stt:result", {
        fullTranscript: result.fullTranscript,
        durationMs: result.durationMs,
        wordCount: result.wordCount,
        credits,
      });

      this.logger.log("STT session ended", {
        userId,
        clientId: client.id,
        durationMs: result.durationMs,
        wordCount: result.wordCount,
        credits,
      });

      // Platform usage log
      await this.usageLogger.logUsage({
        userId,
        toolId: "speech-to-text",
        duration: result.durationMs,
        success: true,
        credits,
        metadata: { wordCount: result.wordCount, provider: "deepgram" },
      });
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(userId).emit(event, data);
  }
}

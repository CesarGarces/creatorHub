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
import {
  MIN_CREDITS_FOR_STT,
  type STTProviderName,
} from "@creator-hub/shared-types";

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
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace(
          "Bearer ",
          "",
        );

      if (!token) {
        this.logger.warn("Connection rejected: no token provided");
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          freeCredits: true,
          purchasedCredits: true,
          plan: true,
        },
      });

      if (!user || !user.isActive) {
        this.logger.warn("Connection rejected: user not found or inactive");
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
      this.logger.warn("Connection rejected: invalid token", {
        error: (error as Error).message,
      });
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
      client.emit("stt:error", {
        code: "SESSION_EXISTS",
        message: "A recording session is already active",
      });
      return;
    }

    const user = client.data?.user;
    if (user) {
      const totalCredits =
        (user.freeCredits || 0) + (user.purchasedCredits || 0);
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
    } catch (error) {
      client.emit("stt:error", {
        code: "START_FAILED",
        message: (error as Error).message || "Failed to start recording",
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

      if (userId) {
        try {
          const { CreditService } = await import("@creator-hub/billing");
          // Credit deduction will be handled by the caller
        } catch {
          // billing module may not be injectable here
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
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(userId).emit(event, data);
  }
}

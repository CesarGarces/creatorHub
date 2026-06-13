import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { prisma } from "@creator-hub/database";

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

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn("Connection rejected: no token provided");
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        this.logger.warn("Connection rejected: user not found or inactive");
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.join(user.id);

      this.logger.log(`Client connected`, { userId: user.id, socketId: client.id });
    } catch (error) {
      this.logger.warn("Connection rejected: invalid token", {
        error: (error as Error).message,
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    this.logger.log(`Client disconnected`, { userId, socketId: client.id });
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(userId).emit(event, data);
  }
}

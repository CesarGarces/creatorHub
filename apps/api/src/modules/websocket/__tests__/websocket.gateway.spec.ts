import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the prisma client module before importing the gateway to avoid DB init
vi.mock("@creator-hub/database", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@creator-hub/database";
import { AppGateway } from "../websocket.gateway";

describe("AppGateway - WebSocket Auth & Refresh Token Unit Tests", () => {
  let gateway: AppGateway;
  let mockJwtService: any;
  let mockSttEngine: any;
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwtService = {
      verifyAsync: vi.fn(),
      sign: vi.fn(() => "signed_access_token"),
    };

    mockSttEngine = {
      hasActiveSession: vi.fn().mockReturnValue(false),
      closeSession: vi.fn(),
    };

    gateway = new AppGateway(mockJwtService as any, mockSttEngine as any);

    mockSocket = {
      id: "mock_socket_123",
      handshake: { auth: {}, headers: {} },
      data: {},
      join: vi.fn().mockResolvedValue(undefined),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    // mock prisma user lookup
    (prisma.user as any).findUnique = vi.fn().mockResolvedValue({
      id: "usr_creator_99",
      email: "c@example.com",
      role: "USER",
      isActive: true,
      currentCredits: 0,
      purchasedCredits: 0,
      plan: "FREE",
    });
  });

  it("permite la conexión si el Access Token es válido", async () => {
    mockSocket.handshake.auth = { token: "valid_access_token" };
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: "usr_creator_99",
      email: "c@example.com",
      role: "USER",
    });

    await gateway.handleConnection(mockSocket as any);

    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
      "valid_access_token",
    );
    expect(mockSocket.join).toHaveBeenCalledWith("usr_creator_99");
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });

  it("emite auth:refreshed y permite conexión si el Access Token expiró pero el Refresh Token es válido", async () => {
    mockSocket.handshake.auth = {
      token: "expired_access_token",
      refreshToken: "valid_refresh_token",
    };

    const expiredErr = new Error("jwt expired");
    expiredErr.name = "TokenExpiredError";

    mockJwtService.verifyAsync
      .mockRejectedValueOnce(expiredErr)
      .mockResolvedValueOnce({
        sub: "usr_creator_99",
        email: "c@example.com",
        role: "USER",
      });

    mockJwtService.sign = vi.fn(() => "new_access_token_from_refresh");

    await gateway.handleConnection(mockSocket as any);

    expect(mockJwtService.verifyAsync).toHaveBeenCalledTimes(2);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "auth:refreshed",
      expect.objectContaining({ accessToken: "new_access_token_from_refresh" }),
    );
    expect(mockSocket.join).toHaveBeenCalledWith("usr_creator_99");
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });

  it("desconecta y emite auth_error si ambos tokens son inválidos", async () => {
    mockSocket.handshake.auth = { token: "bad", refreshToken: "bad" };

    mockJwtService.verifyAsync.mockRejectedValue(
      new Error("invalid signature"),
    );

    await gateway.handleConnection(mockSocket as any);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "auth_error",
      expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
      }),
    );
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.join).not.toHaveBeenCalled();
  });
});

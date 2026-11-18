import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the prisma client module before importing the gateway to avoid DB init
vi.mock("@creator-hub/database", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@creator-hub/database";
import { DEFAULT_VOICE_SETTINGS } from "@creator-hub/shared-types";
import { AppGateway } from "../websocket.gateway";

/** Free plan minutes with Robotina (default: unlimited). */
function allowanceOf(remainingSeconds: number | null = null) {
  return {
    get: vi.fn(async () => ({
      limited: remainingSeconds !== null,
      period: "monthly",
      limitSeconds: remainingSeconds === null ? null : 600,
      usedSeconds: 0,
      remainingSeconds,
      exhausted: remainingSeconds === 0,
      resetsAt: null,
    })),
    record: vi.fn(async () => undefined),
  };
}

/** Admin → Voice settings: model and price per second of voice input. */
function voiceSettings(stt: Partial<typeof DEFAULT_VOICE_SETTINGS.stt> = {}) {
  return {
    get: vi.fn(async () => ({
      ...DEFAULT_VOICE_SETTINGS,
      stt: { ...DEFAULT_VOICE_SETTINGS.stt, ...stt },
    })),
  };
}

describe("AppGateway - WebSocket Auth & Refresh Token Unit Tests", () => {
  let gateway: AppGateway;
  let mockJwtService: any;
  let mockSttEngine: any;
  let mockCreditService: any;
  let mockUsageLogger: any;
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

    mockCreditService = {
      deduct: vi.fn().mockResolvedValue(true),
      getBalance: vi.fn().mockResolvedValue(0),
    };

    mockUsageLogger = {
      logUsage: vi.fn().mockResolvedValue(undefined),
    };

    gateway = new AppGateway(
      mockJwtService as any,
      mockSttEngine as any,
      mockCreditService as any,
      mockUsageLogger as any,
      voiceSettings() as any,
      allowanceOf() as any,
    );

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

describe("AppGateway — STT session lifecycle", () => {
  function setup({
    balance = 40,
    stt: sttSettings = {},
    freeSecondsLeft = null,
  }: {
    balance?: number;
    stt?: Partial<typeof DEFAULT_VOICE_SETTINGS.stt>;
    /** Free plan seconds left with Robotina (null: unlimited). */
    freeSecondsLeft?: number | null;
  } = {}) {
    const allowance = allowanceOf(freeSecondsLeft);
    const stt = {
      hasActiveSession: vi.fn().mockReturnValue(false),
      closeSession: vi.fn(),
      startSession: vi.fn(() => ({ sessionId: "s1", language: "es" })),
      endSession: vi.fn(),
      calculateCredits: vi.fn((ms: number, rate: number) =>
        ms > 0 && rate > 0 ? Math.ceil(Math.ceil(ms / 1000) * rate) : 0,
      ),
    };
    const credits = {
      deduct: vi.fn().mockResolvedValue(true),
      getBalance: vi.fn().mockResolvedValue(balance),
    };
    const gateway = new AppGateway(
      {} as any,
      stt as any,
      credits as any,
      { logUsage: vi.fn().mockResolvedValue(undefined) } as any,
      voiceSettings(sttSettings) as any,
      allowance as any,
    );
    (gateway as any).server = { to: () => ({ emit: vi.fn() }) };
    const socket: any = {
      id: "sock-1",
      data: { userId: "u1", user: { currentCredits: 50 } },
      emit: vi.fn(),
    };
    return { gateway, stt, socket, credits, allowance };
  }

  it("passes the client's requestId to the session and echoes it", async () => {
    const { gateway, stt, socket } = setup();
    await gateway.handleSTTStart(socket, {
      language: "es",
      requestId: "req-1",
    });
    expect(stt.startSession).toHaveBeenCalledWith(
      "u1",
      socket,
      undefined,
      "es",
      "req-1",
      "nova-3",
    );
    expect(socket.emit).toHaveBeenCalledWith("stt:started", {
      sessionId: "s1",
      language: "es",
      requestId: "req-1",
    });
  });

  it("echoes the requestId on refusals (not enough credits)", async () => {
    const { gateway, socket } = setup({ balance: 1 });
    await gateway.handleSTTStart(socket, { requestId: "req-2" });
    expect(socket.emit).toHaveBeenCalledWith(
      "stt:error",
      expect.objectContaining({
        code: "INSUFFICIENT_CREDITS",
        requestId: "req-2",
      }),
    );
  });

  it("replacing a session and disconnecting are logged with their reason", async () => {
    const { gateway, stt, socket } = setup();
    stt.hasActiveSession.mockReturnValue(true);
    await gateway.handleSTTStart(socket, {});
    expect(stt.closeSession).toHaveBeenCalledWith(
      "sock-1",
      "replaced-by-new-session",
    );
    await gateway.handleDisconnect(socket);
    expect(stt.closeSession).toHaveBeenCalledWith(
      "sock-1",
      "client-disconnected",
    );
  });

  it("answers stt:end for a lost session instead of leaving the client waiting", async () => {
    const { gateway, socket } = setup();
    await gateway.handleSTTEnd(socket, { requestId: "req-3" });
    expect(socket.emit).toHaveBeenCalledWith("stt:error", {
      code: "SESSION_LOST",
      message: "The voice session was lost",
      requestId: "req-3",
    });
  });

  it("sends the final result with its requestId, and SESSION_LOST if finishing failed", async () => {
    const { gateway, stt, socket } = setup();
    stt.hasActiveSession.mockReturnValue(true);
    stt.endSession.mockResolvedValueOnce({
      fullTranscript: "hola qué planes tengo",
      durationMs: 4000,
      wordCount: 4,
      language: "es",
      requestId: "req-4",
    });
    await gateway.handleSTTEnd(socket, { requestId: "req-4" });
    expect(socket.emit).toHaveBeenCalledWith("stt:result", {
      fullTranscript: "hola qué planes tengo",
      durationMs: 4000,
      wordCount: 4,
      credits: 4, // 4 s × 1 credit per second
      requestId: "req-4",
    });

    stt.endSession.mockResolvedValueOnce(null);
    await gateway.handleSTTEnd(socket, { requestId: "req-5" });
    expect(socket.emit).toHaveBeenLastCalledWith("stt:error", {
      code: "SESSION_LOST",
      message: "The voice session was lost",
      requestId: "req-5",
    });
  });

  it("uses the model and price per second set in Admin → Voice", async () => {
    const { gateway, stt, socket, credits } = setup({
      stt: { model: "nova-2", creditsPerSecond: 2 },
    });
    await gateway.handleSTTStart(socket, { language: "es", requestId: "r" });
    expect(stt.startSession).toHaveBeenCalledWith(
      "u1",
      socket,
      undefined,
      "es",
      "r",
      "nova-2",
    );
    stt.hasActiveSession.mockReturnValue(true);
    stt.endSession.mockResolvedValueOnce({
      fullTranscript: "hola",
      durationMs: 2300,
      wordCount: 1,
      language: "es",
      requestId: "r",
    });
    await gateway.handleSTTEnd(socket, { requestId: "r" });
    expect(stt.calculateCredits).toHaveBeenCalledWith(2300, 2);
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      6, // 3 started seconds × 2
      "speech-to-text",
      expect.stringContaining("2.3s"),
    );
  });

  it("refuses to start when the balance can't pay a second", async () => {
    const { gateway, stt, socket } = setup({
      balance: 6,
      stt: { creditsPerSecond: 10 },
    });
    await gateway.handleSTTStart(socket, { requestId: "r" });
    expect(stt.startSession).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      "stt:error",
      expect.objectContaining({ code: "INSUFFICIENT_CREDITS" }),
    );
  });

  it("ends the recording when the balance runs out, billing only what it paid for", async () => {
    vi.useFakeTimers();
    try {
      const { gateway, stt, socket, credits } = setup({
        balance: 10,
        stt: { creditsPerSecond: 2 },
      });
      await gateway.handleSTTStart(socket, { requestId: "r" });
      stt.hasActiveSession.mockReturnValue(true);
      stt.endSession.mockResolvedValueOnce({
        fullTranscript: "todo lo que dije",
        durationMs: 5040, // the timer fires a little late
        wordCount: 4,
        language: "es",
        requestId: "r",
      });
      await vi.advanceTimersByTimeAsync(4999);
      expect(stt.endSession).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1); // 10 credits / 2 per second = 5 s
      expect(stt.endSession).toHaveBeenCalledWith("sock-1");
      expect(credits.deduct).toHaveBeenCalledWith(
        "u1",
        10,
        "speech-to-text",
        expect.any(String),
      );
      expect(socket.emit).toHaveBeenCalledWith("stt:result", {
        fullTranscript: "todo lo que dije",
        durationMs: 5040,
        wordCount: 4,
        credits: 10,
        endedBy: "credit-limit",
        requestId: "r",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a stop before the limit cancels the credit timer", async () => {
    vi.useFakeTimers();
    try {
      const { gateway, stt, socket } = setup({
        balance: 10,
        stt: { creditsPerSecond: 2 },
      });
      await gateway.handleSTTStart(socket, { requestId: "r" });
      stt.hasActiveSession.mockReturnValue(true);
      stt.endSession.mockResolvedValue({
        fullTranscript: "hola",
        durationMs: 1000,
        wordCount: 1,
        language: "es",
      });
      await gateway.handleSTTEnd(socket, { requestId: "r" });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(stt.endSession).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses Robotina's ears when the Free plan's minutes are used up", async () => {
    const { gateway, stt, socket, allowance } = setup({ freeSecondsLeft: 0 });
    await gateway.handleSTTStart(socket, {
      requestId: "r",
      purpose: "voice-assistant",
    });
    expect(allowance.get).toHaveBeenCalledWith("u1");
    expect(stt.startSession).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith("stt:error", {
      code: "FREE_LIMIT_REACHED",
      message: expect.stringContaining("free minutes"),
      requestId: "r",
    });
  });

  it("other voice buttons ignore the Free plan's Robotina minutes", async () => {
    const { gateway, stt, socket, allowance } = setup({ freeSecondsLeft: 0 });
    await gateway.handleSTTStart(socket, { requestId: "r" });
    expect(allowance.get).not.toHaveBeenCalled();
    expect(stt.startSession).toHaveBeenCalled();
  });

  it("ends Robotina's recording when the free minutes run out, and counts the time", async () => {
    vi.useFakeTimers();
    try {
      const { gateway, stt, socket, allowance } = setup({
        balance: 1000,
        freeSecondsLeft: 4,
      });
      await gateway.handleSTTStart(socket, {
        requestId: "r",
        purpose: "voice-assistant",
      });
      stt.hasActiveSession.mockReturnValue(true);
      stt.endSession.mockResolvedValueOnce({
        fullTranscript: "hasta aquí",
        durationMs: 4020,
        wordCount: 2,
        language: "es",
        requestId: "r",
      });
      await vi.advanceTimersByTimeAsync(4000);
      expect(stt.endSession).toHaveBeenCalled();
      expect(allowance.record).toHaveBeenCalledWith("u1", 4000);
      expect(socket.emit).toHaveBeenCalledWith(
        "stt:result",
        expect.objectContaining({ endedBy: "free-limit", credits: 4 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("doesn't count the time of unlimited users", async () => {
    const { gateway, stt, socket, allowance } = setup();
    await gateway.handleSTTStart(socket, {
      requestId: "r",
      purpose: "voice-assistant",
    });
    stt.hasActiveSession.mockReturnValue(true);
    stt.endSession.mockResolvedValueOnce({
      fullTranscript: "hola",
      durationMs: 2000,
      wordCount: 1,
      language: "es",
      requestId: "r",
    });
    await gateway.handleSTTEnd(socket, { requestId: "r" });
    expect(allowance.record).not.toHaveBeenCalled();
  });
});

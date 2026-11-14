import { describe, it, expect, beforeEach, vi } from "vitest";
import { CreditEmailListenerService } from "../credit-email-listener.service";

describe("CreditEmailListenerService", () => {
  let subscriber: {
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let creditEmailService: { handleStateReached: ReturnType<typeof vi.fn> };
  let listener: CreditEmailListenerService;

  beforeEach(() => {
    subscriber = {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    creditEmailService = {
      handleStateReached: vi.fn().mockResolvedValue("sent"),
    };
    listener = new CreditEmailListenerService(
      subscriber as any,
      creditEmailService as any,
    );
  });

  it("subscribes to credit.state_reached on init", async () => {
    await listener.onModuleInit();
    expect(subscriber.subscribe).toHaveBeenCalledWith(
      "credit.state_reached",
      expect.any(Function),
    );
  });

  it("forwards valid events to CreditEmailService", async () => {
    await listener.onModuleInit();
    const handler = subscriber.subscribe.mock.calls[0]![1];
    const event = {
      userId: "u1",
      state: "CREDIT_THRESHOLD_50",
      creditsRemaining: 50,
    };

    await handler(event);
    expect(creditEmailService.handleStateReached).toHaveBeenCalledWith(event);
  });

  it("ignores malformed events", async () => {
    await listener.handleStateReached({
      userId: "u1",
      state: "NOT_A_STATE",
    } as any);
    await listener.handleStateReached(undefined as any);
    expect(creditEmailService.handleStateReached).not.toHaveBeenCalled();
  });

  it("never lets an error escape (the Redis subscriber does not await handlers)", async () => {
    creditEmailService.handleStateReached.mockRejectedValue(
      new Error("db down"),
    );
    await expect(
      listener.handleStateReached({
        userId: "u1",
        state: "CREDIT_DEPLETED",
      } as any),
    ).resolves.toBeUndefined();
  });
});

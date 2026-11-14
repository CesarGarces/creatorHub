import { MarketingEventHandler } from "../marketing-event.handler";
import { prisma } from "@creator-hub/database";

vi.mock("@creator-hub/database", () => ({
  prisma: {
    marketingEvent: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

describe("MarketingEventHandler", () => {
  let handler: MarketingEventHandler;
  let publisher: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.marketingEvent.create as any).mockResolvedValue({ id: "me-1" });
    (prisma.notification.create as any).mockResolvedValue({});
    publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    handler = new MarketingEventHandler(publisher as any);
  });

  it("records CREDIT_THRESHOLD_50 and publishes credit.state_reached", async () => {
    await handler.handleCreditThreshold({
      userId: "user-1",
      threshold: 50,
      creditsRemaining: 49,
      previousCredits: 52,
      timestamp: new Date(),
    });

    expect(prisma.marketingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "CREDIT_THRESHOLD_50",
        credits: 49,
        metadata: expect.objectContaining({ previousCredits: 52 }),
      }),
    });
    expect(publisher.publish).toHaveBeenCalledWith("credit.state_reached", {
      userId: "user-1",
      state: "CREDIT_THRESHOLD_50",
      creditsRemaining: 49,
      previousCredits: 52,
      marketingEventId: "me-1",
      timestamp: expect.any(Date),
    });
  });

  it("records CREDIT_DEPLETED, notifies the user and publishes the state", async () => {
    await handler.handleCreditDepleted({
      userId: "user-1",
      creditsRemaining: 0,
      previousCredits: 10,
      timestamp: new Date(),
    });

    expect(prisma.marketingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CREDIT_DEPLETED", credits: 0 }),
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledWith(
      "credit.state_reached",
      expect.objectContaining({
        state: "CREDIT_DEPLETED",
        creditsRemaining: 0,
        previousCredits: 10,
      }),
    );
  });

  it("publishes null balances for a rejected debit (insufficient credits)", async () => {
    await handler.handleCreditDepleted({
      userId: "user-1",
      timestamp: new Date(),
    });

    expect(publisher.publish).toHaveBeenCalledWith(
      "credit.state_reached",
      expect.objectContaining({
        state: "CREDIT_DEPLETED",
        creditsRemaining: null,
        previousCredits: null,
      }),
    );
  });

  it("does not throw when Redis publishing fails", async () => {
    publisher.publish.mockRejectedValue(new Error("redis down"));

    await expect(
      handler.handleCreditThreshold({
        userId: "user-1",
        threshold: 50,
        creditsRemaining: 50,
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();
    expect(prisma.marketingEvent.create).toHaveBeenCalled();
  });
});

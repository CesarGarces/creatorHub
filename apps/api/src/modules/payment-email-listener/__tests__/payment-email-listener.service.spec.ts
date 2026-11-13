import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { createEventSubscriberMock } from "../../../__tests__/helpers/event-subscriber-mock";
import { PaymentEmailListenerService } from "../payment-email-listener.service";

describe("PaymentEmailListenerService", () => {
  const emailService = {
    sendPurchaseSuccessEmail: vi.fn(),
    sendPurchaseFailedEmail: vi.fn(),
  };
  let subscriber: ReturnType<typeof createEventSubscriberMock>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetPrismaMock();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    subscriber = createEventSubscriberMock();
    const service = new PaymentEmailListenerService(
      subscriber as never,
      emailService as never,
    );
    await service.onModuleInit();
  });

  const success = {
    userId: "u1",
    gatewayTxId: "mp-1",
    amount: 1000,
    balance: 1100,
    gateway: "MERCADO_PAGO",
    timestamp: new Date(),
  };
  const failed = {
    userId: "u1",
    gatewayTxId: "mp-2",
    reason: "cc_rejected_insufficient_amount: card 4509 declined",
    timestamp: new Date(),
  };

  it("subscribes to payment success and failure", () => {
    expect([...subscriber.handlers.keys()]).toEqual([
      "payment:success",
      "payment:failed",
    ]);
  });

  it("sends a purchase confirmation with credits and new balance", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: "ana@x.com",
      name: "Ana",
    });

    await subscriber.publish("payment:success", success);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { email: true, name: true },
    });
    expect(emailService.sendPurchaseSuccessEmail).toHaveBeenCalledWith(
      "ana@x.com",
      {
        userName: "Ana",
        credits: 1000,
        balance: 1100,
        activeTools: expect.arrayContaining([
          "Thumbnail Generator",
          "Video Generator",
        ]),
      },
    );
  });

  it("skips the email when the user has no address", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await subscriber.publish("payment:success", success);
    await subscriber.publish("payment:failed", failed);

    expect(emailService.sendPurchaseSuccessEmail).not.toHaveBeenCalled();
    expect(emailService.sendPurchaseFailedEmail).not.toHaveBeenCalled();
  });

  it("never lets an email failure crash the event subscriber", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: "ana@x.com",
      name: null,
    });
    emailService.sendPurchaseSuccessEmail.mockRejectedValue(
      new Error("SMTP down"),
    );
    emailService.sendPurchaseFailedEmail.mockRejectedValue(
      new Error("SMTP down"),
    );

    await expect(
      subscriber.publish("payment:success", success),
    ).resolves.toBeUndefined();
    await expect(
      subscriber.publish("payment:failed", failed),
    ).resolves.toBeUndefined();
  });

  it("sends a failure email with a generic reason, not the raw gateway reason", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: "ana@x.com",
      name: null,
    });

    await subscriber.publish("payment:failed", failed);

    const [to, payload] = emailService.sendPurchaseFailedEmail.mock.calls[0]!;
    expect(to).toBe("ana@x.com");
    expect(payload).toEqual({
      userName: undefined,
      reason:
        "There was an issue processing your payment. Please review your payment details and try again.",
      retryUrl: "https://app.creatorhubplatform.com/credits",
    });
    expect(JSON.stringify(payload)).not.toContain("4509");
  });

  it("unsubscribes from both channels on shutdown", async () => {
    const service = new PaymentEmailListenerService(
      subscriber as never,
      emailService as never,
    );
    await service.onModuleDestroy();

    expect(subscriber.unsubscribe.mock.calls.map((c) => c[0])).toEqual([
      "payment:success",
      "payment:failed",
    ]);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma, Prisma } from "@creator-hub/database";
import { EmailService } from "@creator-hub/email";
import { CreditEmailService } from "../credit-email.service";

vi.mock("@creator-hub/database", async () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(
      message: string,
      public opts: { code: string },
    ) {
      super(message);
    }
    get code() {
      return this.opts.code;
    }
  }
  return {
    Prisma: { PrismaClientKnownRequestError },
    prisma: {
      creditEmailTrigger: { findMany: vi.fn(), findUnique: vi.fn() },
      creditEmailLog: {
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      creditTransaction: { findFirst: vi.fn() },
      user: { findUnique: vi.fn() },
    },
  };
});

const trigger50 = {
  id: "trg-50",
  state: "CREDIT_THRESHOLD_50",
  subject: "You have {{credits}} credits left",
  heading: "Running low",
  body: "Hi {{name}},\n\nOnly {{credits}} credits left (threshold {{threshold}}).",
  ctaLabel: "Buy credits",
  ctaUrl: "{{purchaseUrl}}",
  isActive: true,
};
const triggerDepleted = {
  ...trigger50,
  id: "trg-0",
  state: "CREDIT_DEPLETED",
  subject: "You're out of credits",
  ctaLabel: "Purchase credits",
};

const event = (overrides: Record<string, unknown> = {}) => ({
  userId: "user-1",
  state: "CREDIT_THRESHOLD_50" as const,
  creditsRemaining: 49,
  previousCredits: 52,
  marketingEventId: "me-1",
  timestamp: new Date(),
  ...overrides,
});

const p2002 = () =>
  new (Prisma as any).PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
  });

describe("CreditEmailService", () => {
  let service: CreditEmailService;
  let provider: { send: ReturnType<typeof vi.fn> };
  const sentMail = (index = 0) =>
    provider.send.mock.calls[index]![0] as {
      to: string;
      subject: string;
      html: string;
    };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FRONTEND_URL;
    provider = {
      send: vi.fn().mockResolvedValue({ id: "email-1", success: true }),
    };
    // Real EmailService + real Handlebars template, fake delivery provider.
    service = new CreditEmailService(new EmailService(provider as any));

    (prisma.creditEmailTrigger.findMany as any).mockResolvedValue([
      trigger50,
      triggerDepleted,
    ]);
    (prisma.user.findUnique as any).mockResolvedValue({
      email: "ana@example.com",
      name: "Ana",
      isActive: true,
      currentCredits: 49,
    });
    (prisma.creditTransaction.findFirst as any).mockResolvedValue({
      id: "tx-purchase-1",
    });
    (prisma.creditEmailLog.create as any).mockImplementation(
      async ({ data }: any) => ({
        id: "log-1",
        ...data,
      }),
    );
    (prisma.creditEmailLog.update as any).mockResolvedValue({});
  });

  it("sends the 50-credit email with variables filled in and logs it as SENT", async () => {
    expect(await service.handleStateReached(event())).toBe("sent");

    const sent = sentMail();
    expect(sent.to).toBe("ana@example.com");
    expect(sent.subject).toBe("You have 49 credits left");
    expect(sent.html).toContain("Hi Ana,");
    expect(sent.html).toContain("Only 49 credits left (threshold 50).");
    expect(sent.html).toContain(
      'href="https://app.creatorhubplatform.com/credits"',
    );
    expect(sent.html).toContain("Buy credits");

    expect(prisma.creditEmailLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        triggerId: "trg-50",
        state: "CREDIT_THRESHOLD_50",
        credits: 49,
        status: "PENDING",
        dedupeKey: "user-1:CREDIT_THRESHOLD_50:tx-purchase-1",
      }),
    });
    expect(prisma.creditEmailLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: {
        status: "SENT",
        subject: "You have 49 credits left",
        error: null,
      },
    });
  });

  it("sends the purchase email when credits reach 0", async () => {
    const outcome = await service.handleStateReached(
      event({
        state: "CREDIT_DEPLETED",
        creditsRemaining: 0,
        previousCredits: 10,
      }),
    );

    expect(outcome).toBe("sent");
    const sent = sentMail();
    expect(sent.subject).toBe("You're out of credits");
    expect(sent.html).toContain("Purchase credits");
  });

  it("uses the current balance for a rejected debit (no balances in the event)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      email: "ana@example.com",
      name: null,
      isActive: true,
      currentCredits: 3,
    });

    await service.handleStateReached(
      event({
        state: "CREDIT_DEPLETED",
        creditsRemaining: null,
        previousCredits: null,
      }),
    );

    const sent = sentMail();
    expect(sent.html).toContain("Hi ana@example.com,"); // falls back to email
    expect(prisma.creditEmailLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ state: "CREDIT_DEPLETED", credits: 3 }),
    });
  });

  it("falls back to the most severe crossed state that has an active email", async () => {
    // 60 → 20 enters CREDIT_THRESHOLD_25, which has no email; 50 was crossed too.
    await service.handleStateReached(
      event({
        state: "CREDIT_THRESHOLD_25",
        creditsRemaining: 20,
        previousCredits: 60,
      }),
    );

    expect(prisma.creditEmailTrigger.findMany).toHaveBeenCalledWith({
      where: {
        state: { in: ["CREDIT_THRESHOLD_25", "CREDIT_THRESHOLD_50"] },
        isActive: true,
      },
    });
    expect(sentMail().subject).toBe("You have 20 credits left");
  });

  it("does nothing when the state has no active email", async () => {
    (prisma.creditEmailTrigger.findMany as any).mockResolvedValue([]);

    expect(await service.handleStateReached(event())).toBe("no-trigger");
    expect(provider.send).not.toHaveBeenCalled();
    expect(prisma.creditEmailLog.create).not.toHaveBeenCalled();
  });

  it("skips inactive users", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      email: "ana@example.com",
      name: "Ana",
      isActive: false,
      currentCredits: 49,
    });

    expect(await service.handleStateReached(event())).toBe("user-not-eligible");
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("sends at most once per state per credit cycle (unique dedupeKey)", async () => {
    (prisma.creditEmailLog.create as any).mockRejectedValue(p2002());
    (prisma.creditEmailLog.updateMany as any).mockResolvedValue({ count: 0 });

    expect(await service.handleStateReached(event())).toBe("already-sent");
    expect(provider.send).not.toHaveBeenCalled();
    expect(prisma.creditEmailLog.updateMany).toHaveBeenCalledWith({
      where: {
        dedupeKey: "user-1:CREDIT_THRESHOLD_50:tx-purchase-1",
        status: "FAILED",
      },
      data: expect.objectContaining({ status: "PENDING" }),
    });
  });

  it("retries an email whose previous attempt FAILED", async () => {
    (prisma.creditEmailLog.create as any).mockRejectedValue(p2002());
    (prisma.creditEmailLog.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.creditEmailLog.findUnique as any).mockResolvedValue({
      id: "log-old",
    });

    expect(await service.handleStateReached(event())).toBe("sent");
    expect(prisma.creditEmailLog.update).toHaveBeenCalledWith({
      where: { id: "log-old" },
      data: expect.objectContaining({ status: "SENT" }),
    });
  });

  it("uses 'initial' as the cycle before the user ever received credits", async () => {
    (prisma.creditTransaction.findFirst as any).mockResolvedValue(null);

    await service.handleStateReached(event());
    expect(prisma.creditEmailLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: "user-1:CREDIT_THRESHOLD_50:initial",
      }),
    });
  });

  it("logs FAILED when the provider fails", async () => {
    provider.send.mockResolvedValue({
      id: "",
      success: false,
      error: "Resend down",
    });

    expect(await service.handleStateReached(event())).toBe("failed");
    expect(prisma.creditEmailLog.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: expect.objectContaining({ status: "FAILED", error: "Resend down" }),
    });
  });

  it("escapes HTML and drops unsafe button links", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      email: "x@example.com",
      name: "<script>alert(1)</script>",
      isActive: true,
      currentCredits: 49,
    });
    (prisma.creditEmailTrigger.findMany as any).mockResolvedValue([
      {
        ...trigger50,
        body: "Hi {{name}} {{constructor}}",
        ctaUrl: "javascript:alert(1)",
      },
    ]);

    await service.handleStateReached(event());
    const { html } = sentMail();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("{{constructor}}"); // unknown placeholders are left as text
    expect(html).not.toContain("javascript:");
  });

  it("uses FRONTEND_URL for {{purchaseUrl}} when it is a valid URL", async () => {
    process.env.FRONTEND_URL = "https://creator.example.com/";
    await service.handleStateReached(event());
    expect(sentMail().html).toContain(
      'href="https://creator.example.com/credits"',
    );
  });

  it("renders a preview with sample values", () => {
    const preview = service.preview(trigger50, "CREDIT_THRESHOLD_50");
    expect(preview.subject).toBe("You have 50 credits left");
    expect(preview.html).toContain("Hi Jane Doe,");
  });
});

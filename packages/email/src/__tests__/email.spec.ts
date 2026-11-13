import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { renderTemplate } from "../templates/template.helper";
import { EmailService } from "../email.service";
import { EmailModule } from "../email.module";
import { EmailProvider } from "../email-provider.interface";
import { ResendProvider } from "../providers/resend/resend.provider";

beforeEach(() => {
  vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
  vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("templates", () => {
  it("renders the verification code and greets the user by name", () => {
    const html = renderTemplate("verification", {
      code: "482913",
      userName: "Ana",
    });

    expect(html).toContain("482913");
    expect(html).toContain("Ana");
  });

  it("falls back to a generic greeting without a name", () => {
    const withName = renderTemplate("verification", {
      code: "1",
      userName: "Ana",
    });
    const withoutName = renderTemplate("verification", { code: "1" });

    expect(withoutName).not.toContain("Ana");
    expect(withoutName).not.toEqual(withName);
  });

  it("HTML-escapes user-controlled values", () => {
    const html = renderTemplate("password-reset", {
      resetUrl: "https://app.example.com/reset?token=abc",
      userName: '<script>alert("x")</script>',
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes the reset link", () => {
    const html = renderTemplate("password-reset", {
      resetUrl: "https://app.example.com/auth/reset-password?token=t0k3n",
    });
    expect(html).toContain(
      "https://app.example.com/auth/reset-password?token&#x3D;t0k3n",
    );
  });

  it("lists the active tools and balance in the purchase receipt", () => {
    const html = renderTemplate("purchase-success", {
      credits: 1000,
      balance: 1100,
      activeTools: ["Thumbnail Generator", "Video Generator"],
    });

    expect(html).toContain("1000");
    expect(html).toContain("1100");
    expect(html).toContain("Thumbnail Generator");
    expect(html).toContain("Video Generator");
  });

  it("renders the failure reason and retry link", () => {
    const html = renderTemplate("purchase-failed", {
      reason: "Card declined",
      retryUrl: "https://app.example.com/credits",
    });

    expect(html).toContain("Card declined");
    expect(html).toContain("https://app.example.com/credits");
  });

  it("renders consistently from the template cache", () => {
    const first = renderTemplate("verification", { code: "111111" });
    const second = renderTemplate("verification", { code: "111111" });
    expect(second).toBe(first);
  });

  it("throws for unknown templates", () => {
    expect(() => renderTemplate("does-not-exist", {})).toThrow(/ENOENT/);
  });
});

describe("EmailService", () => {
  const provider = { send: vi.fn() };
  const service = new EmailService(provider as never);

  beforeEach(() =>
    provider.send.mockReset().mockResolvedValue({ id: "em_1", success: true }),
  );

  it.each([
    [
      "sendVerificationEmail",
      { code: "123456" },
      "Verify your email — Creator Hub",
      "123456",
    ],
    [
      "sendPasswordResetEmail",
      { resetUrl: "https://app/reset" },
      "Reset your password — Creator Hub",
      "https://app/reset",
    ],
    [
      "sendPurchaseSuccessEmail",
      { credits: 2500 },
      "Thank you for your purchase — Creator Hub",
      "2500",
    ],
    [
      "sendPurchaseFailedEmail",
      { reason: "Insufficient funds" },
      "Payment could not be processed — Creator Hub",
      "Insufficient funds",
    ],
  ] as const)(
    "%s sends the rendered email",
    async (method, data, subject, snippet) => {
      const result = await (
        service[method] as (to: string, d: unknown) => Promise<unknown>
      )("ana@x.com", data);

      const sent = provider.send.mock.calls[0]![0];
      expect(sent.to).toBe("ana@x.com");
      expect(sent.subject).toBe(subject);
      expect(sent.html).toContain(snippet);
      expect(result).toEqual({ success: true, error: undefined });
    },
  );

  it("reports provider failures to the caller", async () => {
    provider.send.mockResolvedValue({
      id: "",
      success: false,
      error: "rate limited",
    });

    const result = await service.sendVerificationEmail("ana@x.com", {
      code: "1",
    });

    expect(result).toEqual({ success: false, error: "rate limited" });
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});

describe("ResendProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends through the Resend API with the configured sender", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "re_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new ResendProvider({
      apiKey: "re_test_key",
      fromEmail: "hi@creatorhub.com",
    });

    const result = await provider.send({
      to: "ana@x.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ id: "re_123", success: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer re_test_key",
    );
    expect(JSON.parse(init.body)).toMatchObject({
      from: "hi@creatorhub.com",
      to: ["ana@x.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
  });

  it("converts unexpected client exceptions into a failed result", async () => {
    const provider = new ResendProvider({ apiKey: "k", fromEmail: "f@x.com" });
    vi.spyOn(
      (provider as unknown as { client: { emails: { send: () => unknown } } })
        .client.emails,
      "send",
    ).mockRejectedValue(new Error("boom"));

    expect(
      await provider.send({ to: "a@x.com", subject: "s", html: "h" }),
    ).toEqual({
      id: "",
      success: false,
      error: "boom",
    });
  });
});

describe("EmailModule", () => {
  type Factory = {
    provide: unknown;
    useFactory: (config: ConfigService) => unknown;
  };
  const factory = (
    Reflect.getMetadata("providers", EmailModule) as Factory[]
  ).find((p) => p.provide === EmailProvider)!;

  it("refuses to start without a Resend API key", () => {
    const config = new ConfigService({});
    expect(() => factory.useFactory(config)).toThrow(
      "RESEND_API_KEY is required",
    );
  });

  it("builds a Resend provider with a default sender address", () => {
    const provider = factory.useFactory(
      new ConfigService({ RESEND_API_KEY: "re_key" }),
    );

    expect(provider).toBeInstanceOf(ResendProvider);
    expect((provider as unknown as { fromEmail: string }).fromEmail).toBe(
      "noreply@creatorhub.com",
    );
  });
});

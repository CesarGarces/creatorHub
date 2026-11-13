import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Logger,
  calculateCredits,
  capitalize,
  formatCredits,
  generateCorrelationId,
  generateId,
  getFriendlyError,
  redactSensitiveHeaders,
  retry,
  sleep,
  slugify,
  timeout,
  truncate,
} from "../index";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("id utils", () => {
  it("generates 24-char URL-safe ids, optionally prefixed", () => {
    expect(generateId()).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(generateId("usr")).toMatch(/^usr_[A-Za-z0-9_-]{24}$/);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });

  it("generates correlation ids", () => {
    expect(generateCorrelationId()).toMatch(/^corr_[A-Za-z0-9_-]{16}$/);
  });
});

describe("credit utils", () => {
  it.each([
    [10, 1, 0, 10],
    [10, 1.5, 0, 15],
    [10, 1, 0.2, 8],
    [7, 1.3, 0.5, 4], // gross 9 → discount round(4.5)=5 → 4
    [1, 1, 0.9, 1], // never below 1 credit
    [0, 1, 0, 1],
  ])(
    "calculateCredits(%d, %d, %d) = %d",
    (base, multiplier, discount, expected) => {
      expect(calculateCredits(base, multiplier, discount)).toBe(expected);
    },
  );

  it("formats credits with thousands separators", () => {
    expect(formatCredits(1234567)).toBe("1,234,567");
    expect(formatCredits(0)).toBe("0");
  });
});

describe("string utils", () => {
  it("slugifies text", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Thumbnail  Generator!!")).toBe("thumbnail-generator");
    expect(slugify("a -- b")).toBe("a-b");
  });

  it("truncates long text with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("exactly10!", 10)).toBe("exactly10!");
    expect(truncate("this is a long sentence", 10)).toBe("this is...");
    expect(truncate("this is a long sentence", 10)).toHaveLength(10);
  });

  it("capitalizes the first letter only", () => {
    expect(capitalize("hello world")).toBe("Hello world");
    expect(capitalize("")).toBe("");
  });

  it("redacts sensitive headers case-insensitively without mutating the input", () => {
    const headers = {
      Authorization: "Bearer secret",
      cookie: "session=abc",
      "X-API-Key": "k",
      "x-auth-token": "t",
      "Content-Type": "application/json",
    };

    expect(redactSensitiveHeaders(headers)).toEqual({
      Authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      "X-API-Key": "[REDACTED]",
      "x-auth-token": "[REDACTED]",
      "Content-Type": "application/json",
    });
    expect(headers.Authorization).toBe("Bearer secret");
  });
});

describe("async utils", () => {
  it("sleep resolves after the given delay", async () => {
    vi.useFakeTimers();
    let done = false;
    const p = sleep(1000).then(() => (done = true));

    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it("retry returns the first successful result", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("flaky"))
      .mockResolvedValue("ok");

    await expect(retry(fn, { baseDelay: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retry backs off exponentially and rethrows the last error", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockRejectedValueOnce(new Error("e2"))
      .mockRejectedValueOnce(new Error("e3"));

    const result = retry(fn, { maxRetries: 3, baseDelay: 100 });
    const assertion = expect(result).rejects.toThrow("e3");

    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // 100ms
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // +200ms
    expect(fn).toHaveBeenCalledTimes(3);
    await assertion;
  });

  it("timeout passes through results that arrive in time", async () => {
    await expect(timeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it("timeout rejects slow promises", async () => {
    vi.useFakeTimers();
    const slow = new Promise(() => {});
    const result = timeout(slow, 500);
    const assertion = expect(result).rejects.toThrow("Timed out after 500ms");

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});

describe("getFriendlyError", () => {
  it.each([
    ["429 Too Many Requests", /AI is taking a break/],
    ["RESOURCE_EXHAUSTED: quota", /AI is taking a break/],
    ["Request timed out after 60s", /took too long/],
    ["Error 20021: sensitive content detected", /content filter/],
    ["flagged by content_moderation", /content filter/],
    ["socket hang up", /^Something went wrong/],
  ])("maps %j to a friendly message", (raw, expected) => {
    expect(getFriendlyError(raw)).toMatch(expected);
  });

  it("never exposes the raw provider error", () => {
    const raw = "OpenRouter 401: invalid key sk-live-123";
    expect(getFriendlyError(raw)).not.toContain("sk-live-123");
  });
});

describe("Logger", () => {
  it("writes structured JSON lines with level and context", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    new Logger("Billing").info("charged", { userId: "u1", amount: 5 });

    const entry = JSON.parse(log.mock.calls[0]![0] as string);
    expect(entry).toMatchObject({
      level: "INFO",
      context: "Billing",
      message: "charged",
      userId: "u1",
      amount: 5,
    });
    expect(new Date(entry.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("routes errors to console.error and everything else to console.log", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = new Logger("X");

    logger.warn("w");
    logger.debug("d");
    logger.error("e");

    expect(log).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(error.mock.calls[0]![0] as string).level).toBe("ERROR");
  });
});

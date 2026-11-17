import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, HttpException } from "@nestjs/common";

const sentry = vi.hoisted(() => {
  const scope = {
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setFingerprint: vi.fn(),
    setLevel: vi.fn(),
  };
  return {
    scope,
    withScope: vi.fn((cb: (s: typeof scope) => void) => cb(scope)),
    captureException: vi.fn(),
    setUser: vi.fn(),
  };
});
vi.mock("@sentry/nestjs", () => sentry);

import { SentryExceptionFilter } from "../sentry-exception.filter";

function host(body: unknown, url = "/api/v1/tools/video-clipper/analyses") {
  const response = { status: vi.fn(() => response), json: vi.fn() };
  const request = { method: "POST", url, body, params: {}, query: {} };
  return {
    response,
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as never,
  };
}

function capturedBody(): unknown {
  const call = sentry.scope.setExtra.mock.calls.find(
    ([key]) => key === "http.request.body",
  );
  return call?.[1];
}

beforeEach(() => vi.clearAllMocks());

describe("SentryExceptionFilter", () => {
  const filter = new SentryExceptionFilter();
  vi.spyOn(
    (filter as unknown as { logger: { error: () => void } }).logger,
    "error",
  ).mockImplementation(() => {});

  it("does not report requests the client abandoned (499), but still answers", () => {
    const { host: h, response } = host({});
    filter.catch(new HttpException("Analysis cancelled", 499), h);
    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(499);
  });

  it("reports 400s with the body sanitized at every depth", () => {
    const keyframe = `data:image/jpeg;base64,${"A".repeat(400_000)}`;
    const { host: h, response } = host({
      model: "google/gemini-2.5-flash",
      password: "hunter2",
      video: { fileName: "vlog.mp4", durationSec: 120, token: "t" },
      frames: Array.from({ length: 32 }, (_, i) => ({
        timestamp: i,
        image: keyframe,
      })),
      deep: { a: { b: { c: { d: "too deep" } } } },
    });

    filter.catch(new BadRequestException("Invalid"), h);

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(400);
    const body = capturedBody() as Record<string, unknown>;
    expect(body.model).toBe("google/gemini-2.5-flash");
    expect(body.password).toBe("[Filtered]");
    expect(body.video).toEqual({
      fileName: "vlog.mp4",
      durationSec: 120,
      token: "[Filtered]",
    });
    const frames = body.frames as unknown[];
    expect(frames).toHaveLength(11); // 10 + "...[22 more]"
    expect(frames.at(-1)).toBe("...[22 more]");
    const first = frames[0] as { timestamp: number; image: string };
    expect(first.timestamp).toBe(0);
    expect(first.image).toHaveLength(200 + "...[truncated]".length);
    expect(JSON.stringify(body).length).toBeLessThan(5_000);
    expect(body.deep).toEqual({ a: { b: { c: "[Truncated]" } } });
  });

  it("keeps short top-level values as they are", () => {
    const { host: h } = host({
      topic: "Pasta",
      count: 3,
      flag: true,
      none: null,
    });
    filter.catch(new BadRequestException("Invalid"), h);
    expect(capturedBody()).toEqual({
      topic: "Pasta",
      count: 3,
      flag: true,
      none: null,
    });
  });
});

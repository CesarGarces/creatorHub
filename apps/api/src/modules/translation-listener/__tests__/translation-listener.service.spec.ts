import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { createEventSubscriberMock } from "../../../__tests__/helpers/event-subscriber-mock";
import { TranslationListenerService } from "../translation-listener.service";

describe("TranslationListenerService", () => {
  const gateway = { emitToUser: vi.fn() };
  let subscriber: ReturnType<typeof createEventSubscriberMock>;
  let service: TranslationListenerService;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    subscriber = createEventSubscriberMock();
    service = new TranslationListenerService(
      subscriber as never,
      gateway as never,
    );
    await service.onModuleInit();
  });

  it("subscribes to translation completed and failed events", () => {
    expect([...subscriber.handlers.keys()]).toEqual([
      "translation:completed",
      "translation:failed",
    ]);
  });

  it("pushes the translated content to the requesting user", async () => {
    await subscriber.publish("translation:completed", {
      userId: "u1",
      translationId: "tr-1",
      content: "Hola mundo",
    });

    expect(gateway.emitToUser).toHaveBeenCalledWith("u1", "tool_job_updated", {
      toolId: "content-translator",
      jobId: "tr-1",
      status: "completed",
      payload: { content: "Hola mundo", translationId: "tr-1" },
    });
  });

  it("sends the user-facing error but never the raw provider error", async () => {
    await subscriber.publish("translation:failed", {
      userId: "u1",
      jobId: "job-9",
      error: "Translation failed, please retry",
      rawError: "OpenRouter 401: invalid key sk-live-abc",
    });

    expect(gateway.emitToUser).toHaveBeenCalledWith("u1", "tool_job_updated", {
      toolId: "content-translator",
      jobId: "job-9",
      status: "failed",
      payload: { error: "Translation failed, please retry" },
    });
    expect(JSON.stringify(gateway.emitToUser.mock.calls)).not.toContain(
      "sk-live-abc",
    );
  });

  it("uses an empty job id when the failure has none", async () => {
    await subscriber.publish("translation:failed", {
      userId: "u1",
      error: "x",
    });

    expect(gateway.emitToUser.mock.calls[0]![2].jobId).toBe("");
  });

  it("unsubscribes on shutdown", async () => {
    await service.onModuleDestroy();

    expect(subscriber.handlers.size).toBe(0);
  });
});

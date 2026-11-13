import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { createEventSubscriberMock } from "../../../__tests__/helpers/event-subscriber-mock";
import { VideoListenerService } from "../video-listener.service";

describe("VideoListenerService", () => {
  const storage = { getPresignedDownloadUrl: vi.fn() };
  const gateway = { emitToUser: vi.fn() };
  let subscriber: ReturnType<typeof createEventSubscriberMock>;
  let service: VideoListenerService;

  const completed = {
    userId: "u1",
    videoId: "vid-1",
    bucket: "videos",
    key: "u1/vid-1.mp4",
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    subscriber = createEventSubscriberMock();
    service = new VideoListenerService(
      subscriber as never,
      storage as never,
      gateway as never,
    );
    await service.onModuleInit();
  });

  it("subscribes to video completed and failed events", () => {
    expect([...subscriber.handlers.keys()]).toEqual([
      "video:completed",
      "video:failed",
    ]);
  });

  it("sends the user a 15-minute presigned download URL when a video is ready", async () => {
    storage.getPresignedDownloadUrl.mockResolvedValue(
      "https://signed/vid-1.mp4",
    );

    await subscriber.publish("video:completed", completed);

    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      "videos",
      "u1/vid-1.mp4",
      900,
    );
    expect(gateway.emitToUser).toHaveBeenCalledWith("u1", "tool_job_updated", {
      toolId: "video-generator",
      jobId: "vid-1",
      status: "completed",
      payload: { url: "https://signed/vid-1.mp4", videoId: "vid-1" },
    });
  });

  it("notifies the user of a failure when the URL cannot be generated", async () => {
    storage.getPresignedDownloadUrl.mockRejectedValue(
      new Error("access denied"),
    );

    await expect(
      subscriber.publish("video:completed", completed),
    ).resolves.toBeUndefined();

    expect(gateway.emitToUser).toHaveBeenCalledTimes(1);
    const [userId, event, payload] = gateway.emitToUser.mock.calls[0]!;
    expect(userId).toBe("u1");
    expect(event).toBe("tool_job_updated");
    expect(payload).toMatchObject({
      toolId: "video-generator",
      status: "failed",
      payload: { error: "Failed to generate download URL" },
    });
  });

  it("forwards generation failures without the raw provider error", async () => {
    await subscriber.publish("video:failed", {
      userId: "u1",
      jobId: "job-3",
      error: "Video generation failed",
      rawError: "SiliconFlow 500: internal trace id=abc",
    });

    expect(gateway.emitToUser).toHaveBeenCalledWith("u1", "tool_job_updated", {
      toolId: "video-generator",
      jobId: "job-3",
      status: "failed",
      payload: { error: "Video generation failed" },
    });
    expect(JSON.stringify(gateway.emitToUser.mock.calls)).not.toContain(
      "trace id",
    );
  });

  it("unsubscribes on shutdown", async () => {
    await service.onModuleDestroy();

    expect(subscriber.unsubscribe.mock.calls.map((c) => c[0])).toEqual([
      "video:completed",
      "video:failed",
    ]);
  });
});

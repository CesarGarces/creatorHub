import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  default: { delete: vi.fn() },
}));

import api, { ApiError } from "@/lib/api";
import {
  discardAnalysisOnLeave,
  flushPendingDeletions,
  readPendingDeletions,
} from "../pending-deletions";

const del = vi.mocked(api.delete);
const KEY = "creator_hub.video_clipper.pending_deletions";
const flushPromises = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("discardAnalysisOnLeave", () => {
  it("remembers the analysis and deletes it with a keepalive request", async () => {
    del.mockResolvedValue(undefined);
    discardAnalysisOnLeave("va1");

    // Written synchronously: survives the page unloading right now.
    expect(readPendingDeletions()).toEqual(["va1"]);
    expect(del).toHaveBeenCalledWith("/tools/video-clipper/analyses/va1", {
      keepalive: true,
    });
    await flushPromises();
    expect(readPendingDeletions()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("treats an already-deleted analysis (404) as done", async () => {
    del.mockRejectedValue(new ApiError(404, "Analysis not found"));
    discardAnalysisOnLeave("va1");
    await flushPromises();
    expect(readPendingDeletions()).toEqual([]);
  });

  it("keeps it pending when the request can't finish (page gone, offline…)", async () => {
    del.mockRejectedValue(new TypeError("Failed to fetch"));
    discardAnalysisOnLeave("va1");
    discardAnalysisOnLeave("va1"); // no duplicates
    await flushPromises();
    expect(readPendingDeletions()).toEqual(["va1"]);
  });
});

describe("flushPendingDeletions", () => {
  it("deletes what is pending; failures stay for the next visit", async () => {
    localStorage.setItem(KEY, JSON.stringify(["va1", "va2", "va3"]));
    del.mockImplementation(async (path: string) => {
      if (path.endsWith("va2")) throw new ApiError(404, "Analysis not found");
      if (path.endsWith("va3")) throw new ApiError(500, "Boom");
      return undefined;
    });

    await expect(flushPendingDeletions()).resolves.toEqual(["va1", "va2"]);
    expect(del).toHaveBeenCalledTimes(3);
    expect(readPendingDeletions()).toEqual(["va3"]);
  });

  it("does nothing without pending deletions, and ignores corrupted storage", async () => {
    await expect(flushPendingDeletions()).resolves.toEqual([]);
    localStorage.setItem(KEY, "{not json");
    await expect(flushPendingDeletions()).resolves.toEqual([]);
    expect(del).not.toHaveBeenCalled();
  });
});

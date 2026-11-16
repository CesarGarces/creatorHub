import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { AiPlannerController } from "../ai-planner/ai-planner.controller";
import {
  PlanningAbortedError,
  type AnalyzeInput,
} from "../ai-planner/ai-planner.service";
import { upload } from "./helpers/files";

function fakeResponse() {
  const chunks: string[] = [];
  let onClose: (() => void) | undefined;
  const res = {
    headers: {} as Record<string, string>,
    writableEnded: false,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    flushHeaders: vi.fn(),
    write: (chunk: string) => chunks.push(chunk),
    end() {
      this.writableEnded = true;
    },
    on: (_event: "close", listener: () => void) => (onClose = listener),
  };
  const events = () =>
    chunks.map((c) => JSON.parse(c.replace(/^data: /, "").trim()));
  return { res, events, close: () => onClose?.() };
}

describe("AiPlannerController.analyze (SSE)", () => {
  it("streams the planner's events and passes the request through", async () => {
    const planner = {
      analyze: vi.fn(async (input: AnalyzeInput) => {
        input.onEvent?.({ type: "stage", stage: "reading" });
        input.onEvent?.({
          type: "done",
          planId: "plan1",
          plan: {} as never,
          creditsCharged: 5,
        });
      }),
    };
    const controller = new AiPlannerController(planner as never);
    const { res, events } = fakeResponse();
    const file = upload("idea.md", "# Tour");

    await controller.analyze(
      "u1",
      {
        model: "m1",
        idea: "Tour",
        transcript: "voice",
        platform: "tiktok",
        language: "es",
      },
      [file],
      res,
    );

    expect(res.headers["Content-Type"]).toBe("text/event-stream");
    expect(events()).toEqual([
      { type: "stage", stage: "reading" },
      { type: "done", planId: "plan1", plan: {}, creditsCharged: 5 },
    ]);
    expect(planner.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        modelId: "m1",
        idea: "Tour",
        transcript: "voice",
        platform: "tiktok",
        language: "es",
        files: [file],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(res.writableEnded).toBe(true);
  });

  it("sends 4xx messages as error events and hides 5xx details", async () => {
    const controller = new AiPlannerController({
      analyze: vi
        .fn()
        .mockRejectedValueOnce(
          new BadRequestException(
            "Insufficient credits. This plan requires 5 credits.",
          ),
        )
        .mockRejectedValueOnce(new Error("ECONNRESET from provider")),
    } as never);

    const first = fakeResponse();
    await controller.analyze("u1", { model: "m1" }, undefined, first.res);
    expect(first.events()).toEqual([
      {
        type: "error",
        status: 400,
        error: "Insufficient credits. This plan requires 5 credits.",
      },
    ]);

    const second = fakeResponse();
    await controller.analyze("u1", { model: "m1" }, undefined, second.res);
    expect(second.events()).toEqual([
      {
        type: "error",
        status: 500,
        error: "Planning failed. Please try again.",
      },
    ]);
  });

  it("aborts the planner when the client disconnects and stays silent", async () => {
    let signal: AbortSignal | undefined;
    const { res, events, close } = fakeResponse();
    const controller = new AiPlannerController({
      analyze: vi.fn(async (input: AnalyzeInput) => {
        signal = input.signal;
        close();
        throw new PlanningAbortedError();
      }),
    } as never);

    await controller.analyze("u1", { model: "m1" }, [], res);
    expect(signal?.aborted).toBe(true);
    expect(events()).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantActionParameter } from "@creator-hub/shared-types";
import {
  ActionArgsError,
  AssistantActionRegistry,
  validateActionArgs,
  type AssistantActionHandler,
} from "../assistant-action-registry";

const PARAMS: AssistantActionParameter[] = [
  {
    name: "title",
    type: "string",
    required: true,
    maxLength: 10,
    description: "",
  },
  { name: "date", type: "date", required: true, description: "" },
  { name: "start", type: "time", required: false, description: "" },
  {
    name: "minutes",
    type: "integer",
    required: false,
    min: 5,
    max: 60,
    description: "",
  },
  {
    name: "kind",
    type: "string",
    required: false,
    enum: ["A", "B"],
    description: "",
  },
  {
    name: "remind",
    type: "integer",
    required: false,
    enum: [0, 15],
    description: "",
  },
  { name: "urgent", type: "boolean", required: false, description: "" },
];

const CONTEXT = {
  userId: "u1",
  timeZone: "UTC",
  now: new Date("2026-11-27T10:00:00Z"),
  language: "en",
};

function action(
  overrides: Partial<AssistantActionHandler> = {},
): AssistantActionHandler {
  return {
    name: "calendar.create_event",
    toolId: "content-planner",
    description: "Creates",
    mutates: true,
    parameters: PARAMS,
    execute: vi.fn(async () => ({ ok: true, summary: "Created" })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("validateActionArgs", () => {
  it("accepts and cleans valid arguments", () => {
    expect(
      validateActionArgs(PARAMS, {
        title: "  Record ",
        date: "2026-11-28",
        start: "09:30",
        minutes: "45",
        kind: "B",
        remind: 15,
        urgent: "true",
      }),
    ).toEqual({
      title: "Record",
      date: "2026-11-28",
      start: "09:30",
      minutes: 45,
      kind: "B",
      remind: 15,
      urgent: true,
    });
  });

  it("drops empty optional values", () => {
    expect(
      validateActionArgs(PARAMS, { title: "X", date: "2026-11-28", start: "" }),
    ).toEqual({ title: "X", date: "2026-11-28" });
  });

  it.each([
    [{ date: "2026-11-28" }, "Missing title"],
    [{ title: "X", date: "28/11/2026" }, "date must be a date"],
    [{ title: "X", date: "2026-11-28", start: "9am" }, "start must be a time"],
    [{ title: "X", date: "2026-11-28", minutes: 2 }, "at least 5"],
    [{ title: "X", date: "2026-11-28", minutes: 7.5 }, "whole number"],
    [{ title: "X", date: "2026-11-28", kind: "C" }, "one of: A, B"],
    [{ title: "X", date: "2026-11-28", remind: 10 }, "one of: 0, 15"],
    [{ title: "A very long title", date: "2026-11-28" }, "longer than 10"],
    [{ title: "X", date: "2026-11-28", userId: "someone" }, "Unknown argument"],
    [{ title: "X", date: "2026-11-28", urgent: "maybe" }, "true or false"],
  ])("rejects %j", (args, message) => {
    expect(() => validateActionArgs(PARAMS, args)).toThrow(ActionArgsError);
    expect(() => validateActionArgs(PARAMS, args)).toThrow(message);
  });

  it("rejects non-objects", () => {
    expect(() => validateActionArgs(PARAMS, "x")).toThrow("must be an object");
    expect(() => validateActionArgs(PARAMS, [])).toThrow("must be an object");
  });
});

describe("AssistantActionRegistry", () => {
  it("lists definitions without their handlers", () => {
    const registry = new AssistantActionRegistry();
    registry.register(action());
    expect(registry.has("calendar.create_event")).toBe(true);
    expect(registry.list()).toEqual([
      {
        name: "calendar.create_event",
        toolId: "content-planner",
        description: "Creates",
        mutates: true,
        parameters: PARAMS,
      },
    ]);
  });

  it("refuses malformed action names", () => {
    const registry = new AssistantActionRegistry();
    expect(() => registry.register(action({ name: "create event" }))).toThrow(
      "Invalid assistant action name",
    );
  });

  it("runs an action with validated arguments and the user's context", async () => {
    const registry = new AssistantActionRegistry();
    const execute = vi.fn(async () => ({ ok: true, summary: "Created" }));
    registry.register(action({ execute }));

    const result = await registry.execute(
      "calendar.create_event",
      { title: " Edit ", date: "2026-11-28" },
      CONTEXT,
    );

    expect(execute).toHaveBeenCalledWith(
      { title: "Edit", date: "2026-11-28" },
      CONTEXT,
    );
    expect(result).toEqual({
      ok: true,
      summary: "Created",
      args: { title: "Edit", date: "2026-11-28" },
    });
  });

  it("never throws: unknown actions, bad arguments and failures are results", async () => {
    const registry = new AssistantActionRegistry();
    registry.register(
      action({
        execute: async () => {
          throw new Error("database down");
        },
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await registry.execute("calendar.delete_all", {}, CONTEXT)).toEqual({
      ok: false,
      summary: 'Unknown action "calendar.delete_all"',
      args: {},
    });
    const invalid = await registry.execute(
      "calendar.create_event",
      { date: "2026-11-28" },
      CONTEXT,
    );
    expect(invalid).toMatchObject({ ok: false });
    expect(invalid.summary).toMatch(/^Invalid arguments: Missing title/);

    const failed = await registry.execute(
      "calendar.create_event",
      { title: "X", date: "2026-11-28" },
      CONTEXT,
    );
    expect(failed).toMatchObject({
      ok: false,
      summary: "The action failed: database down",
    });
  });
});

describe("AssistantActionRegistry — confirmation support", () => {
  it("exposes the definition and whether it needs confirmation", () => {
    const registry = new AssistantActionRegistry();
    registry.register(
      action({ name: "calendar.delete_event", requiresConfirmation: true }),
    );
    expect(registry.get("calendar.delete_event")).toMatchObject({
      name: "calendar.delete_event",
      requiresConfirmation: true,
    });
    expect(registry.get("calendar.delete_event")).not.toHaveProperty("execute");
    expect(registry.get("nope.nope")).toBeUndefined();
  });

  it("previews with validated arguments, without running", async () => {
    const registry = new AssistantActionRegistry();
    const execute = vi.fn();
    const describe_ = vi.fn(async () => ({
      ok: true,
      summary: "Would delete X",
    }));
    registry.register(
      action({ name: "calendar.delete_event", execute, describe: describe_ }),
    );

    const preview = await registry.preview(
      "calendar.delete_event",
      { title: " X ", date: "2026-11-28" },
      CONTEXT,
    );

    expect(preview).toEqual({
      ok: true,
      summary: "Would delete X",
      args: { title: "X", date: "2026-11-28" },
    });
    expect(describe_).toHaveBeenCalledWith(
      { title: "X", date: "2026-11-28" },
      CONTEXT,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("previews never throw", async () => {
    const registry = new AssistantActionRegistry();
    registry.register(
      action({
        describe: async () => {
          throw new Error("db down");
        },
      }),
    );
    expect(
      (await registry.preview("calendar.create_event", { date: "x" }, CONTEXT))
        .summary,
    ).toMatch(/^Invalid arguments/);
    expect(
      await registry.preview(
        "calendar.create_event",
        { title: "X", date: "2026-11-28" },
        CONTEXT,
      ),
    ).toMatchObject({ ok: false, summary: "The action failed: db down" });
    expect((await registry.preview("x.y", {}, CONTEXT)).ok).toBe(false);
  });
});

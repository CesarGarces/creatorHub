import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateContentEventDto,
  UpdateContentEventDto,
} from "../dto/content-event.dto";
import { CreateContentProjectDto } from "../dto/content-project.dto";
import {
  CreateCustomPlatformDto,
  CreateCustomTypeDto,
} from "../dto/custom-type.dto";
import { SaveProductionStepsDto } from "../dto/production-step.dto";

// Same options as the API's global ValidationPipe (apps/api/src/main.ts).
async function errorsFor<T extends object>(cls: new () => T, body: object) {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

const session = {
  title: "Record intro",
  type: "RECORDING",
  startAt: "2026-03-02T10:00:00.000Z",
  endAt: "2026-03-02T12:00:00.000Z",
};

describe("CreateContentEventDto", () => {
  it("accepts a complete session", async () => {
    expect(
      await errorsFor(CreateContentEventDto, {
        ...session,
        status: "IN_PROGRESS",
        notes: "Bring the mic",
        projectId: "p1",
      }),
    ).toEqual([]);
  });

  it("rejects unknown types, non-ISO dates, empty titles and extra fields", async () => {
    expect(
      await errorsFor(CreateContentEventDto, {
        ...session,
        title: "",
        type: "PARTY",
        startAt: "next monday",
        color: "red",
      }),
    ).toEqual(expect.arrayContaining(["title", "type", "startAt", "color"]));
  });
});

describe("UpdateContentEventDto", () => {
  it("allows null to detach a session from its project and clear notes", async () => {
    expect(
      await errorsFor(UpdateContentEventDto, { projectId: null, notes: null }),
    ).toEqual([]);
  });

  it("accepts a reschedule-only body", async () => {
    expect(
      await errorsFor(UpdateContentEventDto, {
        startAt: session.startAt,
        endAt: session.endAt,
      }),
    ).toEqual([]);
  });
});

describe("CreateContentProjectDto", () => {
  it("validates the nested sessions", async () => {
    expect(
      await errorsFor(CreateContentProjectDto, {
        title: "My video",
        platform: "youtube-long",
        publishAt: "2026-03-06T18:00:00.000Z",
        events: [session, { ...session, type: "NOPE" }],
      }),
    ).toEqual(["events"]);
  });

  it("rejects unknown platforms and too many sessions", async () => {
    expect(
      await errorsFor(CreateContentProjectDto, {
        title: "My video",
        platform: "myspace",
        events: Array.from({ length: 21 }, () => session),
      }),
    ).toEqual(["platform", "events"]);
  });
});

describe("CreateCustomTypeDto", () => {
  it("accepts a name and a palette color", async () => {
    expect(
      await errorsFor(CreateCustomTypeDto, { name: "Podcast", color: "teal" }),
    ).toEqual([]);
  });

  it("rejects colors outside the palette, empty and too-long names", async () => {
    expect(
      await errorsFor(CreateCustomTypeDto, { name: "", color: "#ff0000" }),
    ).toEqual(["name", "color"]);
    expect(
      await errorsFor(CreateCustomTypeDto, {
        name: "x".repeat(41),
        color: "teal",
      }),
    ).toEqual(["name"]);
  });
});

describe("customTypeId on sessions", () => {
  it("is accepted on create and can be cleared with null on update", async () => {
    expect(
      await errorsFor(CreateContentEventDto, {
        ...session,
        customTypeId: "t1",
      }),
    ).toEqual([]);
    expect(
      await errorsFor(UpdateContentEventDto, { customTypeId: null }),
    ).toEqual([]);
    expect(
      await errorsFor(UpdateContentEventDto, { customTypeId: "" }),
    ).toEqual(["customTypeId"]);
  });
});

describe("palette, platforms and steps", () => {
  it("accepts any palette color and icon for custom types", async () => {
    expect(
      await errorsFor(CreateCustomTypeDto, {
        name: "Podcast",
        color: "amber",
        icon: "mic",
      }),
    ).toEqual([]);
    expect(
      await errorsFor(CreateCustomTypeDto, {
        name: "Podcast",
        color: "amber",
        icon: "rocket",
      }),
    ).toEqual(["icon"]);
  });

  it("validates custom platform names", async () => {
    expect(await errorsFor(CreateCustomPlatformDto, { name: "Kick" })).toEqual(
      [],
    );
    expect(await errorsFor(CreateCustomPlatformDto, { name: "" })).toEqual([
      "name",
    ]);
  });

  it("accepts a project with a custom platform and customised planned sessions", async () => {
    expect(
      await errorsFor(CreateContentProjectDto, {
        title: "Video",
        customPlatformId: "pl1",
        events: [
          {
            ...session,
            customType: { name: "Voiceover", color: "orange", icon: "mic" },
          },
        ],
      }),
    ).toEqual([]);
    expect(
      await errorsFor(CreateContentProjectDto, {
        title: "Video",
        events: [
          { ...session, customType: { name: "Voiceover", color: "plaid" } },
        ],
      }),
    ).toEqual(["events"]);
  });

  const step = {
    baseType: "EDITING",
    name: null,
    color: null,
    icon: null,
    durationMinutes: 240,
    enabled: true,
    isPublish: false,
  };

  it("validates the steps template", async () => {
    expect(await errorsFor(SaveProductionStepsDto, { steps: [step] })).toEqual(
      [],
    );
    expect(
      await errorsFor(SaveProductionStepsDto, {
        steps: [
          {
            ...step,
            baseType: undefined,
            name: "Voiceover",
            color: "orange",
            icon: "mic",
          },
        ],
      }),
    ).toEqual([]);
    expect(await errorsFor(SaveProductionStepsDto, { steps: [] })).toEqual([
      "steps",
    ]);
    for (const bad of [
      { durationMinutes: 10 },
      { durationMinutes: 721 },
      { color: "plaid" },
      { icon: "rocket" },
      { enabled: "yes" },
      { extra: 1 },
    ]) {
      expect(
        await errorsFor(SaveProductionStepsDto, {
          steps: [{ ...step, ...bad }],
        }),
      ).toEqual(["steps"]);
    }
    expect(
      await errorsFor(SaveProductionStepsDto, {
        steps: Array.from({ length: 21 }, () => step),
      }),
    ).toEqual(["steps"]);
  });
});

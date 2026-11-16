import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AnalyzePlanDto } from "../ai-planner/analyze-plan.dto";
import {
  CreateContentEventDto,
  UpdateContentEventDto,
} from "../dto/content-event.dto";
import { CreateContentProjectDto } from "../dto/content-project.dto";

async function errorsFor<T extends object>(cls: new () => T, body: object) {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

const session = {
  title: "Thumbnail",
  type: "THUMBNAIL",
  startAt: "2030-03-05T10:00:00.000Z",
  endAt: "2030-03-05T11:00:00.000Z",
};
const toolAction = {
  toolId: "thumbnail-generator",
  intention: "Make the cover",
  prompt: "Bright studio",
};

describe("AnalyzePlanDto (multipart fields)", () => {
  it("accepts the form and treats empty optional fields as absent", async () => {
    expect(
      await errorsFor(AnalyzePlanDto, {
        model: "deepseek-ai/DeepSeek-V4",
        idea: "Tour",
        transcript: "",
        platform: "",
        publishDate: "",
        language: "pt",
      }),
    ).toEqual([]);
  });

  it("requires a model and validates the rest", async () => {
    expect(
      await errorsFor(AnalyzePlanDto, {
        idea: "x".repeat(20_001),
        platform: "myspace",
        publishDate: "tomorrow",
        language: "fr",
        hack: 1,
      }),
    ).toEqual(
      expect.arrayContaining([
        "model",
        "idea",
        "platform",
        "publishDate",
        "language",
        "hack",
      ]),
    );
  });
});

describe("tool actions on sessions", () => {
  it("are accepted on sessions and plan sessions, and can be cleared", async () => {
    expect(
      await errorsFor(CreateContentEventDto, { ...session, toolAction }),
    ).toEqual([]);
    expect(
      await errorsFor(CreateContentProjectDto, {
        title: "Video",
        aiPlanId: "plan1",
        events: [{ ...session, toolAction }],
      }),
    ).toEqual([]);
    expect(
      await errorsFor(UpdateContentEventDto, { toolAction: null }),
    ).toEqual([]);
  });

  it("reject bad tool ids and over-long fields", async () => {
    expect(
      await errorsFor(CreateContentEventDto, {
        ...session,
        toolAction: { ...toolAction, toolId: "../../admin" },
      }),
    ).toEqual(["toolAction"]);
    expect(
      await errorsFor(CreateContentEventDto, {
        ...session,
        toolAction: { ...toolAction, intention: "x".repeat(201) },
      }),
    ).toEqual(["toolAction"]);
    expect(
      await errorsFor(CreateContentEventDto, {
        ...session,
        toolAction: { toolId: "x" },
      }),
    ).toEqual(["toolAction"]);
  });
});

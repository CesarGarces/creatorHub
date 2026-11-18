import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateModelDto } from "../dto/model.dto";

const errorsFor = async (body: object) =>
  (
    await validate(plainToInstance(CreateModelDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

const valid = {
  providerSlug: "siliconflow",
  modelId: "BAAI/bge-m3",
  displayName: "BGE M3",
  taskType: "embedding",
  tier: "FREE",
  creditCost: 0,
};

describe("CreateModelDto", () => {
  it("accepts embedding and generation models", async () => {
    expect(await errorsFor(valid)).toEqual([]);
    expect(
      await errorsFor({
        ...valid,
        taskType: "text-generation",
        tier: "PRO",
        contextLength: 128000,
        supportsStreaming: true,
        tags: ["planner"],
        isActive: true,
      }),
    ).toEqual([]);
  });

  it("leaves voice models to Admin → Voice (no speech-to-text here)", async () => {
    expect(
      await errorsFor({
        ...valid,
        providerSlug: "deepgram",
        modelId: "nova-3",
        taskType: "speech-to-text",
        creditCost: 1,
      }),
    ).toEqual(["taskType"]);
  });

  it("rejects unknown providers and task types, bad ids and costs, and extra fields", async () => {
    expect(
      await errorsFor({
        ...valid,
        providerSlug: "acme",
        taskType: "telepathy",
        modelId: "has spaces",
        creditCost: -1,
        secret: "x",
      }),
    ).toEqual(
      expect.arrayContaining([
        "providerSlug",
        "taskType",
        "modelId",
        "creditCost",
        "secret",
      ]),
    );
    expect(await errorsFor({ ...valid, creditCost: 1.5 })).toEqual([
      "creditCost",
    ]);
    expect(
      await errorsFor({
        ...valid,
        tags: Array.from({ length: 11 }, () => "t"),
      }),
    ).toEqual(["tags"]);
  });
});

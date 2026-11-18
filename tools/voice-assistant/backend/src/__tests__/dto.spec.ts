import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import {
  ListConversationsQueryDto,
  SendMessageDto,
} from "../dto/send-message.dto";

function errors(body: Record<string, unknown>): string[] {
  const dto = plainToInstance(SendMessageDto, body);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);
}

const VALID = {
  content: "Hola Robotina",
  spoken: true,
  model: "deepseek-ai/DeepSeek-V4-Flash",
};

describe("SendMessageDto", () => {
  it("accepts a minimal message", () => {
    expect(errors(VALID)).toEqual([]);
    expect(
      errors({
        ...VALID,
        conversationId: "c1",
        temperature: 0.7,
        maxTokens: 300,
        languageHint: "pt",
      }),
    ).toEqual([]);
  });

  it("trims the content and rejects empty or over-long messages", () => {
    expect(
      plainToInstance(SendMessageDto, { ...VALID, content: "  hi  " }).content,
    ).toBe("hi");
    expect(errors({ ...VALID, content: "   " })).toEqual(["content"]);
    expect(errors({ ...VALID, content: "a".repeat(4001) })).toEqual([
      "content",
    ]);
  });

  it("requires the spoken flag and a model", () => {
    expect(errors({ content: "hi" }).sort()).toEqual(["model", "spoken"]);
    expect(errors({ ...VALID, spoken: "yes" })).toEqual(["spoken"]);
  });

  it("bounds the model settings", () => {
    expect(errors({ ...VALID, temperature: 3 })).toEqual(["temperature"]);
    expect(errors({ ...VALID, maxTokens: 10 })).toEqual(["maxTokens"]);
    expect(errors({ ...VALID, maxTokens: 5000 })).toEqual(["maxTokens"]);
    expect(errors({ ...VALID, maxTokens: 1.5 })).toEqual(["maxTokens"]);
  });

  it("accepts only the assistant's languages as hint", () => {
    expect(errors({ ...VALID, languageHint: "fr" })).toEqual(["languageHint"]);
  });

  it("rejects unknown fields (no TTS voice/model can be chosen)", () => {
    expect(errors({ ...VALID, voice: "aura-2-thalia-en" })).toEqual(["voice"]);
  });
});

describe("ListConversationsQueryDto", () => {
  it("coerces and bounds paging", () => {
    const dto = plainToInstance(ListConversationsQueryDto, {
      page: "2",
      limit: "10",
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 10 });
    expect(
      validateSync(plainToInstance(ListConversationsQueryDto, { limit: "99" })),
    ).toHaveLength(1);
  });
});

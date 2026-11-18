import { describe, expect, it } from "vitest";
import {
  CREATABLE_TASK_TYPES,
  MODEL_PROVIDERS,
  MODEL_TASK_TYPES,
  PROVIDERS_BY_TASK,
  defaultCreditCost,
  emptyModelForm,
  hasErrors,
  parseTags,
  toCreateModelPayload,
  validateModelForm,
  withTaskType,
  type ModelFormValues,
} from "../model-form";

const valid = (over: Partial<ModelFormValues> = {}): ModelFormValues => ({
  ...emptyModelForm(),
  modelId: "openai/gpt-4o-mini",
  displayName: "GPT-4o mini",
  ...over,
});

describe("model form options", () => {
  it("offers the same task types and providers as the API", () => {
    expect(CREATABLE_TASK_TYPES).toEqual([
      "text-generation",
      "image-generation",
      "video-generation",
      "embedding",
    ]);
    // Speech-to-text models added before Admin → Voice still show up.
    expect(MODEL_TASK_TYPES).toContain("speech-to-text");
    expect(MODEL_PROVIDERS.map((p) => p.value)).toEqual([
      "openrouter",
      "siliconflow",
      "deepgram",
    ]);
  });

  it("maps every task type to at least one known provider", () => {
    const known = MODEL_PROVIDERS.map((p) => p.value as string);
    for (const type of MODEL_TASK_TYPES) {
      expect(PROVIDERS_BY_TASK[type].length).toBeGreaterThan(0);
      for (const slug of PROVIDERS_BY_TASK[type]) {
        expect(known).toContain(slug);
      }
    }
  });

  it("defaults embeddings to free and everything else to 1 credit", () => {
    expect(defaultCreditCost("embedding")).toBe(0);
    expect(defaultCreditCost("text-generation")).toBe(1);
  });
});

describe("emptyModelForm / withTaskType", () => {
  it("starts as an inactive free text model on OpenRouter", () => {
    const form = emptyModelForm();
    expect(form).toMatchObject({
      taskType: "text-generation",
      providerSlug: "openrouter",
      tier: "FREE",
      creditCost: "1",
      supportsStreaming: true,
      isActive: false,
    });
  });

  it("switching to embedding picks SiliconFlow and a free price", () => {
    const form = withTaskType(
      { ...emptyModelForm(), supportsVision: true },
      "embedding",
    );
    expect(form.providerSlug).toBe("siliconflow");
    expect(form.creditCost).toBe("0");
    expect(form.supportsVision).toBe(false);
  });

  it("keeps the provider when it still fits the new task type", () => {
    const form = withTaskType(
      { ...emptyModelForm(), providerSlug: "siliconflow" },
      "image-generation",
    );
    expect(form.providerSlug).toBe("siliconflow");
  });

  it("keeps the typed model id and name", () => {
    const form = withTaskType(valid(), "embedding");
    expect(form.modelId).toBe("openai/gpt-4o-mini");
    expect(form.displayName).toBe("GPT-4o mini");
  });
});

describe("parseTags", () => {
  it("trims, lowercases, drops blanks and duplicates", () => {
    expect(parseTags(" Fast, planning ,, fast,RAG ")).toEqual([
      "fast",
      "planning",
      "rag",
    ]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("validateModelForm", () => {
  it("accepts a complete form", () => {
    expect(validateModelForm(valid())).toEqual({});
    expect(hasErrors(validateModelForm(valid()))).toBe(false);
  });

  it("requires model id and display name", () => {
    const errors = validateModelForm(valid({ modelId: "  ", displayName: "" }));
    expect(errors).toEqual({ modelId: "required", displayName: "required" });
    expect(hasErrors(errors)).toBe(true);
  });

  it("rejects model ids with spaces or odd characters", () => {
    expect(validateModelForm(valid({ modelId: "gpt 4" })).modelId).toBe(
      "invalidModelId",
    );
    expect(validateModelForm(valid({ modelId: "a<b>" })).modelId).toBe(
      "invalidModelId",
    );
    expect(
      validateModelForm(valid({ modelId: "BAAI/bge-m3:free@v1.2_x" })),
    ).toEqual({});
  });

  it("limits lengths", () => {
    expect(validateModelForm(valid({ modelId: "a".repeat(201) })).modelId).toBe(
      "tooLong",
    );
    expect(
      validateModelForm(valid({ displayName: "n".repeat(101) })).displayName,
    ).toBe("tooLong");
    expect(
      validateModelForm(valid({ description: "d".repeat(501) })).description,
    ).toBe("tooLong");
  });

  it("accepts 0 to 1000 whole credits", () => {
    expect(validateModelForm(valid({ creditCost: "0" }))).toEqual({});
    expect(validateModelForm(valid({ creditCost: "1000" }))).toEqual({});
    expect(validateModelForm(valid({ creditCost: "1001" })).creditCost).toBe(
      "creditRange",
    );
    expect(validateModelForm(valid({ creditCost: "" })).creditCost).toBe(
      "required",
    );
    for (const bad of ["-1", "1.5", "abc"]) {
      expect(validateModelForm(valid({ creditCost: bad })).creditCost).toBe(
        "invalidNumber",
      );
    }
  });

  it("checks the optional context length", () => {
    expect(validateModelForm(valid({ contextLength: "" }))).toEqual({});
    expect(validateModelForm(valid({ contextLength: "128000" }))).toEqual({});
    expect(validateModelForm(valid({ contextLength: "0" })).contextLength).toBe(
      "invalidNumber",
    );
    expect(
      validateModelForm(valid({ contextLength: "lots" })).contextLength,
    ).toBe("invalidNumber");
  });

  it("limits tags to 10 of up to 30 characters", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`).join(",");
    expect(validateModelForm(valid({ tags: eleven })).tags).toBe("tooManyTags");
    expect(validateModelForm(valid({ tags: "x".repeat(31) })).tags).toBe(
      "tooLong",
    );
  });
});

describe("toCreateModelPayload", () => {
  it("builds the POST /admin/models body", () => {
    expect(
      toCreateModelPayload(
        valid({
          modelId: "  openai/gpt-4o-mini ",
          displayName: " GPT-4o mini ",
          tier: "PRO",
          creditCost: " 3 ",
          contextLength: "128000",
          description: "  Fast planner ",
          tags: "fast, Planning",
          supportsVision: true,
          isActive: true,
        }),
      ),
    ).toEqual({
      providerSlug: "openrouter",
      modelId: "openai/gpt-4o-mini",
      displayName: "GPT-4o mini",
      taskType: "text-generation",
      tier: "PRO",
      creditCost: 3,
      contextLength: 128000,
      description: "Fast planner",
      tags: ["fast", "planning"],
      supportsStreaming: true,
      supportsVision: true,
      isActive: true,
    });
  });

  it("omits empty optional fields", () => {
    const payload = toCreateModelPayload(
      valid({ ...withTaskType(valid(), "video-generation"), creditCost: "2" }),
    );
    expect(payload).toEqual({
      providerSlug: "siliconflow",
      modelId: "openai/gpt-4o-mini",
      displayName: "GPT-4o mini",
      taskType: "video-generation",
      tier: "FREE",
      creditCost: 2,
      supportsStreaming: false,
      supportsVision: false,
      isActive: false,
    });
    expect(payload).not.toHaveProperty("contextLength");
    expect(payload).not.toHaveProperty("tags");
    expect(payload).not.toHaveProperty("description");
  });
});

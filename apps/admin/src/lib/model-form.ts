/**
 * "Add model" form (Admin → AI Models): options, validation and the request
 * body for POST /admin/models. Kept free of React so it can be unit tested.
 * The lists mirror apps/api/src/modules/admin/dto/model.dto.ts.
 */

/** Task types a model can have (filters, labels, existing models). */
export const MODEL_TASK_TYPES = [
  "text-generation",
  "image-generation",
  "video-generation",
  "embedding",
  "speech-to-text",
] as const;
export type ModelTaskType = (typeof MODEL_TASK_TYPES)[number];

/**
 * Task types "Add model" offers. Speech-to-text is not one of them: the
 * voice model and its price per second live in Admin → Voice (STT & TTS);
 * speech-to-text rows added before are kept but no longer price anything.
 */
export const CREATABLE_TASK_TYPES: readonly ModelTaskType[] =
  MODEL_TASK_TYPES.filter((type) => type !== "speech-to-text");

/** Providers with a runtime implementation. Brand names stay untranslated. */
export const MODEL_PROVIDERS = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "siliconflow", label: "SiliconFlow" },
  { value: "deepgram", label: "Deepgram" },
] as const;
export type ModelProviderSlug = (typeof MODEL_PROVIDERS)[number]["value"];

/** Which providers make sense for each task type (first one is the default). */
export const PROVIDERS_BY_TASK: Record<ModelTaskType, ModelProviderSlug[]> = {
  "text-generation": ["openrouter", "siliconflow"],
  "image-generation": ["siliconflow", "openrouter"],
  "video-generation": ["siliconflow"],
  embedding: ["siliconflow"],
  "speech-to-text": ["deepgram"],
};

export const MAX_CREDIT_COST = 1000;
const MODEL_ID_PATTERN = /^[\w.\-/:@]+$/;

export interface ModelFormValues {
  providerSlug: ModelProviderSlug;
  modelId: string;
  displayName: string;
  taskType: ModelTaskType;
  tier: "FREE" | "PRO";
  /** Kept as text while typing; validated on submit. */
  creditCost: string;
  contextLength: string;
  description: string;
  /** Comma-separated. */
  tags: string;
  supportsStreaming: boolean;
  supportsVision: boolean;
  isActive: boolean;
}

export type ModelFormField =
  | "modelId"
  | "displayName"
  | "creditCost"
  | "contextLength"
  | "description"
  | "tags";

/** Error codes; the form maps them to translated messages. */
export type ModelFormError =
  | "required"
  | "invalidModelId"
  | "tooLong"
  | "invalidNumber"
  | "creditRange"
  | "tooManyTags";

export type ModelFormErrors = Partial<Record<ModelFormField, ModelFormError>>;

export interface CreateModelPayload {
  providerSlug: ModelProviderSlug;
  modelId: string;
  displayName: string;
  taskType: ModelTaskType;
  tier: "FREE" | "PRO";
  creditCost: number;
  contextLength?: number;
  description?: string;
  tags?: string[];
  supportsStreaming: boolean;
  supportsVision: boolean;
  isActive: boolean;
}

export function emptyModelForm(
  taskType: ModelTaskType = "text-generation",
): ModelFormValues {
  return {
    providerSlug: PROVIDERS_BY_TASK[taskType][0]!,
    modelId: "",
    displayName: "",
    taskType,
    tier: "FREE",
    creditCost: String(defaultCreditCost(taskType)),
    contextLength: "",
    description: "",
    tags: "",
    supportsStreaming: taskType === "text-generation",
    supportsVision: false,
    isActive: false,
  };
}

/**
 * Suggested starting price. Embeddings run on every plan/project save, so
 * they default to free; generations default to 1 credit per use.
 */
export function defaultCreditCost(taskType: ModelTaskType): number {
  return taskType === "embedding" ? 0 : 1;
}

/** Changing the task type resets provider/price to sensible defaults. */
export function withTaskType(
  form: ModelFormValues,
  taskType: ModelTaskType,
): ModelFormValues {
  const providers = PROVIDERS_BY_TASK[taskType];
  return {
    ...form,
    taskType,
    providerSlug: providers.includes(form.providerSlug)
      ? form.providerSlug
      : providers[0]!,
    creditCost: String(defaultCreditCost(taskType)),
    supportsStreaming: taskType === "text-generation",
    supportsVision: taskType === "text-generation" && form.supportsVision,
  };
}

export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function validateModelForm(form: ModelFormValues): ModelFormErrors {
  const errors: ModelFormErrors = {};
  const modelId = form.modelId.trim();
  if (!modelId) errors.modelId = "required";
  else if (modelId.length > 200) errors.modelId = "tooLong";
  else if (!MODEL_ID_PATTERN.test(modelId)) errors.modelId = "invalidModelId";

  const displayName = form.displayName.trim();
  if (!displayName) errors.displayName = "required";
  else if (displayName.length > 100) errors.displayName = "tooLong";

  const cost = parseWholeNumber(form.creditCost);
  if (form.creditCost.trim() === "") errors.creditCost = "required";
  else if (cost === null) errors.creditCost = "invalidNumber";
  else if (cost > MAX_CREDIT_COST) errors.creditCost = "creditRange";

  if (form.contextLength.trim()) {
    const ctx = parseWholeNumber(form.contextLength);
    if (ctx === null || ctx < 1) errors.contextLength = "invalidNumber";
  }

  if (form.description.trim().length > 500) errors.description = "tooLong";

  const tags = parseTags(form.tags);
  if (tags.length > 10) errors.tags = "tooManyTags";
  else if (tags.some((tag) => tag.length > 30)) errors.tags = "tooLong";

  return errors;
}

export function hasErrors(errors: ModelFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Request body for POST /admin/models. Call only on a valid form. */
export function toCreateModelPayload(
  form: ModelFormValues,
): CreateModelPayload {
  const payload: CreateModelPayload = {
    providerSlug: form.providerSlug,
    modelId: form.modelId.trim(),
    displayName: form.displayName.trim(),
    taskType: form.taskType,
    tier: form.tier,
    creditCost: Number(form.creditCost.trim()),
    supportsStreaming: form.supportsStreaming,
    supportsVision: form.supportsVision,
    isActive: form.isActive,
  };
  if (form.contextLength.trim()) {
    payload.contextLength = Number(form.contextLength.trim());
  }
  const description = form.description.trim();
  if (description) payload.description = description;
  const tags = parseTags(form.tags);
  if (tags.length) payload.tags = tags;
  return payload;
}

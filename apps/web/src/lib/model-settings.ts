/**
 * Text-model settings of the chat-like tools (Post to X, X Trend Research,
 * Robotina): model, temperature and max tokens. Kept apart from
 * `ModelSettingsPanel` so stores and widgets can use them without loading
 * the panel's code.
 */
export interface ModelSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  model: "deepseek-ai/DeepSeek-V4-Flash",
  temperature: 0.7,
  maxTokens: 300,
};

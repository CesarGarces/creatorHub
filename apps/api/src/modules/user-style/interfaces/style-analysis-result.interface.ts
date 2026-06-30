export interface StyleAnalysisResult {
  tone: string;
  vocabKeywords: string[];
  language: string;
  sentenceLength: "short" | "medium" | "long";
  emojiUsage: "none" | "low" | "moderate" | "high";
  formalityLevel: "casual" | "semi-formal" | "formal";
  summary: string;
}

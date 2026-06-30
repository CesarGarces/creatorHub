import { Injectable, BadRequestException } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { ContentSampleService } from "./content-sample.service";
import { StyleProfileService } from "./style-profile.service";
import type { StyleAnalysisResult } from "../interfaces/style-analysis-result.interface";

const ANALYSIS_CREDIT_COST = 1;
const MIN_SAMPLES_REQUIRED = 3;

@Injectable()
export class StyleAnalyzerService {
  private logger = new Logger("StyleAnalyzerService");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private sampleService: ContentSampleService,
    private profileService: StyleProfileService,
  ) {}

  async analyze(userId: string): Promise<StyleAnalysisResult> {
    const samples = await this.sampleService.getRecentSamples(userId, 10);

    if (samples.length < MIN_SAMPLES_REQUIRED) {
      throw new BadRequestException(
        `Se necesitan al menos ${MIN_SAMPLES_REQUIRED} muestras de contenido para analizar el estilo. Actualmente tienes ${samples.length}.`,
      );
    }

    const hasCredits = await this.creditService.hasEnoughCredits(
      userId,
      ANALYSIS_CREDIT_COST,
    );
    if (!hasCredits) {
      throw new BadRequestException(
        `Insuficient credits. Style analysis requires ${ANALYSIS_CREDIT_COST} credit.`,
      );
    }

    const analysisPrompt = this.buildAnalysisPrompt(
      samples.map((s: { content: string }) => s.content),
    );

    const result = await this.aiEngine.execute({
      taskType: "text-analysis",
      prompt: analysisPrompt,
      userId,
      parameters: { temperature: 0.3, maxTokens: 1000 },
    });

    const responseContent =
      result.output.type === "text" ? result.output.content : "";

    const parsed = this.parseAnalysisResponse(responseContent);

    await this.profileService.upsert(userId, {
      ...parsed,
      sampleCount: samples.length,
    });

    await this.creditService.deduct(
      userId,
      ANALYSIS_CREDIT_COST,
      "user-style",
      "Style analysis",
    );

    this.logger.info("Style analysis completed", {
      userId,
      tone: parsed.tone,
      sampleCount: samples.length,
    });

    return parsed;
  }

  private buildAnalysisPrompt(sampleTexts: string[]): string {
    const samples = sampleTexts
      .map((text, i) => `Muestra ${i + 1}: "${text}"`)
      .join("\n");

    return `Analiza el estilo de comunicación del usuario basándote en estas muestras de contenido:

${samples}

Responde EXCLUSIVAMENTE en formato JSON con esta estructura exacta (sin markdown, sin backticks):
{
  "tone": "descripción del tono en 3-5 palabras (ej: directo, provocativo, profesional)",
  "vocabKeywords": ["5-10 palabras clave que el usuario usa frecuentemente"],
  "language": "código ISO 639-1 del idioma principal (ej: es, en, pt, fr)",
  "sentenceLength": "short|medium|long",
  "emojiUsage": "none|low|moderate|high",
  "formalityLevel": "casual|semi-formal|formal",
  "summary": "Descripción de 1-2 frases del estilo general"
}`;
  }

  private parseAnalysisResponse(response: string): StyleAnalysisResult {
    try {
      const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const validSentenceLengths = ["short", "medium", "long"];
      const validEmojiUsages = ["none", "low", "moderate", "high"];
      const validFormalityLevels = ["casual", "semi-formal", "formal"];

      if (!parsed.tone || typeof parsed.tone !== "string") {
        throw new Error("Invalid tone in analysis response");
      }

      if (!Array.isArray(parsed.vocabKeywords)) {
        throw new Error("Invalid vocabKeywords in analysis response");
      }

      if (!parsed.language || typeof parsed.language !== "string") {
        parsed.language = "es";
      } else {
        parsed.language = parsed.language.toLowerCase().slice(0, 2);
      }

      if (!validSentenceLengths.includes(parsed.sentenceLength)) {
        parsed.sentenceLength = "medium";
      }

      if (!validEmojiUsages.includes(parsed.emojiUsage)) {
        parsed.emojiUsage = "moderate";
      }

      if (!validFormalityLevels.includes(parsed.formalityLevel)) {
        parsed.formalityLevel = "casual";
      }

      return {
        tone: parsed.tone,
        vocabKeywords: parsed.vocabKeywords.slice(0, 10),
        language: parsed.language,
        sentenceLength: parsed.sentenceLength,
        emojiUsage: parsed.emojiUsage,
        formalityLevel: parsed.formalityLevel,
        summary: parsed.summary || "",
      };
    } catch (error) {
      this.logger.error("Failed to parse style analysis response", {
        error: (error as Error).message,
        response: response.slice(0, 200),
      });
      throw new BadRequestException(
        "Failed to parse style analysis. Please try again.",
      );
    }
  }
}

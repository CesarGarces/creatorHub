import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ProviderRegistry } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import { Readable } from "stream";
import { StyleInjectionService } from "./style-injection.service";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PLATFORM_LABELS: Record<string, string> = {
  "youtube-long": "YouTube Long-form (8-15 min)",
  "youtube-short": "YouTube Shorts (< 60s)",
  tiktok: "TikTok (< 60s)",
  reels: "Instagram Reels (< 60s)",
  shorts: "YouTube Shorts (< 60s)",
};

const WPM_BY_PLATFORM: Record<string, number> = {
  "youtube-long": 150,
  "youtube-short": 160,
  tiktok: 165,
  reels: 165,
  shorts: 160,
};

function estimateDuration(text: string, platform: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const wpm = WPM_BY_PLATFORM[platform] || 150;
  return Math.ceil((wordCount / wpm) * 60);
}

function extractTitle(topic: string): string {
  const cleaned = topic.replace(/[?!.,;:]/g, "").trim();
  return cleaned.length > 60 ? cleaned.slice(0, 57) + "..." : cleaned;
}

function extractThumbnailPrompt(content: string): string | null {
  const match = content.match(
    /##\s*🖼️\s*THUMBNAIL PROMPT\s*\n([\s\S]*?)(?=\n##\s|$)/i,
  );
  return match?.[1]?.trim() || null;
}

@Injectable()
export class ScriptWriterService {
  private logger = new Logger("ScriptWriterService");

  constructor(
    private providerRegistry: ProviderRegistry,
    private creditService: CreditService,
    private usageLogger: PlatformUsageLogger,
    private styleInjection: StyleInjectionService,
  ) {}

  createStream(params: {
    userId: string;
    topic: string;
    platform: string;
    tone: string;
    hookType: string;
    targetDuration: number;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    useStyle: boolean;
  }): Readable {
    const stream = new Readable({ read() {} });

    this.handleStream(params, stream).catch((error) => {
      this.logger.error("Stream error", {
        userId: params.userId,
        error: error.message,
      });
      const data = JSON.stringify({ type: "error", error: error.message });
      stream.push(`data: ${data}\n\n`);
      stream.push(null);
    });

    return stream;
  }

  private async handleStream(
    params: {
      userId: string;
      topic: string;
      platform: string;
      tone: string;
      hookType: string;
      targetDuration: number;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useStyle: boolean;
    },
    stream: Readable,
  ) {
    const startTime = Date.now();
    const model = params.model || "unknown";
    let creditCost = 0;
    let scriptId: string | null = null;

    try {
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }

      const providerRecord = await prisma.provider.findFirst({
        where: { model, isActive: true },
      });
      creditCost = providerRecord?.costPerCredit ?? 1;

      const hasCredits = await this.creditService.hasEnoughCredits(
        params.userId,
        creditCost,
      );
      if (!hasCredits) {
        throw new BadRequestException(
          `Insufficient credits. This model requires ${creditCost} credits.`,
        );
      }

      const startData = JSON.stringify({
        type: "start",
        model,
        creditCost,
      });
      stream.push(`data: ${startData}\n\n`);

      const script = await prisma.generatedScript.create({
        data: {
          userId: params.userId,
          topic: params.topic,
          content: "",
          platform: params.platform,
          tone: params.tone,
          hookType: params.hookType,
          targetDuration: params.targetDuration,
          model,
          status: "GENERATING",
        },
      });
      scriptId = script.id;

      const scriptCreatedData = JSON.stringify({
        type: "script_created",
        scriptId: script.id,
      });
      stream.push(`data: ${scriptCreatedData}\n\n`);

      let stylePrompt = "";
      if (params.useStyle) {
        try {
          stylePrompt = await this.styleInjection.getStylePrompt(params.userId);
        } catch (error) {
          this.logger.warn(
            "Failed to get style prompt, continuing without it",
            { userId: params.userId, error: (error as Error).message },
          );
        }
      }

      const systemPrompt = this.buildSystemPrompt({
        platform: params.platform,
        tone: params.tone,
        hookType: params.hookType,
        targetDuration: params.targetDuration.toString(),
        userStyleContext: stylePrompt || undefined,
      });

      const streamingProvider =
        await this.providerRegistry.getStreamingProviderForModel(model);
      const dbProvider = await this.providerRegistry.getProviderForModel(model);
      const fallbackProvider =
        dbProvider ||
        this.providerRegistry.getAnyProviderForTask("text-generation");

      if (!streamingProvider && !fallbackProvider) {
        throw new BadRequestException(
          `No provider available for model: ${model}`,
        );
      }

      const provider = streamingProvider || fallbackProvider;
      const supportsStreaming = !!streamingProvider;

      const aiRequest = {
        taskType: "text-generation" as const,
        prompt: `${systemPrompt}\n\nTema: ${params.topic}`,
        parameters: {
          temperature: params.temperature ?? 0.7,
          maxTokens: params.maxTokens ?? 4000,
        },
      };

      let fullContent = "";

      if (supportsStreaming && provider!.generateStream) {
        const aiStream = provider!.generateStream(aiRequest);

        for await (const chunk of aiStream) {
          if (chunk.type === "content" && chunk.content) {
            fullContent += chunk.content;
            const data = JSON.stringify({
              type: "content",
              content: chunk.content,
            });
            stream.push(`data: ${data}\n\n`);
          } else if (chunk.type === "done") {
            break;
          }
        }
      } else {
        const response = await provider!.generate(aiRequest);
        const output = response.output as { content?: string; type?: string };
        fullContent = output?.content || "";
        const data = JSON.stringify({
          type: "content",
          content: fullContent,
        });
        stream.push(`data: ${data}\n\n`);
      }

      const wordCount = fullContent.split(/\s+/).filter(Boolean).length;
      const estimatedDuration = estimateDuration(fullContent, params.platform);
      const thumbnailPrompt = extractThumbnailPrompt(fullContent);
      const title = extractTitle(params.topic);

      await prisma.generatedScript.update({
        where: { id: scriptId },
        data: {
          content: fullContent,
          title,
          wordCount,
          estimatedDuration,
          thumbnailPrompt,
          status: "COMPLETED",
        },
      });

      const deducted = await this.creditService.deduct(
        params.userId,
        creditCost,
        "script-writer",
        `Script: ${params.topic.slice(0, 50)}`,
      );

      if (!deducted) {
        this.logger.warn("Credit deduction failed after script generation", {
          userId: params.userId,
          model,
          creditCost,
        });
      }

      const doneData = JSON.stringify({
        type: "done",
        scriptId,
        wordCount,
        estimatedDuration,
        thumbnailPrompt,
        creditCost,
      });
      stream.push(`data: ${doneData}\n\n`);
      stream.push(null);

      await this.usageLogger.logUsage({
        userId: params.userId,
        toolId: "script-writer",
        modelId: model,
        duration: Date.now() - startTime,
        success: true,
        credits: creditCost,
      });
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error("Script generation failed", {
        userId: params.userId,
        error: errMsg,
      });

      if (scriptId) {
        await prisma.generatedScript
          .update({
            where: { id: scriptId },
            data: { status: "FAILED" },
          })
          .catch(() => {});
      }

      const data = JSON.stringify({ type: "error", error: errMsg });
      stream.push(`data: ${data}\n\n`);
      stream.push(null);

      await this.usageLogger.logUsage({
        userId: params.userId,
        toolId: "script-writer",
        modelId: model,
        duration: Date.now() - startTime,
        success: false,
        credits: 0,
        error: errMsg,
      });
    }
  }

  async getScripts(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: any[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const [scripts, total] = await Promise.all([
      prisma.generatedScript.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          topic: true,
          platform: true,
          tone: true,
          hookType: true,
          estimatedDuration: true,
          wordCount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.generatedScript.count({
        where: { userId, status: "COMPLETED" },
      }),
    ]);

    return {
      data: scripts,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getScript(userId: string, scriptId: string): Promise<any> {
    const script = await prisma.generatedScript.findFirst({
      where: { id: scriptId, userId },
    });

    if (!script) {
      throw new NotFoundException("Script not found");
    }

    return script;
  }

  async deleteScript(userId: string, scriptId: string): Promise<void> {
    const script = await prisma.generatedScript.findFirst({
      where: { id: scriptId, userId },
    });

    if (!script) {
      throw new NotFoundException("Script not found");
    }

    await prisma.generatedScript.delete({
      where: { id: scriptId },
    });

    this.logger.info("Script deleted", { userId, scriptId });
  }

  private buildSystemPrompt(params: {
    platform: string;
    tone: string;
    hookType: string;
    targetDuration: string;
    userStyleContext?: string;
  }): string {
    const platformLabel = PLATFORM_LABELS[params.platform] || params.platform;

    return `You are an expert professional scriptwriter specialized in viral content for ${platformLabel}.

Your task is to create a highly persuasive and structured script that maximizes viewer retention.

IMPORTANT: Always respond in the same language the user writes in. If the user writes in English, respond in English. If they write in Spanish, respond in Spanish. Match their language exactly.

--- SETTINGS ---
Platform: ${platformLabel}
Tone: ${params.tone}
Hook type: ${params.hookType}
Target duration: ${params.targetDuration} seconds

${params.userStyleContext ? `--- CREATOR STYLE ---\n${params.userStyleContext}\nStrictly adopt the tone, vocabulary, and rhythm of the creator shown above.\n` : ""}
--- MANDATORY RULES ---
1. Structure the script in 4 blocks: HOOK, DEVELOPMENT, CLIMAX, CTA
2. Each block must have visual cues in brackets [ ] to facilitate editing
3. The Hook must have 2 or 3 distinct opening phrase options
4. The Development must be agile and direct, without unnecessary filler
5. The Climax must be the point of highest tension or value
6. The CTA must be a natural transition for engagement (subscribe, like, comment)
7. At the end generate a "Thumbnail Prompt" optimized for AI image generation

--- OUTPUT FORMAT ---
Use EXACTLY this format:

## 🎯 HOOK (0:00 - 0:05)

**Option 1:** [visual cue] "exact phrase the speaker should say or display on screen"
**Option 2:** [visual cue] "alternative phrase"
**Option 3:** [visual cue] "another alternative"

---

## 🔥 DEVELOPMENT (0:05 - ${parseInt(params.targetDuration) > 60 ? "X:XX" : "0:" + Math.min(45, parseInt(params.targetDuration) - 15)})

[visual cue] Script text here...

[visual cue] Continuation of development...

---

## 💡 CLIMAX (approx. ${Math.max(5, parseInt(params.targetDuration) - 10)}s before the end)

[visual cue] The point of highest tension or revelation...

---

## 📢 CTA (last 5-10 seconds)

[visual cue] Natural and persuasive call to action...

---

## 🖼️ THUMBNAIL PROMPT
Describe a striking and eye-catching image to serve as the video thumbnail. Be specific with visual style, colors, composition, and key elements. Example: "Close-up dramatic face with red lighting, text overlay 'THE TRUTH' in bold white font, dark moody background with particle effects"

---

REMEMBER: Be direct, avoid filler, and every phrase must have a clear retention purpose.`;
  }
}

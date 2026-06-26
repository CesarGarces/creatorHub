import { AIProviderBase } from "./ai-provider.base";
import type { ImageGenerationOptions } from "./provider.interface";
import type {
  AIRequest,
  AIResponse,
  AIProvider,
  AITaskType,
} from "@creator-hub/shared-types";

export class SiliconFlowVideoProvider extends AIProviderBase {
  readonly name: AIProvider = "siliconflow-video";
  readonly supportedTasks: AITaskType[] = ["video-generation"];
  readonly supportedModels = [
    "Wan-AI/Wan2.2-T2V-A14B",
    "Wan-AI/Wan2.2-I2V-A14B",
  ];
  readonly tier = "free" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    const model = (request.model as string) || "Wan-AI/Wan2.2-T2V-A14B";
    const width = (request.parameters?.width as number) || 1280;
    const height = (request.parameters?.height as number) || 720;
    const imageUrl = request.parameters?.imageUrl as string | undefined;

    return this.generateVideo({
      prompt: request.prompt,
      imageUrl,
      model,
      width,
      height,
    });
  }

  async generateImage(_options: ImageGenerationOptions): Promise<AIResponse> {
    throw new Error(
      "SiliconFlow Video provider does not support image generation. Use generateVideo() instead.",
    );
  }

  private async generateVideo(options: {
    prompt: string;
    imageUrl?: string;
    model: string;
    width: number;
    height: number;
  }): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    const { prompt, imageUrl, model, width, height } = options;

    const submitBody: Record<string, unknown> = {
      model,
      prompt,
      image_size: `${width}x${height}`,
    };

    if (model.includes("I2V") && imageUrl) {
      submitBody.image = imageUrl;
    }

    const submitRes = await fetch(
      "https://api.siliconflow.com/v1/video/submit",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitBody),
      },
    );

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(
        `SiliconFlow video submit error ${submitRes.status}: ${errText}`,
      );
    }

    const submitData = (await submitRes.json()) as Record<string, unknown>;
    console.log(
      "[SiliconFlowVideo] Submit response:",
      JSON.stringify(submitData),
    );

    const requestId =
      (submitData.request_id as string) ||
      (submitData.requestId as string) ||
      (submitData.id as string) ||
      (submitData.data as any)?.request_id ||
      (submitData.data as any)?.requestId ||
      (submitData.data as any)?.id;

    if (!requestId) {
      throw new Error(
        `SiliconFlow returned no request_id. Response: ${JSON.stringify(submitData)}`,
      );
    }

    const maxAttempts = 120;
    const pollInterval = 5000;
    let videoUrl: string | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));

      let statusRes: Response;
      try {
        statusRes = await fetch("https://api.siliconflow.com/v1/video/status", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requestId }),
        });
      } catch (e) {
        continue;
      }

      if (!statusRes.ok) continue;

      const statusData = (await statusRes.json()) as Record<string, unknown>;
      const status = statusData.status as string;
      const reason = statusData.reason as string | undefined;
      const results = statusData.results as
        | { videos?: Array<{ url: string }>; timings?: unknown }
        | undefined;

      const resolvedUrl = results?.videos?.[0]?.url;

      if (i === 0 || (i + 1) % 10 === 0 || resolvedUrl || status === "Failed") {
        console.log(`[SiliconFlowVideo] Poll #${i + 1}/${maxAttempts}`, {
          status,
          hasUrl: !!resolvedUrl,
          url: resolvedUrl,
          reason,
          raw: JSON.stringify(statusData).slice(0, 500),
        });
      }

      if (status === "Succeed" && resolvedUrl) {
        videoUrl = resolvedUrl;
        break;
      }

      if (status === "Failed") {
        throw new Error(
          `SiliconFlow video generation failed: ${reason || "unknown"}`,
        );
      }
    }

    if (!videoUrl) {
      throw new Error(
        "SiliconFlow video generation timed out after 10 minutes",
      );
    }

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model,
      output: {
        type: "video",
        url: videoUrl,
        width,
        height,
      },
      usage: { credits: 1 },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "SILICONFLOW_API_KEY";
  }
}

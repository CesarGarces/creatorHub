import type { AIRequest } from "@creator-hub/shared-types";
import {
  collect,
  delta,
  errorResponse,
  jsonResponse,
  sseResponse,
} from "../__mocks__/http";

const mockOpenAI = {
  chatCreate: jest.fn(),
  imagesGenerate: jest.fn(),
};
jest.mock("openai", () => {
  class APIError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  class OpenAI {
    static APIError = APIError;
    chat = { completions: { create: mockOpenAI.chatCreate } };
    images = { generate: mockOpenAI.imagesGenerate };
  }
  return { __esModule: true, default: OpenAI };
});

const mockGenerateContent = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import OpenAI from "openai";
import { FluxProvider } from "../providers/flux.provider";
import { StabilityAIProvider } from "../providers/stability-ai.provider";
import { ZImageTurboProvider } from "../providers/z-image-turbo.provider";
import { SiliconFlowProvider } from "../providers/siliconflow.provider";
import {
  DeepSeekV4FlashProvider,
  DeepSeekV4ProProvider,
} from "../providers/deepseek-v4.provider";
import { GLM5Provider } from "../providers/glm5.provider";
import { GeminiProvider } from "../providers/gemini.provider";
import { OpenAIImageProvider } from "../providers/openai.provider";
import { MockImageProvider } from "../providers/mock-image.provider";
import { SiliconFlowVideoProvider } from "../providers/siliconflow-video.provider";

const KEYS = [
  "FLUX_API_KEY",
  "STABILITY_AI_API_KEY",
  "SILICONFLOW_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
];
const saved: Record<string, string | undefined> = {};
const fetchMock = jest.fn();
const realFetch = global.fetch;

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    process.env[key] = `${key.toLowerCase()}-value`;
  }
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  global.fetch = realFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function lastRequest(): {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
} {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  return { url, init, body };
}

function chatRequest(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    taskType: "text-generation",
    prompt: "Hola",
    ...overrides,
  } as AIRequest;
}

describe("API key handling", () => {
  it.each([
    [new FluxProvider(), "FLUX_API_KEY"],
    [new SiliconFlowProvider(), "SILICONFLOW_API_KEY"],
    [new GeminiProvider(), "GEMINI_API_KEY"],
  ])("%s is only configured when its key is set", (provider, key) => {
    expect(provider.validateConfig()).toBe(true);
    delete process.env[key];
    expect(provider.validateConfig()).toBe(false);
  });

  it("throws a clear error when calling a provider without its key", async () => {
    delete process.env.FLUX_API_KEY;
    await expect(
      new FluxProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("API key not configured for flux");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("FluxProvider", () => {
  it("generates an image with the key header", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "f1", result: "https://bfl/img.png" }),
    );

    const result = await new FluxProvider().generate(
      chatRequest({ taskType: "image-generation", prompt: "castle" }),
    );

    const { url, init, body } = lastRequest();
    expect(url).toBe("https://api.bfl.ml/v1/image");
    expect((init.headers as Record<string, string>)["x-key"]).toBe(
      "flux_api_key-value",
    );
    expect(body).toEqual({
      prompt: "castle",
      width: 1024,
      height: 1024,
      steps: 28,
    });
    expect(result.output).toEqual({
      type: "image",
      url: "https://bfl/img.png",
      width: 1024,
      height: 1024,
    });
  });

  it("reports API errors and empty results", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(402, "Payment required"));
    await expect(
      new FluxProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("Flux API error 402: Payment required");

    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "f2" }));
    await expect(
      new FluxProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("Flux returned no image URL");
  });
});

describe("StabilityAIProvider", () => {
  it("returns the generated PNG as a data URL", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }),
    );

    const result = await new StabilityAIProvider().generateImage({
      prompt: "robot",
      negativePrompt: "text",
      aspectRatio: "1:1",
    });

    const { url, init } = lastRequest();
    expect(url).toBe(
      "https://api.stability.ai/v2beta/stable-image/generate/sd3",
    );
    const form = init.body as FormData;
    expect(form.get("prompt")).toBe("robot");
    expect(form.get("negative_prompt")).toBe("text");
    expect(form.get("aspect_ratio")).toBe("1:1");
    expect(result.output).toMatchObject({
      type: "image",
      url: "data:image/png;base64,iVBORw==",
    });
  });

  it("defaults to 16:9 and rejects empty images", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([]), { status: 200 }),
    );

    await expect(
      new StabilityAIProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("Stability AI returned empty image data");
    expect((lastRequest().init.body as FormData).get("aspect_ratio")).toBe(
      "16:9",
    );
  });
});

describe("ZImageTurboProvider", () => {
  it("requests the requested size from SiliconFlow", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ images: [{ url: "https://sf/z.png" }] }),
    );

    const result = await new ZImageTurboProvider().generateImage({
      prompt: "cat",
      width: 768,
      height: 512,
    });

    expect(lastRequest().body).toMatchObject({
      model: "Tongyi-MAI/Z-Image-Turbo",
      image_size: "768x512",
    });
    expect(result.output).toMatchObject({
      url: "https://sf/z.png",
      width: 768,
      height: 512,
    });
  });

  it("rejects responses without images", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ images: [] }));
    await expect(
      new ZImageTurboProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("Z-Image-Turbo returned no image URL");
  });
});

describe("SiliconFlowProvider", () => {
  const provider = new SiliconFlowProvider();

  it("uses FLUX.2 Pro for text-to-image with a negative prompt", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ images: [{ url: "https://sf/1.png" }] }),
    );

    const result = await provider.generate(
      chatRequest({
        taskType: "image-generation",
        prompt: "sunset",
        negativePrompt: "people",
      }),
    );

    expect(lastRequest().body).toEqual({
      model: "black-forest-labs/FLUX.2-pro",
      prompt: "sunset",
      image_size: "1024x1024",
      negative_prompt: "people",
    });
    expect(result.model).toBe("FLUX.2-pro");
  });

  it("uses Kontext for image-to-image edits", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ images: [{ url: "https://sf/2.png" }] }),
    );

    await provider.generateImage({
      prompt: "make it night",
      imageUrl: "https://in.png",
      negativePrompt: "x",
    });

    expect(lastRequest().body).toEqual({
      model: "black-forest-labs/FLUX.1-Kontext-max",
      prompt: "make it night",
      image_size: "1024x1024",
      input_image: "https://in.png",
    });
  });

  it("sends system prompt and history for text generation", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "  Respuesta  " } }],
        usage: { total_tokens: 42 },
      }),
    );

    const result = await provider.generate(
      chatRequest({
        parameters: {
          systemPrompt: "Be brief",
          temperature: 0,
          maxTokens: 100,
          conversationHistory: [
            { role: "user", content: "hi" },
            { role: "assistant", content: "hey" },
          ],
        },
      }),
    );

    const { url, init, body } = lastRequest();
    expect(url).toBe("https://api.siliconflow.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer siliconflow_api_key-value",
    );
    expect(body).toEqual({
      model: "deepseek-ai/DeepSeek-V4-Flash",
      messages: [
        { role: "system", content: "Be brief" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hey" },
        { role: "user", content: "Hola" },
      ],
      temperature: 0,
      max_tokens: 100,
      stream: false,
    });
    expect(result.output).toEqual({ type: "text", content: "Respuesta" });
    expect(result.usage.tokens).toBe(42);
  });

  it("rejects empty completions and API errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [] }));
    await expect(provider.generateText(chatRequest())).rejects.toThrow(
      "SiliconFlow returned no content",
    );

    fetchMock.mockResolvedValueOnce(errorResponse(429, "rate limited"));
    await expect(provider.generateText(chatRequest())).rejects.toThrow(
      "SiliconFlow API error 429: rate limited",
    );
  });

  it("streams content chunks split across network packets", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(
        [
          delta("Hel"),
          delta("lo "),
          { choices: [{}] },
          delta("mundo"),
          "[DONE]",
          delta("ignored"),
        ],
        5,
      ),
    );

    const chunks = await collect(provider.generateStream(chatRequest()));

    expect(chunks).toEqual([
      { type: "content", content: "Hel" },
      { type: "content", content: "lo " },
      { type: "content", content: "mundo" },
      { type: "done" },
    ]);
    expect(lastRequest().body).toMatchObject({
      stream: true,
      max_tokens: 8000,
    });
  });

  it("skips malformed stream lines and ends even without [DONE]", async () => {
    const body =
      "data: {broken\n\ndata: " +
      JSON.stringify(delta("ok")) +
      "\n\n: keep-alive\n\n";
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }));

    expect(await collect(provider.generateStream(chatRequest()))).toEqual([
      { type: "content", content: "ok" },
      { type: "done" },
    ]);
  });
});

describe("DeepSeek V4 providers", () => {
  it("Flash translates with the fixed translator prompt at low temperature", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "Hello" } }] }),
    );

    const result = await new DeepSeekV4FlashProvider().generate(chatRequest());

    const { body } = lastRequest();
    expect(body.model).toBe("deepseek-ai/DeepSeek-V4-Flash");
    expect(body.temperature).toBe(0.3);
    expect((body.messages as Array<{ content: string }>)[0]!.content).toContain(
      "traductor profesional",
    );
    expect(result).toMatchObject({
      provider: "deepseek-v4",
      usage: { credits: 5 },
    });
  });

  it("Pro costs more and streams with a custom system prompt", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([delta("A"), delta("B"), "[DONE]"]),
    );

    const chunks = await collect(
      new DeepSeekV4ProProvider().generateStream(
        chatRequest({ parameters: { systemPrompt: "Custom" } }),
      ),
    );

    expect(
      chunks
        .filter((c) => c.type === "content")
        .map((c) => c.content)
        .join(""),
    ).toBe("AB");
    const messages = lastRequest().body.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[0]).toEqual({ role: "system", content: "Custom" });
    expect(lastRequest().body.model).toBe("deepseek-ai/DeepSeek-V4-Pro");
  });

  it("do not generate images", async () => {
    await expect(
      new DeepSeekV4FlashProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("does not support image generation");
    await expect(
      new DeepSeekV4ProProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("does not support image generation");
  });

  it("report API errors and empty content", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, "boom"));
    await expect(
      new DeepSeekV4ProProvider().generate(chatRequest()),
    ).rejects.toThrow("DeepSeek V4 Pro API error 500: boom");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "" } }] }),
    );
    await expect(
      new DeepSeekV4FlashProvider().generate(chatRequest()),
    ).rejects.toThrow("DeepSeek V4 Flash returned no content");
  });
});

describe("GLM5Provider", () => {
  const provider = new GLM5Provider();

  it("assembles the reply from the stream", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([delta("Hola "), delta("mundo"), "[DONE]"]),
    );

    const result = await provider.generate(chatRequest());

    expect(result.output).toEqual({ type: "text", content: "Hola mundo" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a non-streaming request when the stream yields nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(sseResponse(["[DONE]"]))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ delta: { content: "from delta" } }] }),
      );

    const result = await provider.generate(chatRequest());

    expect(result.output).toEqual({ type: "text", content: "from delta" });
    expect(lastRequest().body.stream).toBe(false);
  });

  it("falls back when streaming fails, and errors if both are empty", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(503, "overloaded"))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: "" } }] }),
      );

    await expect(provider.generate(chatRequest())).rejects.toThrow(
      "GLM-5.2 returned no content",
    );
  });
});

describe("GeminiProvider", () => {
  beforeEach(() => mockGenerateContent.mockReset());

  it("generates text with the requested model", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Gemini says hi" });

    const result = await new GeminiProvider().generate(
      chatRequest({ model: "gemini-2.5-flash" as never }),
    );

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
      contents: "Hola",
    });
    expect(result.output).toEqual({ type: "text", content: "Gemini says hi" });
  });

  it("returns inline image data as a data URL", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { text: "caption" },
              { inlineData: { data: "QUJD", mimeType: "image/jpeg" } },
            ],
          },
        },
      ],
    });

    const result = await new GeminiProvider().generateImage({ prompt: "cat" });

    expect(mockGenerateContent.mock.calls[0][0]).toMatchObject({
      model: "gemini-2.5-flash-image",
      config: { responseModalities: ["IMAGE"] },
    });
    expect(result.output).toMatchObject({
      type: "image",
      url: "data:image/jpeg;base64,QUJD",
    });
  });

  it("rejects responses without image data", async () => {
    mockGenerateContent.mockResolvedValueOnce({ candidates: [] });
    await expect(
      new GeminiProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("no content parts");

    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: "sorry" }] } }],
    });
    await expect(
      new GeminiProvider().generateImage({ prompt: "x" }),
    ).rejects.toThrow("no image data");
  });
});

describe("OpenAIImageProvider", () => {
  beforeEach(() => {
    mockOpenAI.chatCreate.mockReset();
    mockOpenAI.imagesGenerate.mockReset();
  });

  it("defaults to gpt-image-1 at 1024x1024", async () => {
    mockOpenAI.imagesGenerate.mockResolvedValue({
      created: 1,
      data: [{ b64_json: "AAA" }],
    });

    const result = await new OpenAIImageProvider().generateImage({
      prompt: "logo",
      model: "unknown",
    });

    expect(mockOpenAI.imagesGenerate).toHaveBeenCalledWith({
      model: "gpt-image-1",
      prompt: "logo",
      n: 1,
      size: "1024x1024",
    });
    expect(result.output).toMatchObject({ url: "data:image/png;base64,AAA" });
  });

  it.each([
    ["dall-e-3", 1920, 1080, "1792x1024", 2],
    ["dall-e-3", 1080, 1920, "1024x1792", 2],
    ["dall-e-2", 256, 256, "256x256", 1],
    ["dall-e-2", 500, 400, "512x512", 1],
  ])(
    "%s at %dx%d requests %s and costs %d credit(s)",
    async (model, width, height, size, credits) => {
      mockOpenAI.imagesGenerate.mockResolvedValue({
        created: 1,
        data: [{ url: "https://oai/img.png" }],
      });

      const result = await new OpenAIImageProvider().generateImage({
        prompt: "p",
        model,
        width,
        height,
      });

      expect(mockOpenAI.imagesGenerate.mock.calls[0][0].size).toBe(size);
      expect(result.usage.credits).toBe(credits);
    },
  );

  it.each([
    [401, "Incorrect API key", /invalid or expired/],
    [429, "Too many", /rate limit exceeded/],
    [400, "Billing hard limit reached", /billing limit reached/],
    [400, "Model not available", /OpenAI model error/],
    [500, "Server error", /OpenAI API error \(500\)/],
  ])(
    "maps API error %d to a helpful message",
    async (status, message, expected) => {
      const APIError = (
        OpenAI as unknown as { APIError: new (s: number, m: string) => Error }
      ).APIError;
      mockOpenAI.imagesGenerate.mockRejectedValue(
        new APIError(status, message),
      );

      await expect(
        new OpenAIImageProvider().generateImage({ prompt: "p" }),
      ).rejects.toThrow(expected);
    },
  );

  it("rejects responses without image data", async () => {
    mockOpenAI.imagesGenerate.mockResolvedValue({ created: 1, data: [{}] });
    await expect(
      new OpenAIImageProvider().generateImage({ prompt: "p" }),
    ).rejects.toThrow("OpenAI returned no image data");
  });

  it("uses chat completions for text tasks", async () => {
    mockOpenAI.chatCreate.mockResolvedValue({
      id: "c1",
      choices: [{ message: { content: "answer" } }],
      usage: { total_tokens: 9 },
    });

    const result = await new OpenAIImageProvider().generate(chatRequest());

    expect(mockOpenAI.chatCreate).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hola" }],
    });
    expect(result.output).toEqual({ type: "text", content: "answer" });
  });
});

describe("MockImageProvider", () => {
  it("returns a placeholder image after a short delay", async () => {
    jest.useFakeTimers();
    const promise = new MockImageProvider().generate(
      chatRequest({
        taskType: "image-generation",
        parameters: { width: 640, height: 360 },
      }),
    );
    jest.advanceTimersByTime(500);
    const result = await promise;

    expect(result.output).toMatchObject({
      type: "image",
      width: 640,
      height: 360,
    });
    expect((result.output as { url: string }).url).toContain("640x360");
    expect(new MockImageProvider().validateConfig()).toBe(true);
  });
});

describe("SiliconFlowVideoProvider", () => {
  const provider = new SiliconFlowVideoProvider();

  async function runWithPolling<T>(
    promise: Promise<T>,
    polls: number,
  ): Promise<T> {
    for (let i = 0; i < polls; i++) await jest.advanceTimersByTimeAsync(5000);
    return promise;
  }

  beforeEach(() => jest.useFakeTimers());

  it("submits a job and polls until the video is ready", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ requestId: "req-1" }))
      .mockResolvedValueOnce(jsonResponse({ status: "InProgress" }))
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(errorResponse(502, "bad gateway"))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "Succeed",
          results: { videos: [{ url: "https://sf/v.mp4" }] },
        }),
      );

    const result = await runWithPolling(
      provider.generate(
        chatRequest({ taskType: "video-generation", prompt: "waves" }),
      ),
      4,
    );

    const submit = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(submit).toEqual({
      model: "Wan-AI/Wan2.2-T2V-A14B",
      prompt: "waves",
      image_size: "1280x720",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      requestId: "req-1",
    });
    expect(result.output).toEqual({
      type: "video",
      url: "https://sf/v.mp4",
      width: 1280,
      height: 720,
    });
  });

  it("sends the source image only for image-to-video models", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { request_id: "req-2" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "Succeed",
          results: { videos: [{ url: "u" }] },
        }),
      );

    await runWithPolling(
      provider.generateVideo(
        chatRequest({
          taskType: "video-generation",
          model: "Wan-AI/Wan2.2-I2V-A14B" as never,
          parameters: { imageUrl: "https://in.png" },
        }),
      ),
      1,
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).image).toBe(
      "https://in.png",
    );
  });

  it("fails when generation fails or no request id is returned", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ requestId: "req-3" }))
      .mockResolvedValueOnce(
        jsonResponse({ status: "Failed", reason: "NSFW content" }),
      );
    const failed = provider.generate(
      chatRequest({ taskType: "video-generation" }),
    );
    const assertion = expect(failed).rejects.toThrow(
      "SiliconFlow video generation failed: NSFW content",
    );
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;

    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: true }));
    await expect(
      provider.generate(chatRequest({ taskType: "video-generation" })),
    ).rejects.toThrow("SiliconFlow returned no request_id");
  });

  it("times out after 120 polls (10 minutes)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ requestId: "req-4" }));
    fetchMock.mockImplementation(async () =>
      jsonResponse({ status: "InQueue" }),
    );

    const slow = provider.generate(
      chatRequest({ taskType: "video-generation" }),
    );
    const assertion = expect(slow).rejects.toThrow(
      "timed out after 10 minutes",
    );
    await jest.advanceTimersByTimeAsync(120 * 5000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(121);
  });

  it("does not generate images", async () => {
    await expect(provider.generateImage({ prompt: "x" })).rejects.toThrow(
      "does not support image generation",
    );
  });
});

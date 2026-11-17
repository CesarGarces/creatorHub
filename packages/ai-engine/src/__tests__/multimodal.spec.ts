import type { AIRequest } from "@creator-hub/shared-types";
import { buildUserMessageContent } from "../providers/message-content";
import { OpenRouterProvider } from "../providers/openrouter.provider";
import { SiliconFlowProvider } from "../providers/siliconflow.provider";
import type { AIGatewayInterface } from "../gateways/ai-gateway.interface";

const FRAME_A = "data:image/jpeg;base64,AAAA";
const FRAME_B = "data:image/jpeg;base64,BBBB";

function visionRequest(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    taskType: "text-generation",
    model: "google/gemini-2.5-flash" as AIRequest["model"],
    prompt: "Find the highlights",
    images: [
      { url: FRAME_A, caption: "Frame 1 at 00:05", detail: "low" },
      { url: FRAME_B },
    ],
    ...overrides,
  };
}

describe("buildUserMessageContent", () => {
  it("keeps plain text when no image is attached", () => {
    expect(buildUserMessageContent({ prompt: "Hi" })).toBe("Hi");
    expect(buildUserMessageContent({ prompt: "Hi", images: [] })).toBe("Hi");
  });

  it("sends the prompt, then each image preceded by its caption", () => {
    expect(buildUserMessageContent(visionRequest())).toEqual([
      { type: "text", text: "Find the highlights" },
      { type: "text", text: "Frame 1 at 00:05" },
      { type: "image_url", image_url: { url: FRAME_A, detail: "low" } },
      { type: "image_url", image_url: { url: FRAME_B, detail: "auto" } },
    ]);
  });
});

describe("OpenRouterProvider — vision input", () => {
  function gateway(): AIGatewayInterface {
    return {
      type: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      validateConfig: jest.fn().mockReturnValue(true),
      chatCompletion: jest.fn().mockResolvedValue({
        id: "r1",
        model: "google/gemini-2.5-flash",
        content: "{}",
      }),
      chatCompletionStream: jest.fn(),
      imageGeneration: jest.fn(),
      listModels: jest.fn().mockResolvedValue([]),
      getModel: jest.fn(),
      getRateLimit: jest.fn(),
    };
  }

  it("declares image input support", () => {
    expect(new OpenRouterProvider(gateway()).supportsImageInput).toBe(true);
  });

  it("forwards images as OpenAI-compatible content parts after the system prompt", async () => {
    const gw = gateway();
    await new OpenRouterProvider(gw).generate(
      visionRequest({ parameters: { systemPrompt: "You edit videos" } }),
    );

    const { messages } = (gw.chatCompletion as jest.Mock).mock.calls[0][0];
    expect(messages[0]).toEqual({ role: "system", content: "You edit videos" });
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toHaveLength(4);
    expect(messages[1].content[2]).toEqual({
      type: "image_url",
      image_url: { url: FRAME_A, detail: "low" },
    });
  });
});

describe("SiliconFlowProvider — vision input", () => {
  const realFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.SILICONFLOW_API_KEY = "sf-key";
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.SILICONFLOW_API_KEY;
  });

  it("declares image input support", () => {
    expect(new SiliconFlowProvider().supportsImageInput).toBe(true);
  });

  it("sends the frames in the user message", async () => {
    await new SiliconFlowProvider().generate(
      visionRequest({ model: "Qwen/Qwen2.5-VL-72B-Instruct" as never }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("Qwen/Qwen2.5-VL-72B-Instruct");
    expect(body.messages).toEqual([
      {
        role: "user",
        content: buildUserMessageContent(visionRequest()),
      },
    ]);
  });

  it("still sends plain text to text-only requests", async () => {
    await new SiliconFlowProvider().generate(
      visionRequest({ images: undefined }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages).toEqual([
      { role: "user", content: "Find the highlights" },
    ]);
  });
});

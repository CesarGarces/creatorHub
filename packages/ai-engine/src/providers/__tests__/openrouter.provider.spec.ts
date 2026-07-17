import { OpenRouterProvider } from "../openrouter.provider";
import type { AIGatewayInterface } from "../../gateways/ai-gateway.interface";

describe("OpenRouterProvider", () => {
  let provider: OpenRouterProvider;
  let mockGateway: AIGatewayInterface;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-api-key";

    mockGateway = {
      type: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      validateConfig: jest.fn().mockReturnValue(true),
      chatCompletion: jest.fn().mockResolvedValue({
        id: "test-id",
        model: "google/gemini-2.5-flash",
        content: "Hello from OpenRouter!",
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        finishReason: "stop",
      }),
      chatCompletionStream: jest.fn(),
      imageGeneration: jest.fn().mockResolvedValue({
        id: "img-123",
        model: "openai/gpt-image-1-mini",
        imageUrl: "https://example.com/image.png",
        usage: {
          promptTokens: 100,
          completionTokens: 0,
          totalTokens: 100,
        },
      }),
      listModels: jest.fn().mockResolvedValue([]),
      getModel: jest.fn(),
      getRateLimit: jest.fn(),
    };

    provider = new OpenRouterProvider(mockGateway);
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  describe("properties", () => {
    it("should have correct name", () => {
      expect(provider.name).toBe("openrouter");
    });

    it("should have correct tier", () => {
      expect(provider.tier).toBe("pro");
    });

    it("should support multiple task types", () => {
      expect(provider.supportedTasks).toContain("image-generation");
      expect(provider.supportedTasks).toContain("text-generation");
      expect(provider.supportedTasks).toContain("video-generation");
    });
  });

  describe("validateConfig", () => {
    it("should return true when API key is configured", () => {
      expect(provider.validateConfig()).toBe(true);
    });

    it("should return false when API key is missing", () => {
      delete process.env.OPENROUTER_API_KEY;
      const p = new OpenRouterProvider(mockGateway);
      expect(p.validateConfig()).toBe(false);
    });
  });

  describe("generate", () => {
    it("should generate text response", async () => {
      const result = await provider.generate({
        taskType: "text-generation",
        prompt: "Hello",
      });

      expect(result.provider).toBe("openrouter");
      expect(result.output.type).toBe("text");
      expect(result.output).toHaveProperty("content", "Hello from OpenRouter!");
    });

    it("should call gateway with correct parameters", async () => {
      await provider.generate({
        taskType: "text-generation",
        prompt: "Test prompt",
        parameters: {
          temperature: 0.5,
          maxTokens: 1000,
        },
      });

      expect(mockGateway.chatCompletion).toHaveBeenCalledWith({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: "Test prompt" }],
        temperature: 0.5,
        maxTokens: 1000,
      });
    });

    it("should throw error when gateway is not configured", async () => {
      const p = new OpenRouterProvider();
      await expect(
        p.generate({
          taskType: "text-generation",
          prompt: "Hello",
        }),
      ).rejects.toThrow("OpenRouter gateway not configured");
    });
  });

  describe("generateImage", () => {
    it("should generate image", async () => {
      const result = await provider.generateImage({
        prompt: "A sunset",
        width: 1024,
        height: 1024,
      });

      expect(result.provider).toBe("openrouter");
      expect(result.output.type).toBe("image");
      expect(result.output).toHaveProperty(
        "url",
        "https://example.com/image.png",
      );
    });

    it("should call gateway with correct parameters", async () => {
      await provider.generateImage({
        prompt: "A cat",
        negativePrompt: "blurry",
        width: 512,
        height: 512,
        model: "openai/gpt-image-1-mini",
      });

      expect(mockGateway.imageGeneration).toHaveBeenCalledWith({
        model: "openai/gpt-image-1-mini",
        prompt: "A cat",
        negativePrompt: "blurry",
        width: 512,
        height: 512,
        imageUrl: undefined,
      });
    });
  });

  describe("generateStream", () => {
    it("should yield stream chunks", async () => {
      const mockStream = async function* () {
        yield { chunk: "Hello", done: false };
        yield { chunk: " World", done: false };
        yield {
          chunk: "",
          done: true,
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      };

      (mockGateway.chatCompletionStream as jest.Mock).mockImplementation(
        mockStream,
      );

      const chunks: string[] = [];
      for await (const chunk of provider.generateStream({
        taskType: "text-generation",
        prompt: "Hello",
      })) {
        if (chunk.type === "content" && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(["Hello", " World"]);
    });
  });

  describe("setGateway", () => {
    it("should update gateway instance", async () => {
      const newGateway = {
        ...mockGateway,
        chatCompletion: jest.fn().mockResolvedValue({
          id: "new-id",
          model: "new-model",
          content: "New response",
        }),
      };

      provider.setGateway(newGateway);
      const result = await provider.generate({
        taskType: "text-generation",
        prompt: "Hello",
      });

      expect(result.output).toHaveProperty("content", "New response");
    });
  });
});

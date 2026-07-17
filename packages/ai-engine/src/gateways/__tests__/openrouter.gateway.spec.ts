import { OpenRouterGateway } from "../openrouter.gateway";

describe("OpenRouterGateway", () => {
  let gateway: OpenRouterGateway;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-api-key";
    gateway = new OpenRouterGateway();
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  describe("validateConfig", () => {
    it("should return true when API key is configured", () => {
      expect(gateway.validateConfig()).toBe(true);
    });

    it("should return false when API key is missing", () => {
      delete process.env.OPENROUTER_API_KEY;
      const g = new OpenRouterGateway();
      expect(g.validateConfig()).toBe(false);
    });
  });

  describe("listModels", () => {
    it("should fetch models from OpenRouter API", async () => {
      const mockResponse = {
        data: [
          {
            id: "google/gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            description: "Fast and efficient",
            pricing: {
              prompt: "0.00000015",
              completion: "0.0000006",
            },
            context_length: 1048576,
            top_provider: {
              max_completion_tokens: 65536,
            },
            architecture: {
              modality: "text+image",
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const models = await gateway.listModels();

      expect(models).toHaveLength(1);
      expect(models[0]?.id).toBe("google/gemini-2.5-flash");
      expect(models[0]?.name).toBe("Gemini 2.5 Flash");
      expect(models[0]?.taskType).toBe("text-generation");
      expect(models[0]?.supportsVision).toBe(true);
    });

    it("should cache models for 1 hour", async () => {
      const mockResponse = {
        data: [
          {
            id: "google/gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            pricing: { prompt: "0.00000015", completion: "0.0000006" },
            context_length: 1048576,
          },
        ],
      };
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      global.fetch = fetchMock;

      await gateway.listModels();
      await gateway.listModels();

      // Should only fetch once due to caching
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("chatCompletion", () => {
    it("should send chat completion request", async () => {
      const mockResponse = {
        id: "test-id",
        model: "google/gemini-2.5-flash",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello!",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await gateway.chatCompletion({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result.content).toBe("Hello!");
      expect(result.usage?.totalTokens).toBe(15);
    });

    it("should handle API errors", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(
        gateway.chatCompletion({
          model: "test-model",
          messages: [{ role: "user", content: "Hi" }],
        }),
      ).rejects.toThrow("OpenRouter API error 401");
    });
  });

  describe("imageGeneration", () => {
    it("should generate image via images endpoint", async () => {
      const modelsResponse = {
        data: [
          {
            id: "openai/gpt-image-1-mini",
            name: "GPT Image 1 Mini",
            pricing: { prompt: "0", completion: "0", image: "0.02" },
            context_length: 4096,
            architecture: { modality: "image" },
          },
        ],
      };

      const imageResponse = {
        id: "img-123",
        data: [
          {
            url: "https://example.com/image.png",
          },
        ],
        usage: {
          prompt_tokens: 100,
          total_tokens: 100,
        },
      };

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is listModels
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(modelsResponse),
          });
        }
        // Second call is image generation
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(imageResponse),
        });
      });

      const result = await gateway.imageGeneration({
        model: "openai/gpt-image-1-mini",
        prompt: "A sunset",
        width: 1024,
        height: 1024,
      });

      expect(result.imageUrl).toBe("https://example.com/image.png");
    });
  });

  describe("getModel", () => {
    it("should return model info by ID", async () => {
      const mockResponse = {
        data: [
          {
            id: "google/gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            pricing: { prompt: "0.00000015", completion: "0.0000006" },
            context_length: 1048576,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const model = await gateway.getModel("google/gemini-2.5-flash");
      expect(model?.id).toBe("google/gemini-2.5-flash");
    });

    it("should return null for unknown model", async () => {
      const mockResponse = { data: [] };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const model = await gateway.getModel("unknown/model");
      expect(model).toBeNull();
    });
  });
});

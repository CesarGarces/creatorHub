import { SiliconFlowGateway } from "../siliconflow.gateway";

describe("SiliconFlowGateway", () => {
  let gateway: SiliconFlowGateway;

  beforeEach(() => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";
    gateway = new SiliconFlowGateway();
  });

  afterEach(() => {
    delete process.env.SILICONFLOW_API_KEY;
  });

  describe("validateConfig", () => {
    it("should return true when API key is configured", () => {
      expect(gateway.validateConfig()).toBe(true);
    });

    it("should return false when API key is missing", () => {
      delete process.env.SILICONFLOW_API_KEY;
      const g = new SiliconFlowGateway();
      expect(g.validateConfig()).toBe(false);
    });
  });

  describe("listModels", () => {
    it("should return known models", async () => {
      const models = await gateway.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id === "black-forest-labs/FLUX.2-pro")).toBe(
        true,
      );
    });
  });

  describe("chatCompletion", () => {
    it("should send chat completion request", async () => {
      const mockResponse = {
        id: "test-id",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello from SiliconFlow!",
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
        model: "deepseek-ai/DeepSeek-V4-Flash",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result.content).toBe("Hello from SiliconFlow!");
      expect(result.usage?.totalTokens).toBe(15);
    });
  });

  describe("imageGeneration", () => {
    it("should generate image", async () => {
      const mockResponse = {
        images: [
          {
            url: "https://siliconflow.example.com/image.png",
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await gateway.imageGeneration({
        model: "black-forest-labs/FLUX.2-pro",
        prompt: "A cat",
        width: 1024,
        height: 1024,
      });

      expect(result.imageUrl).toBe("https://siliconflow.example.com/image.png");
    });
  });

  describe("videoGeneration", () => {
    it("should submit video generation request", async () => {
      const mockResponse = {
        request_id: "video-123",
        status: "pending",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await gateway.videoGeneration({
        model: "Wan-AI/Wan2.2-T2V-A14B",
        prompt: "A dancing cat",
      });

      expect(result.id).toBe("video-123");
      expect(result.model).toBe("Wan-AI/Wan2.2-T2V-A14B");
    });
  });

  describe("getVideoStatus", () => {
    it("should get video status", async () => {
      const mockResponse = {
        request_id: "video-123",
        status: "Succeed",
        video: {
          url: "https://siliconflow.example.com/video.mp4",
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await gateway.getVideoStatus("video-123");
      expect(result.status).toBe("Succeed");
      expect(result.videoUrl).toBe("https://siliconflow.example.com/video.mp4");
    });
  });
});

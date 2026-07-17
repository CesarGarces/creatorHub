import { GatewayFactory } from "../gateway-factory";
import { OpenRouterGateway } from "../openrouter.gateway";
import { SiliconFlowGateway } from "../siliconflow.gateway";

describe("GatewayFactory", () => {
  let factory: GatewayFactory;
  let openRouterGateway: OpenRouterGateway;
  let siliconFlowGateway: SiliconFlowGateway;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.SILICONFLOW_API_KEY = "test-siliconflow-key";

    openRouterGateway = new OpenRouterGateway();
    siliconFlowGateway = new SiliconFlowGateway();

    factory = new GatewayFactory(openRouterGateway, siliconFlowGateway);
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.SILICONFLOW_API_KEY;
  });

  describe("getGatewayByType", () => {
    it("should return OpenRouter gateway", () => {
      const gateway = factory.getGatewayByType("openrouter");
      expect(gateway).toBe(openRouterGateway);
    });

    it("should return SiliconFlow gateway", () => {
      const gateway = factory.getGatewayByType("siliconflow");
      expect(gateway).toBe(siliconFlowGateway);
    });
  });

  describe("getGatewayForProvider", () => {
    it("should return OpenRouter for openrouter provider", () => {
      const gateway = factory.getGatewayForProvider("openrouter");
      expect(gateway).toBe(openRouterGateway);
    });

    it("should return SiliconFlow for siliconflow provider", () => {
      const gateway = factory.getGatewayForProvider("siliconflow");
      expect(gateway).toBe(siliconFlowGateway);
    });

    it("should return SiliconFlow for z-image-turbo provider", () => {
      const gateway = factory.getGatewayForProvider("z-image-turbo");
      expect(gateway).toBe(siliconFlowGateway);
    });

    it("should return undefined for unknown provider", () => {
      const gateway = factory.getGatewayForProvider("unknown-provider");
      expect(gateway).toBeUndefined();
    });
  });

  describe("getGatewayForModel", () => {
    it("should return OpenRouter for Google models", () => {
      const gateway = factory.getGatewayForModel("google/gemini-2.5-flash");
      expect(gateway).toBe(openRouterGateway);
    });

    it("should return OpenRouter for OpenAI models", () => {
      const gateway = factory.getGatewayForModel("openai/gpt-image-1-mini");
      expect(gateway).toBe(openRouterGateway);
    });

    it("should return SiliconFlow for FLUX models", () => {
      const gateway = factory.getGatewayForModel(
        "black-forest-labs/FLUX.2-pro",
      );
      expect(gateway).toBe(siliconFlowGateway);
    });

    it("should return SiliconFlow for DeepSeek models", () => {
      const gateway = factory.getGatewayForModel(
        "deepseek-ai/DeepSeek-V4-Flash",
      );
      expect(gateway).toBe(siliconFlowGateway);
    });
  });

  describe("isGatewayAvailable", () => {
    it("should return true for available gateways", () => {
      expect(factory.isGatewayAvailable("openrouter")).toBe(true);
      expect(factory.isGatewayAvailable("siliconflow")).toBe(true);
    });

    it("should return false for unavailable gateways", () => {
      // gateway with no API key won't be registered
      delete process.env.OPENROUTER_API_KEY;
      const f = new GatewayFactory(new OpenRouterGateway(), siliconFlowGateway);
      expect(f.isGatewayAvailable("openrouter")).toBe(false);
    });
  });

  describe("registerGateway", () => {
    it("should register custom gateway with valid type", () => {
      const customGateway = {
        type: "openrouter" as const,
        baseUrl: "https://custom.api",
        validateConfig: () => true,
        chatCompletion: jest.fn(),
        chatCompletionStream: jest.fn(),
        imageGeneration: jest.fn(),
        listModels: jest.fn(),
        getModel: jest.fn(),
        getRateLimit: jest.fn(),
      };

      factory.registerGateway(customGateway);
      expect(factory.getGatewayByType("openrouter")).toBe(customGateway);
    });
  });
});

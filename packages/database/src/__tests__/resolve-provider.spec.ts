import { resolveProviderSlug } from "../resolve-provider";

// Mock the prisma module
const mockProviderFindUnique = jest.fn();
const mockModelMetadataFindUnique = jest.fn();

jest.mock("../index", () => ({
  get prisma() {
    return {
      provider: { findUnique: mockProviderFindUnique },
      modelMetadata: { findUnique: mockModelMetadataFindUnique },
    };
  },
}));

describe("resolveProviderSlug", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when input is a Provider slug", () => {
    it("returns the input directly if Provider exists", async () => {
      mockProviderFindUnique.mockResolvedValue({
        id: "1",
        slug: "openrouter",
        name: "OpenRouter",
      });

      const result = await resolveProviderSlug("openrouter");

      expect(result).toBe("openrouter");
      expect(mockProviderFindUnique).toHaveBeenCalledWith({
        where: { slug: "openrouter" },
      });
      expect(mockModelMetadataFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("when input is a ModelMetadata cuid", () => {
    it("returns the providerSlug for the matching model", async () => {
      mockProviderFindUnique.mockResolvedValue(null);
      mockModelMetadataFindUnique.mockResolvedValue({
        id: "clxyz123",
        providerSlug: "openrouter",
        modelId: "openai/gpt-4o",
      });

      const result = await resolveProviderSlug("clxyz123");

      expect(result).toBe("openrouter");
      expect(mockModelMetadataFindUnique).toHaveBeenCalledWith({
        where: { id: "clxyz123" },
        select: { providerSlug: true },
      });
    });
  });

  describe("when input is a ModelMetadata modelId string", () => {
    it("returns the providerSlug for openrouter model", async () => {
      mockProviderFindUnique.mockResolvedValue(null);
      mockModelMetadataFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ providerSlug: "openrouter" });

      const result = await resolveProviderSlug("deepseek-ai/DeepSeek-V4-Flash");

      expect(result).toBe("openrouter");
      expect(mockModelMetadataFindUnique).toHaveBeenCalledWith({
        where: {
          providerSlug_modelId: {
            providerSlug: "openrouter",
            modelId: "deepseek-ai/DeepSeek-V4-Flash",
          },
        },
        select: { providerSlug: true },
      });
    });
  });

  describe("when input matches nothing", () => {
    it("returns the input as-is (fallback)", async () => {
      mockProviderFindUnique.mockResolvedValue(null);
      mockModelMetadataFindUnique.mockResolvedValue(null);

      const result = await resolveProviderSlug("unknown-slug");

      expect(result).toBe("unknown-slug");
    });
  });

  describe("input validation", () => {
    it("throws for null/undefined input", async () => {
      await expect(resolveProviderSlug(null as any)).rejects.toThrow(
        "Provider identifier is required",
      );
      await expect(resolveProviderSlug(undefined as any)).rejects.toThrow(
        "Provider identifier is required",
      );
    });

    it("throws for empty string", async () => {
      await expect(resolveProviderSlug("")).rejects.toThrow(
        "Provider identifier cannot be empty",
      );
      await expect(resolveProviderSlug("   ")).rejects.toThrow(
        "Provider identifier cannot be empty",
      );
    });

    it("throws for string longer than 255 characters", async () => {
      const longString = "a".repeat(256);
      await expect(resolveProviderSlug(longString)).rejects.toThrow(
        "Provider identifier is too long",
      );
    });

    it("trims whitespace before lookup", async () => {
      mockProviderFindUnique.mockResolvedValue({
        id: "1",
        slug: "openrouter",
      });

      const result = await resolveProviderSlug("  openrouter  ");

      expect(result).toBe("openrouter");
      expect(mockProviderFindUnique).toHaveBeenCalledWith({
        where: { slug: "openrouter" },
      });
    });
  });
});

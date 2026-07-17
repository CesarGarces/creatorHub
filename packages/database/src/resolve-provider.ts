import { prisma } from "./index";

/**
 * Resolves a provider input to a valid Provider slug.
 *
 * The frontend's `ProviderSelect` sends the ModelMetadata `modelId` (e.g. "deepseek-ai/DeepSeek-V4-Flash"),
 * but backend services expect a `Provider.slug`. This function handles all cases:
 *
 * 1. If input is already a Provider slug → returns it directly
 * 2. If input is a ModelMetadata ID (cuid) → looks up the providerSlug
 * 3. If input is a ModelMetadata modelId string → looks up the providerSlug (prefers active providers)
 * 4. If nothing matches → returns the input as-is (let caller handle the error)
 */
export async function resolveProviderSlug(input: string): Promise<string> {
  // Validate input
  if (typeof input !== "string") {
    throw new Error("Provider identifier is required");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Provider identifier cannot be empty");
  }

  if (trimmed.length > 255) {
    throw new Error("Provider identifier is too long (max 255 characters)");
  }

  // 1. Check if it's already a Provider slug
  const existingProvider = await prisma.provider.findUnique({
    where: { slug: trimmed },
  });
  if (existingProvider) return trimmed;

  // 2. Check if it's a ModelMetadata ID (cuid format)
  const modelById = await prisma.modelMetadata.findUnique({
    where: { id: trimmed },
    select: { providerSlug: true },
  });
  if (modelById) return modelById.providerSlug;

  // 3. Check if it's a ModelMetadata modelId string (e.g. "deepseek-ai/DeepSeek-V4-Flash")
  // Find ALL models with this modelId and prefer those with active providers
  const allModels = await prisma.modelMetadata.findMany({
    where: { modelId: trimmed },
    select: { providerSlug: true },
  });

  if (allModels.length > 0) {
    // Get all unique provider slugs
    const providerSlugs = [...new Set(allModels.map((m) => m.providerSlug))];

    // Check which providers are active
    const activeProviders = await prisma.provider.findMany({
      where: {
        slug: { in: providerSlugs },
        isActive: true,
      },
      select: { slug: true },
    });

    const activeSlugs = new Set(activeProviders.map((p) => p.slug));

    // Prefer models with active providers
    const activeModel = allModels.find((m) => activeSlugs.has(m.providerSlug));
    if (activeModel) {
      return activeModel.providerSlug;
    }
    // Fallback to first model if none are active
    const firstModel = allModels[0];
    if (firstModel) {
      return firstModel.providerSlug;
    }
  }

  // 4. Fallback — return as-is
  return trimmed;
}

import { PrismaClient } from "../generated/client";
const prisma = new PrismaClient();

async function main() {
  // Create tools (only create if not exists - do NOT update existing)
  const tools = [
    {
      id: "thumbnail-generator",
      name: "Thumbnail Generator",
      description: "AI-powered thumbnail generation for YouTube videos",
      category: "image",
      creditsPerUse: 1,
      icon: "🎨",
    },
    {
      id: "content-translator",
      name: "Content Translator",
      description:
        "Translate content across multiple languages with AI precision",
      category: "translator",
      creditsPerUse: 1,
      icon: "🌐",
    },
    {
      id: "video-generator",
      name: "Video Generator",
      description: "Generate stunning AI videos with Wan AI models",
      category: "video",
      creditsPerUse: 50,
      icon: "🎬",
    },
    {
      id: "x-search-trends",
      name: "X Trend Research",
      description: "Search and analyze trending topics on X (Twitter).",
      category: "social",
      creditsPerUse: 15,
      icon: "📡",
    },
    {
      id: "x-post-tweet",
      name: "Post to X",
      description: "Publish a tweet to your connected X (Twitter) account.",
      category: "social",
      creditsPerUse: 5,
      icon: "💬",
    },
  ];

  for (const tool of tools) {
    const exists = await prisma.tool.findUnique({ where: { id: tool.id } });
    if (!exists) {
      await prisma.tool.create({ data: tool });
    }
  }

  // Create default subscription plans (only create if not exists)
  const plans = [
    {
      id: "free",
      name: "Free",
      description: "Get started with basic tools",
      price: 0,
      creditsPerMonth: 100,
      features: ["Basic tools", "Standard quality", "Community support"],
      tools: ["thumbnail-generator"],
    },
    {
      id: "starter",
      name: "Starter",
      description: "For growing creators",
      price: 999,
      creditsPerMonth: 1000,
      features: ["All tools", "HD quality", "Priority support", "No watermark"],
      tools: ["thumbnail-generator", "title-generator"],
    },
    {
      id: "pro",
      name: "Pro",
      description: "For professional creators",
      price: 2999,
      creditsPerMonth: 5000,
      features: [
        "All tools",
        "4K quality",
        "Priority support",
        "No watermark",
        "API access",
        "Custom branding",
      ],
      tools: ["*"],
    },
  ];

  for (const plan of plans) {
    const exists = await prisma.subscriptionPlan.findUnique({
      where: { id: plan.id },
    });
    if (!exists) {
      await prisma.subscriptionPlan.create({ data: plan });
    }
  }

  // ──────────────────────────────────────────────
  // CREDIT PLANS (only create if not exists)
  // ──────────────────────────────────────────────
  const creditPlans = [
    {
      slug: "PAY_AS_YOU_GO",
      name: "Pay as you go",
      description: "Buy credits anytime, no commitment",
      usdAmount: 10.0,
      creditsGiven: 1000,
      sortOrder: 0,
    },
    {
      slug: "STARTER",
      name: "Starter",
      description: "Best value for getting started",
      usdAmount: 25.0,
      creditsGiven: 2700,
      sortOrder: 1,
    },
    {
      slug: "PRO",
      name: "Pro",
      description: "Maximum credits for power users",
      usdAmount: 50.0,
      creditsGiven: 6000,
      sortOrder: 2,
    },
  ];

  for (const cp of creditPlans) {
    const exists = await prisma.creditPlan.findUnique({
      where: { slug: cp.slug },
    });
    if (!exists) {
      await prisma.creditPlan.create({ data: cp });
    }
  }

  // Seed AI providers (only create if not exists - do NOT update existing)
  const providers = [
    {
      slug: "z-image-turbo",
      name: "Z-Image Turbo",
      model: "Tongyi-MAI/Z-Image-Turbo",
      tier: "FREE" as const,
      costPerCredit: 10,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "siliconflow",
      name: "FLUX 2 Pro",
      model: "black-forest-labs/FLUX.2-pro",
      tier: "FREE" as const,
      costPerCredit: 10,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "gemini",
      name: "Gemini",
      model: "gemini-2.0-flash",
      tier: "PRO" as const,
      costPerCredit: 5,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "openai",
      name: "DALL-E 3",
      model: "dall-e-3",
      tier: "PRO" as const,
      costPerCredit: 10,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "flux",
      name: "Flux",
      model: "flux-1.1-pro",
      tier: "PRO" as const,
      costPerCredit: 6,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "stability-ai",
      name: "Stability AI",
      model: "stable-diffusion-xl-1024-v1-0",
      tier: "PRO" as const,
      costPerCredit: 8,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "deepseek-v4",
      name: "DeepSeek V4 Flash",
      model: "deepseek-ai/DeepSeek-V4-Flash",
      tier: "FREE" as const,
      costPerCredit: 5,
      isActive: true,
      supportedTasks: ["text-generation", "translator"],
    },
    {
      slug: "glm-5.2",
      name: "GLM-5.2",
      model: "zai-org/GLM-5.2",
      tier: "PRO" as const,
      costPerCredit: 10,
      isActive: true,
      supportedTasks: ["text-generation"],
    },
    {
      slug: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      model: "deepseek-ai/DeepSeek-V4-Pro",
      tier: "PRO" as const,
      costPerCredit: 10,
      isActive: true,
      supportedTasks: ["text-generation", "translator"],
    },
    {
      slug: "siliconflow-video",
      name: "Wan AI Video",
      model: "Wan-AI/Wan2.2-T2V-A14B",
      tier: "FREE" as const,
      costPerCredit: 50,
      isActive: true,
      supportedTasks: ["video"],
    },
  ];

  for (const p of providers) {
    const exists = await prisma.provider.findUnique({
      where: { slug: p.slug },
    });
    if (!exists) {
      await prisma.provider.create({ data: p });
    }
  }

  const modes = [
    {
      slug: "image",
      name: "Image Generation",
      description: "Generate images from text prompts",
      icon: "🎨",
      color: "#8b5cf6",
    },
    {
      slug: "video",
      name: "Video Generation",
      description: "Generate videos from text or images",
      icon: "🎬",
      color: "#ef4444",
    },
    {
      slug: "chat",
      name: "Chat",
      description: "Conversational AI and text generation",
      icon: "💬",
      color: "#3b82f6",
    },
    {
      slug: "translation",
      name: "Translation",
      description: "Translate content between languages",
      icon: "🌐",
      color: "#10b981",
    },
    {
      slug: "analysis",
      name: "Analysis",
      description: "Analyze text, trends, and data",
      icon: "📊",
      color: "#f59e0b",
    },
    {
      slug: "editing",
      name: "Image Editing",
      description: "Edit and modify existing images",
      icon: "✏️",
      color: "#ec4899",
    },
    {
      slug: "speech",
      name: "Speech to Text",
      description: "Convert audio to text",
      icon: "🎤",
      color: "#06b6d4",
    },
    {
      slug: "social",
      name: "Social Media",
      description: "Post and manage social media content",
      icon: "📱",
      color: "#6366f1",
    },
  ];

  for (const mode of modes) {
    const exists = await prisma.mode.findUnique({ where: { slug: mode.slug } });
    if (!exists) {
      await prisma.mode.create({ data: mode });
    }
  }

  // ──────────────────────────────────────────────
  // Seed AI Model Metadata (OpenRouter models)
  // ──────────────────────────────────────────────

  const openrouterModels = [
    // Image Generation Models
    {
      providerSlug: "openrouter",
      modelId: "openai/gpt-image-1-mini",
      displayName: "GPT Image 1 Mini",
      taskType: "image-generation",
      tier: "PRO" as const,
      supportsStreaming: false,
      supportsVision: false,
      imagePricePerGen: 0.02,
      isActive: true,
      creditCost: 10,
      profitMargin: 2.0,
      description: "Fast and affordable image generation by OpenAI",
      tags: ["fast", "cheap", "openai"],
    },
    {
      providerSlug: "openrouter",
      modelId: "google/gemini-3.1-flash-image",
      displayName: "Gemini 3.1 Flash Image",
      taskType: "image-generation",
      tier: "PRO" as const,
      supportsStreaming: false,
      supportsVision: true,
      imagePricePerGen: 0.03,
      isActive: true,
      creditCost: 12,
      profitMargin: 2.0,
      description: "Google's latest image generation model",
      tags: ["fast", "google", "multimodal"],
    },
    {
      providerSlug: "openrouter",
      modelId: "black-forest-labs/flux-1.1-pro",
      displayName: "Flux 1.1 Pro",
      taskType: "image-generation",
      tier: "PRO" as const,
      supportsStreaming: false,
      supportsVision: false,
      imagePricePerGen: 0.04,
      isActive: true,
      creditCost: 15,
      profitMargin: 2.0,
      description: "High-quality image generation by Black Forest Labs",
      tags: ["high-quality", "flux"],
    },

    // Text Generation Models (Chat)
    {
      providerSlug: "openrouter",
      modelId: "google/gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      taskType: "text-generation",
      tier: "PRO" as const,
      contextLength: 1048576,
      maxOutputTokens: 65536,
      supportsStreaming: true,
      supportsVision: true,
      promptPricePer1k: 0.00015,
      completionPricePer1k: 0.0006,
      isActive: true,
      creditCost: 3,
      profitMargin: 2.0,
      description: "Fast and efficient multimodal model by Google",
      tags: ["fast", "cheap", "google", "multimodal", "long-context"],
    },
    {
      providerSlug: "openrouter",
      modelId: "anthropic/claude-3.5-sonnet",
      displayName: "Claude 3.5 Sonnet",
      taskType: "text-generation",
      tier: "PRO" as const,
      contextLength: 200000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsVision: true,
      promptPricePer1k: 0.003,
      completionPricePer1k: 0.015,
      isActive: true,
      creditCost: 8,
      profitMargin: 2.0,
      description: "Anthropic's most capable model",
      tags: ["high-quality", "anthropic", "coding"],
    },
    {
      providerSlug: "openrouter",
      modelId: "meta-llama/llama-3.1-405b-instruct",
      displayName: "Llama 3.1 405B",
      taskType: "text-generation",
      tier: "PRO" as const,
      contextLength: 131072,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsVision: false,
      promptPricePer1k: 0.002,
      completionPricePer1k: 0.006,
      isActive: true,
      creditCost: 6,
      profitMargin: 2.0,
      description: "Meta's largest open-source model",
      tags: ["open-source", "meta", "long-context"],
    },
    {
      providerSlug: "openrouter",
      modelId: "deepseek/deepseek-chat",
      displayName: "DeepSeek Chat",
      taskType: "text-generation",
      tier: "PRO" as const,
      contextLength: 64000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsVision: false,
      promptPricePer1k: 0.00014,
      completionPricePer1k: 0.00028,
      isActive: true,
      creditCost: 2,
      profitMargin: 2.0,
      description: "DeepSeek's conversational model",
      tags: ["fast", "cheap", "deepseek"],
    },

    // Video Generation Models
    {
      providerSlug: "openrouter",
      modelId: "runway/video-generation",
      displayName: "Runway Video Generation",
      taskType: "video-generation",
      tier: "PRO" as const,
      supportsStreaming: false,
      supportsVision: false,
      imagePricePerGen: 0.5,
      isActive: false, // Disabled until pricing confirmed
      creditCost: 40,
      profitMargin: 2.0,
      description: "Professional video generation by Runway",
      tags: ["video", "professional"],
    },
  ];

  for (const model of openrouterModels) {
    const exists = await prisma.modelMetadata.findUnique({
      where: {
        providerSlug_modelId: {
          providerSlug: model.providerSlug,
          modelId: model.modelId,
        },
      },
    });
    if (!exists) {
      await prisma.modelMetadata.create({ data: model });
    }
  }

  // Add OpenRouter as a gateway provider
  const openrouterProviderExists = await prisma.provider.findUnique({
    where: { slug: "openrouter" },
  });
  if (!openrouterProviderExists) {
    await prisma.provider.create({
      data: {
        slug: "openrouter",
        name: "OpenRouter",
        model: "google/gemini-2.5-flash", // Default model
        tier: "PRO",
        costPerCredit: 5,
        isActive: true,
        supportedTasks: ["thumbnail", "text-generation", "video"],
        isGateway: true,
        config: {
          baseUrl: "https://openrouter.ai/api/v1",
          description: "Access 50+ AI models through a single API",
        },
      },
    });
  }

  console.log("Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

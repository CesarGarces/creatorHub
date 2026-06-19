import { PrismaClient } from "../generated/client";
const prisma = new PrismaClient();

async function main() {
  // Create tools (upsert to avoid duplicates on re-run)
  await prisma.tool.upsert({
    where: { id: "thumbnail-generator" },
    update: { icon: "🎨" },
    create: {
      id: "thumbnail-generator",
      name: "Thumbnail Generator",
      description: "AI-powered thumbnail generation for YouTube videos",
      category: "image",
      creditsPerUse: 1,
      icon: "🎨",
    },
  });

  await prisma.tool.upsert({
    where: { id: "content-translator" },
    update: { icon: "🌐" },
    create: {
      id: "content-translator",
      name: "Content Translator",
      description:
        "Translate content across multiple languages with AI precision",
      category: "translator",
      creditsPerUse: 1,
      icon: "🌐",
    },
  });

  // Create default subscription plans (upsert to avoid duplicates)
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
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {},
      create: plan,
    });
  }

  // ──────────────────────────────────────────────
  // CREDIT PLANS (admin-configurable pay-as-you-go)
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
    await prisma.creditPlan.upsert({
      where: { slug: cp.slug },
      update: {
        name: cp.name,
        description: cp.description,
        usdAmount: cp.usdAmount,
        creditsGiven: cp.creditsGiven,
        sortOrder: cp.sortOrder,
      },
      create: cp,
    });
  }

  // Seed AI providers
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
      supportedTasks: ["translator"],
    },
    {
      slug: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      model: "deepseek-ai/DeepSeek-V4-Pro",
      tier: "PRO" as const,
      costPerCredit: 10,
      isActive: true,
      supportedTasks: ["translator"],
    },
  ];

  for (const p of providers) {
    await prisma.provider.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        model: p.model,
        tier: p.tier,
        costPerCredit: p.costPerCredit,
        isActive: p.isActive,
        supportedTasks: p.supportedTasks,
      },
      create: p,
    });
  }

  console.log("Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

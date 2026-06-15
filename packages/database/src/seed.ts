import { PrismaClient } from "../generated/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create tools (upsert to avoid duplicates on re-run)
  await prisma.tool.upsert({
    where: { id: "thumbnail-generator" },
    update: {},
    create: {
      id: "thumbnail-generator",
      name: "Thumbnail Generator",
      description: "AI-powered thumbnail generation for YouTube videos",
      category: "image",
      creditsPerUse: 1,
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

  // Create or update admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@creatorhub.ai" },
    update: {
      passwordHash,
      role: "ADMIN",
      plan: "PREMIUM",
      freeCredits: 999999,
      purchasedCredits: 999999,
    },
    create: {
      email: "admin@creatorhub.ai",
      name: "Admin",
      passwordHash,
      role: "ADMIN",
      plan: "PREMIUM",
      freeCredits: 999999,
      purchasedCredits: 999999,
    },
  });
  console.log(`Admin ready: ${admin.email}`);

  // Seed AI providers
  const providers = [
    {
      slug: "z-image-turbo",
      name: "Z-Image Turbo",
      model: "Tongyi-MAI/Z-Image-Turbo",
      tier: "FREE" as const,
      costPerCredit: 1,
      isActive: true,
      supportedTasks: ["thumbnail"],
    },
    {
      slug: "siliconflow",
      name: "FLUX 2 Pro",
      model: "black-forest-labs/FLUX.2-pro",
      tier: "FREE" as const,
      costPerCredit: 1,
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

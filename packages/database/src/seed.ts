import { PrismaClient } from "../generated/client";

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

  // Create admin user if not exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@creatorhub.ai" },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email: "admin@creatorhub.ai",
        name: "Admin",
        role: "ADMIN",
        plan: "PREMIUM",
        freeCredits: 999999,
        purchasedCredits: 999999,
      },
    });
    console.log(`Admin created: ${admin.email}`);
  }

  console.log("Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

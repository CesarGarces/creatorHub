import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create tools
  await prisma.tool.createMany({
    data: [
      {
        id: "thumbnail-generator",
        name: "Thumbnail Generator",
        description: "AI-powered thumbnail generation for YouTube videos",
        category: "image",
        creditsPerUse: 1,
      },
    ],
    skipDuplicates: true,
  });

  // Create default subscription plans
  await prisma.subscriptionPlan.createMany({
    data: [
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
        features: [
          "All tools",
          "HD quality",
          "Priority support",
          "No watermark",
        ],
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
    ],
  });

  // Create admin user with unlimited credits
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

  console.log("Seed completed");
  console.log(`Admin: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

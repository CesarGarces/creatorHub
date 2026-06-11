import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: "admin@creatorhub.ai",
      name: "Admin",
      role: "ADMIN",
      credits: {
        create: {
          balance: 999999,
          lifetime: 999999,
        },
      },
    },
  });

  console.log("Seed completed");
  console.log(`Admin: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

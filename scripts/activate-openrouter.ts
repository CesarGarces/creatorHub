/**
 * Script to activate the OpenRouter provider
 * Run with: npx tsx scripts/activate-openrouter.ts
 */
import { prisma } from "../packages/database/src/index";

async function activateOpenRouter() {
  console.log("🔍 Checking OpenRouter provider...\n");

  const provider = await prisma.provider.findUnique({
    where: { slug: "openrouter" },
  });

  if (!provider) {
    console.log("❌ OpenRouter provider NOT FOUND in database");
    console.log("   Run: cd packages/database && npm run db:seed\n");
    await prisma.$disconnect();
    return;
  }

  console.log("📊 Current state:");
  console.log(`   - slug: ${provider.slug}`);
  console.log(`   - isActive: ${provider.isActive}`);
  console.log(
    `   - supportedTasks: ${JSON.stringify(provider.supportedTasks)}`,
  );
  console.log(`   - tier: ${provider.tier}\n`);

  if (provider.isActive) {
    console.log("✅ OpenRouter provider is already ACTIVE\n");
  } else {
    console.log("🔧 Activating OpenRouter provider...");
    await prisma.provider.update({
      where: { slug: "openrouter" },
      data: { isActive: true },
    });
    console.log("✅ OpenRouter provider ACTIVATED\n");
  }

  // Also ensure video-generation is in supportedTasks
  if (!provider.supportedTasks.includes("video-generation")) {
    console.log("🔧 Adding 'video-generation' to supportedTasks...");
    const updatedTasks = [...provider.supportedTasks, "video-generation"];
    await prisma.provider.update({
      where: { slug: "openrouter" },
      data: { supportedTasks: updatedTasks },
    });
    console.log("✅ supportedTasks updated\n");
  }

  // Verify final state
  const updated = await prisma.provider.findUnique({
    where: { slug: "openrouter" },
  });

  console.log("📊 Final state:");
  console.log(`   - isActive: ${updated?.isActive}`);
  console.log(
    `   - supportedTasks: ${JSON.stringify(updated?.supportedTasks)}\n`,
  );

  console.log("✅ Done! Try generating a video with Seedance now.\n");

  await prisma.$disconnect();
}

activateOpenRouter().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});

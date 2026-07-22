import { prisma } from "../packages/database/src/index";

async function diagnoseVideoGeneration() {
  console.log("🔍 Diagnosing Video Generation Setup\n");

  // 1. Check OpenRouter provider
  console.log("1️⃣ Checking OpenRouter provider...");
  const openrouterProvider = await prisma.provider.findUnique({
    where: { slug: "openrouter" },
  });

  if (!openrouterProvider) {
    console.log("   ❌ OpenRouter provider NOT FOUND in database");
    console.log("   → Run: npm run db:seed\n");
  } else {
    console.log("   ✅ OpenRouter provider exists");
    console.log(`   - isActive: ${openrouterProvider.isActive}`);
    console.log(
      `   - supportedTasks: ${JSON.stringify(openrouterProvider.supportedTasks)}`,
    );
    console.log(`   - isGateway: ${openrouterProvider.isGateway}\n`);

    if (!openrouterProvider.isActive) {
      console.log("   ⚠️  Provider is INACTIVE - this is the problem!\n");
    }
    if (!openrouterProvider.supportedTasks.includes("video-generation")) {
      console.log(
        "   ⚠️  Provider missing 'video-generation' in supportedTasks\n",
      );
    }
  }

  // 2. Check SiliconFlow Video provider
  console.log("2️⃣ Checking SiliconFlow Video provider...");
  const siliconflowProvider = await prisma.provider.findUnique({
    where: { slug: "siliconflow-video" },
  });

  if (!siliconflowProvider) {
    console.log("   ❌ SiliconFlow Video provider NOT FOUND\n");
  } else {
    console.log("   ✅ SiliconFlow Video provider exists");
    console.log(`   - isActive: ${siliconflowProvider.isActive}`);
    console.log(
      `   - supportedTasks: ${JSON.stringify(siliconflowProvider.supportedTasks)}\n`,
    );
  }

  // 3. Check video models in database
  console.log("3️⃣ Checking video generation models...");
  const videoModels = await prisma.modelMetadata.findMany({
    where: { taskType: "video-generation" },
    include: { provider: true },
  });

  if (videoModels.length === 0) {
    console.log("   ❌ No video generation models found in database\n");
  } else {
    console.log(`   ✅ Found ${videoModels.length} video generation models:\n`);
    for (const model of videoModels) {
      console.log(`   📹 ${model.displayName}`);
      console.log(`      - modelId: ${model.modelId}`);
      console.log(`      - providerSlug: ${model.providerSlug}`);
      console.log(`      - isActive: ${model.isActive}`);
      console.log(`      - creditCost: ${model.creditCost}`);
      console.log(
        `      - provider isActive: ${model.provider?.isActive ?? "N/A"}`,
      );
      console.log("");
    }
  }

  // 4. Check Seedance models specifically
  console.log("4️⃣ Checking Seedance models...");
  const seedanceModels = await prisma.modelMetadata.findMany({
    where: {
      modelId: { contains: "seedance", mode: "insensitive" },
    },
    include: { provider: true },
  });

  if (seedanceModels.length === 0) {
    console.log("   ⚠️  No Seedance models found in database");
    console.log("   → These should be synced from OpenRouter API\n");
  } else {
    console.log(`   ✅ Found ${seedanceModels.length} Seedance models:\n`);
    for (const model of seedanceModels) {
      console.log(`   🎬 ${model.displayName}`);
      console.log(`      - modelId: ${model.modelId}`);
      console.log(`      - providerSlug: ${model.providerSlug}`);
      console.log(`      - isActive: ${model.isActive}`);
      console.log(`      - creditCost: ${model.creditCost}`);
      console.log(
        `      - provider isActive: ${model.provider?.isActive ?? "N/A"}`,
      );
      console.log("");
    }
  }

  // 5. Recommendations
  console.log("📋 Recommendations:\n");

  if (!openrouterProvider) {
    console.log("   1. Run the database seed:");
    console.log("      cd packages/database && npm run db:seed\n");
  }

  if (openrouterProvider && !openrouterProvider.isActive) {
    console.log("   1. Activate the OpenRouter provider:");
    console.log(
      "      UPDATE Provider SET isActive = true WHERE slug = 'openrouter';\n",
    );
  }

  if (videoModels.length === 0) {
    console.log("   2. Sync models from OpenRouter:");
    console.log("      This should happen automatically on app start,");
    console.log(
      "      or you can trigger it manually via the ModelRegistryService\n",
    );
  }

  if (seedanceModels.length === 0) {
    console.log("   3. Check OpenRouter API key:");
    console.log("      Make sure OPENROUTER_API_KEY is set in your .env file");
    console.log(
      "      The sync service fetches models from: https://openrouter.ai/api/v1/videos/models\n",
    );
  }

  await prisma.$disconnect();
}

diagnoseVideoGeneration().catch(console.error);

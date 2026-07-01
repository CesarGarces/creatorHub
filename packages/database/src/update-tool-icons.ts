import { PrismaClient } from "../generated/client";
const prisma = new PrismaClient();

const icons: Record<string, string> = {
  "thumbnail-generator": "🎨",
  "content-translator": "🌐",
  "x-post-tweet": "💬",
  "x-search-trends": "📡",
};

async function main() {
  for (const [id, icon] of Object.entries(icons)) {
    const result = await prisma.tool.updateMany({
      where: { id },
      data: { icon },
    });
    console.log(`Updated ${id}: ${result.count} row(s)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

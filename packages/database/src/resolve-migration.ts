import { PrismaClient } from "../generated/client";

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL! } },
  });

  try {
    const result = await prisma.$executeRaw`
      UPDATE prisma_migrations 
      SET rolled_back_at = NOW() 
      WHERE migration_name = '20260619120000_restore_premium_enum' 
      AND rolled_back_at IS NULL
    `;
    console.log(`Migration resolve: ${result} row(s) updated`);
  } catch (e: any) {
    console.error("Migration resolve failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import { PrismaClient } from "../generated/client";

async function main() {
  console.log("Connecting to database...");
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL! } },
  });

  try {
    // First, check what's in the migrations table
    const rows = await prisma.$queryRaw<
      {
        migration_name: string;
        started_at: Date;
        rolled_back_at: Date | null;
        finished_at: Date | null;
      }[]
    >`SELECT migration_name, started_at, rolled_back_at, finished_at FROM prisma_migrations WHERE migration_name LIKE '20260619%'`;

    console.log("Current migration records:", JSON.stringify(rows, null, 2));

    // Mark the failed migration as rolled back
    const result = await prisma.$executeRaw`
      UPDATE prisma_migrations 
      SET rolled_back_at = NOW(), finished_at = NOW()
      WHERE migration_name = '20260619120000_restore_premium_enum' 
      AND rolled_back_at IS NULL
    `;
    console.log(`Update result: ${result} row(s) affected`);

    // Verify
    const after = await prisma.$queryRaw<
      { migration_name: string; rolled_back_at: Date | null }[]
    >`SELECT migration_name, rolled_back_at FROM prisma_migrations WHERE migration_name = '20260619120000_restore_premium_enum'`;

    console.log("After update:", JSON.stringify(after, null, 2));
  } catch (e: any) {
    console.error("ERROR:", e.message);
    console.error("Full error:", JSON.stringify(e, null, 2));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

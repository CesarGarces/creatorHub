import { PrismaClient } from "./packages/database/generated/client";

async function main() {
  console.log("[resolve-migration] Starting...");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[resolve-migration] No DATABASE_URL, skipping");
    process.exit(0);
  }
  console.log("[resolve-migration] DATABASE_URL found, connecting...");

  let p: PrismaClient;
  try {
    p = new PrismaClient({ datasources: { db: { url } } });
    console.log("[resolve-migration] PrismaClient created");
  } catch (e: any) {
    console.error(
      "[resolve-migration] Failed to create PrismaClient:",
      e.message,
    );
    process.exit(0);
  }

  try {
    const r = await p.$executeRawUnsafe(
      "UPDATE prisma_migrations SET rolled_back_at = NOW(), finished_at = NOW() WHERE migration_name = '20260619120000_restore_premium_enum' AND rolled_back_at IS NULL",
    );
    console.log("[resolve-migration] Updated " + r + " row(s)");
  } catch (e: any) {
    console.error("[resolve-migration] Execute failed:", e.message);
  } finally {
    try {
      await p.$disconnect();
    } catch (_) {}
    console.log("[resolve-migration] Done");
  }
}
main();

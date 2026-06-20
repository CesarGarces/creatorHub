UPDATE prisma_migrations SET rolled_back_at = NOW() WHERE migration_name = '20260619120000_restore_premium_enum' AND rolled_back_at IS NULL;

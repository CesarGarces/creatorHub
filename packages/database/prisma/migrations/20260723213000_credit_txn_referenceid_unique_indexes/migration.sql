-- Security hardening (SEC-03, SEC-06, SEC-09):
-- CreditTransaction.referenceId becomes the DB-level idempotency key for credit grants
-- (signup bonus "signup:{userId}", payment gateway IDs). The unique index makes
-- concurrent duplicate grants fail instead of double-crediting.
-- PostgreSQL allows multiple NULLs in unique columns, so rows without referenceId are unaffected.

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_referenceId_key" ON "CreditTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

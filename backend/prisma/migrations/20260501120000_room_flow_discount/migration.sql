-- Add partial refund state and short-lived post-training discounts.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_REFUNDED';

ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "user_discounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "percent" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceTrainingId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_discounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_discounts_userId_expiresAt_usedAt_idx"
ON "user_discounts"("userId", "expiresAt", "usedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_discounts_userId_fkey'
  ) THEN
    ALTER TABLE "user_discounts"
    ADD CONSTRAINT "user_discounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

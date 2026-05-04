-- Add partial refund state and short-lived post-training discounts.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_REFUNDED';

ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER NOT NULL DEFAULT 0;

DO $$
DECLARE
  users_id_type TEXT;
  discounts_user_id_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO users_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'users'
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF users_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot determine users.id column type';
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS "user_discounts" (
      "id" TEXT NOT NULL,
      "userId" %s NOT NULL,
      "percent" INTEGER NOT NULL,
      "reason" TEXT NOT NULL,
      "sourceTrainingId" TEXT,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "user_discounts_pkey" PRIMARY KEY ("id")
    )',
    users_id_type
  );

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO discounts_user_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'user_discounts'
    AND a.attname = 'userId'
    AND NOT a.attisdropped;

  IF discounts_user_id_type IS DISTINCT FROM users_id_type THEN
    EXECUTE format(
      'ALTER TABLE "user_discounts" ALTER COLUMN "userId" TYPE %s USING "userId"::%s',
      users_id_type,
      users_id_type
    );
  END IF;
END $$;

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

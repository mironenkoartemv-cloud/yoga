ALTER TABLE "user_discounts"
ALTER COLUMN "expiresAt" DROP NOT NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) AS rn
  FROM "user_discounts"
  WHERE "usedAt" IS NULL
)
UPDATE "user_discounts"
SET "usedAt" = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "user_discounts_one_active_idx"
ON "user_discounts"("userId")
WHERE "usedAt" IS NULL;

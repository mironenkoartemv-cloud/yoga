ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "bookings_status_expiresAt_idx"
ON "bookings"("status", "expiresAt");

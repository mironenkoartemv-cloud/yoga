-- CreateTable
CREATE TABLE "moderation_requests" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "moderation_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "moderation_requests" ADD CONSTRAINT "moderation_requests_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

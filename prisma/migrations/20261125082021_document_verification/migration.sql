-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "verifyConfidence" DOUBLE PRECISION,
ADD COLUMN     "verifyMethod" TEXT,
ADD COLUMN     "verifyNote" TEXT,
ADD COLUMN     "verifyStatus" TEXT NOT NULL DEFAULT 'unverified';

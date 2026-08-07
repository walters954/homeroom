-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'usd',
ADD COLUMN     "interval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "priceCents" INTEGER NOT NULL DEFAULT 0;

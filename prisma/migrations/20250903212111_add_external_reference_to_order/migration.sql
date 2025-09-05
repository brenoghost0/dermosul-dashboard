/*
  Warnings:

  - A unique constraint covering the columns `[external_reference]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN "external_reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_external_reference_key" ON "orders"("external_reference");

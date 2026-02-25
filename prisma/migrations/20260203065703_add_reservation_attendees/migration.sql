/*
  Warnings:

  - You are about to drop the column `cancelReason` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledAt` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledByUserId` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the `Employee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_cancelledByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_organizerId_fkey";

-- DropIndex
DROP INDEX "Reservation_organizerId_startAt_idx";

-- DropIndex
DROP INDEX "Reservation_roomId_startAt_endAt_idx";

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "cancelReason",
DROP COLUMN "cancelledAt",
DROP COLUMN "cancelledByUserId",
DROP COLUMN "department",
ADD COLUMN     "cancelledById" TEXT,
ALTER COLUMN "organizerId" DROP NOT NULL,
ALTER COLUMN "headcount" DROP NOT NULL;

-- DropTable
DROP TABLE "Employee";

-- CreateIndex
CREATE INDEX "Reservation_roomId_startAt_idx" ON "Reservation"("roomId", "startAt");

-- CreateIndex
CREATE INDEX "Reservation_organizerId_idx" ON "Reservation"("organizerId");

-- CreateIndex
CREATE INDEX "Reservation_cancelledById_idx" ON "Reservation"("cancelledById");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

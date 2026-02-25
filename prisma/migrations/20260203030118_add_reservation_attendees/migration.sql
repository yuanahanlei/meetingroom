-- CreateTable
CREATE TABLE "ReservationAttendee" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationAttendee_reservationId_idx" ON "ReservationAttendee"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationAttendee_userId_idx" ON "ReservationAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationAttendee_reservationId_userId_key" ON "ReservationAttendee"("reservationId", "userId");

-- AddForeignKey
ALTER TABLE "ReservationAttendee" ADD CONSTRAINT "ReservationAttendee_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationAttendee" ADD CONSTRAINT "ReservationAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

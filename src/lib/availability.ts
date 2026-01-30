import { prisma } from "./prisma";
import { ReservationStatus } from "@prisma/client";

export async function getAvailableRooms(params: { startAt: Date; endAt: Date; headcount: number }) {
  const { startAt, endAt, headcount } = params;

  // Rooms that fit capacity and active
  const rooms = await prisma.room.findMany({
    where: { isActive: true, capacity: { gte: headcount } },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  if (rooms.length === 0) return [];

  // Find reservations that overlap for those rooms (confirmed/blocked)
  const overlaps = await prisma.reservation.findMany({
    where: {
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      roomId: { in: rooms.map(r => r.id) },
    },
    select: { roomId: true },
  });

  const busyRoomIds = new Set(overlaps.map(o => o.roomId));
  return rooms.filter(r => !busyRoomIds.has(r.id));
}

export async function getRoomBusyBlocks(roomId: string, dayStart: Date, dayEnd: Date) {
  return prisma.reservation.findMany({
    where: {
      roomId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, endAt: true, status: true },
  });
}

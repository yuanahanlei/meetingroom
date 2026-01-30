"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { ReservationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function scanRoom(roomId: string) {
  const user = await getCurrentUser();

  // Find current active reservation for this room (now within [startAt, endAt))
  const now = new Date();
  const reservation = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: ReservationStatus.CONFIRMED,
      startAt: { lte: now },
      endAt: { gt: now },
    },
    orderBy: { startAt: "desc" },
    select: { id: true, organizerId: true, title: true, department: true, startAt: true, endAt: true },
  });

  const canLog = reservation
    ? (reservation.organizerId === user.id || isAdmin(user.role))
    : isAdmin(user.role);

  const log = await prisma.accessLog.create({
    data: {
      roomId,
      userId: user.id,
      reservationId: reservation?.id || null,
      action: "SCAN",
    },
  });

  revalidatePath(`/scan/room/${roomId}`);

  return {
    ok: true,
    canLog,
    logId: log.id,
    reservation: reservation
      ? { title: reservation.title, department: reservation.department, startAt: reservation.startAt.toISOString(), endAt: reservation.endAt.toISOString() }
      : null,
  };
}

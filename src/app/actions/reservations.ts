/* src/app/actions/reservations.ts */
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@prisma/client";

function mustString(v: FormDataEntryValue | null, name: string) {
  if (typeof v !== "string" || !v.trim()) throw new Error(`Missing ${name}`);
  return v.trim();
}

function optionalString(v: FormDataEntryValue | null) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function parseISO(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid datetime");
  return d;
}

function parseAttendeeIds(raw: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 建立預約（你原本的版本：撞期就 redirect 回建立頁 error=conflict）
 * 注意：這裡依然使用「mock organizerEmail」的寫法，避免影響你現有流程。
 */
export async function createReservation(formData: FormData) {
  const roomId = mustString(formData.get("roomId"), "roomId");
  const startAtISO = mustString(formData.get("startAt"), "startAt");
  const endAtISO = mustString(formData.get("endAt"), "endAt");

  const title = optionalString(formData.get("title"));
  const headcountRaw = optionalString(formData.get("headcount"));
  const attendeeIdsRaw = optionalString(formData.get("attendeeIds"));

  const startAt = parseISO(startAtISO);
  const endAt = parseISO(endAtISO);

  // ✅ 這裡保留你原本的 organizer 取得方式（避免影響既有功能）
  const organizerEmail = "lei@example.com";
  const organizer = await prisma.user.findUnique({
    where: { email: organizerEmail },
    select: { id: true },
  });
  if (!organizer) throw new Error("Organizer not found");

  // ✅ 撞期檢查：半開區間 [startAt, endAt)
  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (conflict) {
    const params = new URLSearchParams({
      roomId,
      date: startAtISO.slice(0, 10),
      start: startAtISO.slice(11, 16),
      end: endAtISO.slice(11, 16),
      error: "conflict",
    });
    redirect(`/reservations/new?${params.toString()}`);
  }

  const attendeeIds = parseAttendeeIds(attendeeIdsRaw);

  // headcount：優先使用輸入；否則用已選與會者數；再不行至少 1
  const headcount =
    headcountRaw && !Number.isNaN(Number(headcountRaw))
      ? Math.max(1, Number(headcountRaw))
      : Math.max(1, attendeeIds.length || 1);

  const created = await prisma.reservation.create({
    data: {
      roomId,
      organizerId: organizer.id,
      startAt,
      endAt,
      title: title ?? undefined,
      headcount,
      status: ReservationStatus.CONFIRMED,

      // ✅ 寫入關聯表（有選才寫）
      attendees: attendeeIds.length
        ? {
            createMany: {
              data: attendeeIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  redirect(`/me/reservations?created=1&id=${created.id}`);
}

/**
 * 取消預約
 * - ✅ 不存取消原因（你要求）
 * - ✅ 不寫 cancelledAt / cancelReason，避免 schema 不存在導致 prisma.update 直接爆炸
 * - ✅ 只把 status 改成 CANCELLED
 */
export async function cancelReservation(formData: FormData) {
  const reservationId = mustString(formData.get("reservationId"), "reservationId");

  // reason 仍可帶，但不存（保留介面避免影響你現有前端）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const reason = optionalString(formData.get("reason"));

  // 保守：只允許從 CONFIRMED/BLOCKED 取消（避免重複取消造成混亂）
  const updated = await prisma.reservation.updateMany({
    where: {
      id: reservationId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
    },
    data: {
      status: ReservationStatus.CANCELLED,
    },
  });

  // 找不到或已被取消/不存在：給前端一個可讀訊息（你的 modal 會顯示）
  if (updated.count === 0) {
    throw new Error("此預約可能已被取消或不存在，請重新整理後再試。");
  }

  redirect(`/me/reservations?cancelled=1&id=${encodeURIComponent(reservationId)}`);
}

export async function createReservationInline(formData: FormData) {
  const roomId = mustString(formData.get("roomId"), "roomId");
  const startAtISO = mustString(formData.get("startAt"), "startAt");
  const endAtISO = mustString(formData.get("endAt"), "endAt");

  const title = optionalString(formData.get("title"));
  const headcountRaw = optionalString(formData.get("headcount"));
  const attendeeIdsRaw = optionalString(formData.get("attendeeIds"));

  const startAt = parseISO(startAtISO);
  const endAt = parseISO(endAtISO);

  // 你原本 organizer 的取得方式（先沿用）
  const organizerEmail = "lei@example.com";
  const organizer = await prisma.user.findUnique({ where: { email: organizerEmail } });
  if (!organizer) throw new Error("Organizer not found");

  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (conflict) {
    throw new Error("此時段已被預約，請重新選取空白時段。");
  }

  const attendeeIds = parseAttendeeIds(attendeeIdsRaw);
  const headcount =
    typeof headcountRaw === "string" && headcountRaw
      ? Math.max(1, Number(headcountRaw))
      : Math.max(1, attendeeIds.length || 1);

  await prisma.reservation.create({
    data: {
      roomId,
      organizerId: organizer.id,
      startAt,
      endAt,
      title: title ?? undefined,
      headcount,
      status: ReservationStatus.CONFIRMED,
      attendees: attendeeIds.length
        ? {
            createMany: {
              data: attendeeIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  // 不 redirect：給 client 在同頁 refresh
  return { ok: true };
}

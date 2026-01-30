"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReservationStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

/**
 * 伺服器端時間檢查（避免被手動改 query / form）
 * - 不跨日（以「當地時區」判斷）
 * - 30 分鐘為單位
 * - 只允許 08:30–17:30（含 08:30 開始、17:30 結束）
 */
function validateTimeWindow(startAt: Date, endAt: Date) {
  if (!(endAt > startAt)) throw new Error("結束時間必須晚於開始時間（至少 30 分鐘）。");

  const diff = endAt.getTime() - startAt.getTime();
  const halfHour = 30 * 60 * 1000;
  if (diff % halfHour !== 0) throw new Error("時間必須以 30 分鐘為單位。");

  // 用 offset 做「當地時間」判斷（預設台灣 +8）
  const offsetMin = Number(process.env.APP_TZ_OFFSET_MIN || 480);

  const toLocalYMD = (d: Date) => {
    const ms = d.getTime() + offsetMin * 60 * 1000;
    const dd = new Date(ms);
    const y = dd.getUTCFullYear();
    const m = String(dd.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dd.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const toLocalMinutes = (d: Date) => {
    const ms = d.getTime() + offsetMin * 60 * 1000;
    const dd = new Date(ms);
    return dd.getUTCHours() * 60 + dd.getUTCMinutes();
  };

  // 不可跨日
  if (toLocalYMD(startAt) !== toLocalYMD(endAt)) {
    throw new Error("不可跨日預約。");
  }

  // 只允許 08:30–17:30
  const startMin = toLocalMinutes(startAt);
  const endMin = toLocalMinutes(endAt);

  const minAllowed = 8 * 60 + 30; // 08:30
  const maxAllowed = 17 * 60 + 30; // 17:30

  if (startMin < minAllowed || startMin > maxAllowed) {
    throw new Error("開始時間需落在 08:30–17:30。");
  }
  if (endMin < minAllowed || endMin > maxAllowed) {
    throw new Error("結束時間需落在 08:30–17:30。");
  }
  if (startMin === maxAllowed) {
    throw new Error("17:30 只能作為結束時間，不能作為開始時間。");
  }
}

/** 把 Date 轉成「當地」date=YYYY-MM-DD / time=HH:mm（用 APP_TZ_OFFSET_MIN） */
function toLocalYmdHm(d: Date) {
  const offsetMin = Number(process.env.APP_TZ_OFFSET_MIN || 480);
  const ms = d.getTime() + offsetMin * 60 * 1000;
  const dd = new Date(ms);

  const y = dd.getUTCFullYear();
  const m = String(dd.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dd.getUTCDate()).padStart(2, "0");
  const hh = String(dd.getUTCHours()).padStart(2, "0");
  const mm = String(dd.getUTCMinutes()).padStart(2, "0");

  return {
    ymd: `${y}-${m}-${day}`,
    hm: `${hh}:${mm}`,
  };
}

export async function createReservation(formData: FormData) {
  const roomId = String(formData.get("roomId") || "");
  const startAtStr = String(formData.get("startAt") || "");
  const endAtStr = String(formData.get("endAt") || "");
  const titleRaw = String(formData.get("title") || ""); // 選填
  const headcount = Number(formData.get("headcount") || 1);

  if (!roomId || !startAtStr || !endAtStr) {
    throw new Error("缺少必要參數：roomId/startAt/endAt");
  }

  const startAt = new Date(startAtStr);
  const endAt = new Date(endAtStr);

  validateTimeWindow(startAt, endAt);

  // 用於 redirect 回 new 頁（或成功頁）時，帶回正確的 date/start/end 參數
  const localStart = toLocalYmdHm(startAt);
  const localEnd = toLocalYmdHm(endAt);

  // ✅ 關鍵：跟「我的預約」頁一致，使用同一套登入者
  const user = await getCurrentUser();
  if (!user?.id) throw new Error("尚未登入或取得使用者失敗");

  const title = titleRaw.trim();

  try {
    const created = await prisma.$transaction(async (tx) => {
      // ✅ 1) 確保 User 存在（避免外鍵爆）
      await tx.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email,
          name: user.name,
          dept: user.dept,
        },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          dept: user.dept,
        },
        select: { id: true },
      });

      // ✅ 2) 防撞期
      const overlap = await tx.reservation.findFirst({
        where: {
          roomId,
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      });

      if (overlap) {
        // 用一致的訊息，方便我們在 page 判斷
        throw new Error("此時段已被預約");
      }

      // ✅ 3) 建立預約
      const res = await tx.reservation.create({
        data: {
          roomId,
          organizerId: user.id,

          startAt,
          endAt,
          department: user.dept, // 你的 schema 看起來有 department（若沒有再改）
          title: title === "" ? null : title,
          headcount,

          status: ReservationStatus.CONFIRMED,
        },
        select: { id: true },
      });

      return res;
    });

    // ✅ 成功：導向成功頁（我們下一步會新增 /reservations/success/page.tsx）
    redirect(`/reservations/success?reservationId=${encodeURIComponent(created.id)}`);
  } catch (err: any) {
    const msg = String(err?.message || "");

    // ❌ 撞期：導回 new 頁並帶 error=conflict，讓 UI 顯示「你送出失敗」並展開修改時間
    if (msg.includes("此時段已被預約")) {
      redirect(
        `/reservations/new` +
          `?roomId=${encodeURIComponent(roomId)}` +
          `&date=${encodeURIComponent(localStart.ymd)}` +
          `&start=${encodeURIComponent(localStart.hm)}` +
          `&end=${encodeURIComponent(localEnd.hm)}` +
          `&error=conflict` +
          `&updated=1`
      );
    }

    // 其他錯誤：先丟出去（你也可以之後統一導回 new 頁顯示 error）
    throw err;
  }
}

/**
 * ✅ 取消預約（依你的 Reservation schema）
 * formData 需要：
 * - reservationId
 * - cancelReason (可選，前端你目前固定送 "使用者取消")
 */
export async function cancelReservation(formData: FormData): Promise<void> {
  const reservationId = String(formData.get("reservationId") || "");
  const cancelReason = String(formData.get("cancelReason") || "");

  if (!reservationId) throw new Error("缺少 reservationId");

  // ✅ 同一套登入者
  const user = await getCurrentUser();
  if (!user?.id) throw new Error("尚未登入或取得使用者失敗");

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        dept: user.dept,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        dept: user.dept,
      },
      select: { id: true },
    });

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: user.id,
        cancelReason: cancelReason || "使用者取消",
      },
      select: { id: true },
    });
  });

  redirect("/me/reservations?cancelled=1");
}

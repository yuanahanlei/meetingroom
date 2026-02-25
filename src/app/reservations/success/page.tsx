import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  reservationId?: string;
};

const TZ = "Asia/Taipei";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** 以 Intl 轉台北日期 YYYY/MM/DD */
function formatYMD(date: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
  return ymd.replaceAll("-", "/"); // YYYY/MM/DD
}

/** 以 Intl 轉台北時間 HH:mm */
function formatHM(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${pad2(Number(hh))}:${pad2(Number(mm))}`;
}

/** 轉台北 YYYY-MM-DD（給 /search query 用） */
function formatYmdDash(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
}

export default async function ReservationSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const hasDb = !!process.env.DATABASE_URL;

  const reservationId = searchParams?.reservationId;

  // ✅ 真實模式：沒有 reservationId 才 redirect
  // ✅ Demo 模式：沒有 reservationId 也能展示頁面
  if (!reservationId && hasDb) redirect("/me/reservations");

  // ----------------------------
  // ✅ Demo 模式：不查 DB，直接顯示可展示的內容
  // ----------------------------
  if (!hasDb) {
    const now = new Date();
    const dateText = formatYMD(now);
    const startText = "10:00";
    const endText = "11:00";

    const searchHref =
      `/search?date=${encodeURIComponent(formatYmdDash(now))}` +
      `&start=${encodeURIComponent(startText)}` +
      `&end=${encodeURIComponent(endText)}`;

    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                預約成功
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Demo 模式：此頁為流程展示，未寫入資料庫。
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Demo
            </span>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="text-sm font-semibold text-zinc-900">本次預約摘要</div>

            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="text-zinc-500 sm:w-20">會議室</div>
                <div className="font-medium text-zinc-900">3F・示範會議室</div>
              </div>

              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="text-zinc-500 sm:w-20">日期</div>
                <div>{dateText}</div>
              </div>

              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="text-zinc-500 sm:w-20">時段</div>
                <div>
                  {startText} – {endText}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Link
              href={searchHref}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              繼續預約
            </Link>

            <Link
              href="/me/reservations"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              查看我的預約
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-zinc-500">
            若需要調整此預約，請到「我的預約」進行取消後重新預約。
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------
  // ✅ 真實模式：runtime 才 import prisma（避免 build 階段 collect data 失敗）
  // ----------------------------
  const { prisma } = await import("@/lib/prisma");

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId! },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      title: true,
      headcount: true,
      room: {
        select: {
          id: true,
          name: true,
          floor: true,
        },
      },
    },
  });

  if (!reservation) redirect("/me/reservations");

  const roomTitle = `${reservation.room.floor ? `${reservation.room.floor}・` : ""}${
    reservation.room.name
  }`;
  const dateText = formatYMD(reservation.startAt);
  const startText = formatHM(reservation.startAt);
  const endText = formatHM(reservation.endAt);

  // ✅ 繼續預約：回到 search，保留同一天 & 同時段
  const searchHref =
    `/search?date=${encodeURIComponent(formatYmdDash(reservation.startAt))}` +
    `&start=${encodeURIComponent(startText)}` +
    `&end=${encodeURIComponent(endText)}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              預約成功
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              你的預約已成立，你可以查看我的預約或繼續預約其他會議室。
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            已成立
          </span>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="text-sm font-semibold text-zinc-900">本次預約摘要</div>

          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-zinc-500 sm:w-20">會議室</div>
              <div className="font-medium text-zinc-900">{roomTitle}</div>
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-zinc-500 sm:w-20">日期</div>
              <div>{dateText}</div>
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-zinc-500 sm:w-20">時段</div>
              <div>
                {startText} – {endText}
              </div>
            </div>

            {reservation.title ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="text-zinc-500 sm:w-20">會議名稱</div>
                <div>{reservation.title}</div>
              </div>
            ) : null}

            {typeof reservation.headcount === "number" ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="text-zinc-500 sm:w-20">人數</div>
                <div>{reservation.headcount}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href={searchHref}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            繼續預約
          </Link>

          <Link
            href="/me/reservations"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            查看我的預約
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-zinc-500">
          若需要調整此預約，請到「我的預約」進行取消後重新預約。
        </div>
      </div>
    </div>
  );
}

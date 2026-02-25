import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ReservationStatus } from "@prisma/client";
import CancelReservationButton from "@/components/CancelReservationButton";

export const dynamic = "force-dynamic";

const TZ = "Asia/Taipei";

function formatYMD(d: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
  return ymd.replaceAll("-", "/"); // YYYY/MM/DD
}

function formatHM(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

function roomLabel(room: { floor: string | null; name: string } | null) {
  if (!room) return "（會議室已不存在）";
  return `${room.floor ? `${room.floor} · ` : ""}${room.name}`;
}

function statusMeta(status: ReservationStatus) {
  switch (status) {
    case ReservationStatus.CONFIRMED:
      return {
        text: "CONFIRMED",
        cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      };
    case ReservationStatus.CANCELLED:
      return {
        text: "CANCELLED",
        cls: "bg-zinc-100 text-zinc-700 ring-zinc-200",
      };
    case ReservationStatus.BLOCKED:
      return {
        text: "BLOCKED",
        cls: "bg-amber-50 text-amber-800 ring-amber-200",
      };
    default:
      return {
        text: String(status),
        cls: "bg-zinc-100 text-zinc-700 ring-zinc-200",
      };
  }
}

/**
 * 取得「台北當天 00:00」對應的 Date（用 ISO 字串避免時區偏移）
 */
function getStartOfTodayInTaipei(now: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD (in TZ)

  // 直接用 YYYY-MM-DDT00:00:00 在 server 的 Date 解析（會變成該日的 UTC offset 計算）
  // 對我們的用途：只要「能代表今天起」即可，查詢會使用同一基準。
  return new Date(`${ymd}T00:00:00`);
}

export default async function MyReservationsPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">我的預約</h1>
            <p className="mt-2 text-sm text-zinc-500">尚未登入。</p>
          </div>

          <Link
            href="/me/reservations/history"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            歷史紀錄
          </Link>
        </div>

        <div className="mt-6">
          <Link
            href="/search"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            去搜尋
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const todayStart = getStartOfTodayInTaipei(now);

  // ✅ 改成「今天(台北) 00:00 之後」都顯示（今天早上已結束的也會出現）
  // ① 正常顯示：排除取消 + 只顯示今天到未來
  const activeReservations = await prisma.reservation.findMany({
    where: {
      organizerId: user.id,
      status: { not: ReservationStatus.CANCELLED },
      startAt: { gte: todayStart },
    },
    orderBy: { startAt: "desc" },
    include: { room: true },
    take: 50,
  });

  // ② 只保留最近一次取消（同樣只在今天到未來範圍內）
  const lastCancelled = await prisma.reservation.findFirst({
    where: {
      organizerId: user.id,
      status: ReservationStatus.CANCELLED,
      startAt: { gte: todayStart },
    },
    orderBy: { updatedAt: "desc" },
    include: { room: true },
  });

  const reservations = lastCancelled
    ? [lastCancelled, ...activeReservations]
    : activeReservations;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">我的預約</h1>
          <p className="mt-1 text-sm text-zinc-500">
            這裡顯示「今天（台北）到未來」的預約；更早的會自動隱藏。
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            你可以隨時取消自己的預約（取消後只保留最近一次取消紀錄）。
          </p>
        </div>

        <div className="shrink-0">
          <Link
            href="/me/reservations/history"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            歷史紀錄
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm text-zinc-500">
          登入者：{user.name} · {user.email}
        </div>
        <div className="mt-4 border-t border-zinc-100" />

        {reservations.length === 0 ? (
          <div className="py-8">
            <div className="text-lg font-semibold text-zinc-900">
              目前沒有今天到未來的預約
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              你可以到「搜尋」分頁預約會議室。
            </div>
            <div className="mt-4">
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
              >
                去搜尋
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* ✅ Mobile: cards */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:hidden">
              {reservations.map((r) => {
                const isCancelled = r.status === ReservationStatus.CANCELLED;
                const isLastCancelled = Boolean(
                  lastCancelled && r.id === lastCancelled.id
                );
                const meta = statusMeta(r.status);

                const dateText = formatYMD(r.startAt);
                const timeText = `${formatHM(r.startAt)}–${formatHM(r.endAt)}`;

                return (
                  <div
                    key={r.id}
                    className={[
                      "rounded-2xl border p-4",
                      isCancelled
                        ? "border-zinc-200 bg-zinc-50/60"
                        : "border-zinc-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-zinc-900">
                          {dateText}　{timeText}
                        </div>
                        <div className="mt-1 text-sm text-zinc-500">
                          {roomLabel(r.room)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                            meta.cls,
                          ].join(" ")}
                        >
                          {meta.text}
                        </span>
                        {isLastCancelled ? (
                          <div className="mt-1 text-xs text-zinc-500">
                            最近一次取消
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                      <div className="font-semibold text-zinc-900">
                        {r.title ?? "（未填）"}
                      </div>

                      <div className="mt-1 text-sm text-zinc-600">
                        {typeof r.headcount === "number"
                          ? `${r.headcount} 人`
                          : "（未填人數）"}
                      </div>

                      {isCancelled ? (
                        <div className="mt-2 text-xs text-zinc-500">
                          狀態：已取消
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Link
                        href={`/rooms/${r.roomId}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                      >
                        查看日程
                      </Link>

                      {!isCancelled ? (
                        <CancelReservationButton reservationId={r.id} />
                      ) : (
                        <span className="text-xs text-zinc-500">已取消</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ✅ Desktop: table */}
            <div className="mt-5 hidden md:block">
              <div className="overflow-hidden rounded-2xl border border-zinc-200">
                <table className="min-w-full border-collapse">
                  <thead className="bg-zinc-50">
                    <tr className="text-left text-sm text-zinc-600">
                      <th className="px-4 py-3 font-semibold">時間</th>
                      <th className="px-4 py-3 font-semibold">會議室</th>
                      <th className="px-4 py-3 font-semibold">會議</th>
                      <th className="px-4 py-3 font-semibold">狀態</th>
                      <th className="px-4 py-3 font-semibold" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {reservations.map((r) => {
                      const isCancelled =
                        r.status === ReservationStatus.CANCELLED;
                      const isLastCancelled = Boolean(
                        lastCancelled && r.id === lastCancelled.id
                      );
                      const meta = statusMeta(r.status);

                      return (
                        <tr
                          key={r.id}
                          className={isCancelled ? "opacity-60" : ""}
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="font-semibold text-zinc-900">
                              {formatYMD(r.startAt)}
                            </div>
                            <div className="text-sm text-zinc-600">
                              {formatHM(r.startAt)}–{formatHM(r.endAt)}
                            </div>
                            {isCancelled ? (
                              <div className="mt-2 text-xs text-zinc-500">
                                狀態：已取消
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-zinc-700">
                            {roomLabel(r.room)}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="text-sm font-semibold text-zinc-900">
                              {r.title ?? "（未填）"}
                            </div>
                            <div className="mt-1 text-sm text-zinc-600">
                              {typeof r.headcount === "number"
                                ? `${r.headcount} 人`
                                : "（未填人數）"}
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                  meta.cls,
                                ].join(" ")}
                              >
                                {meta.text}
                              </span>
                              {isLastCancelled ? (
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                                  最近一次取消
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <Link
                                href={`/rooms/${r.roomId}`}
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                              >
                                查看日程
                              </Link>
                              {!isCancelled ? (
                                <CancelReservationButton reservationId={r.id} />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                提示：取消後只保留最近一次取消紀錄（且僅在「今天到未來」範圍內）。
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-lg font-semibold text-zinc-900">掃碼（Phase 1）</div>
        <p className="mt-2 text-sm text-zinc-500">
          到某間房的掃碼頁：/scan/room/[roomId]（也可從會議室頁點進去）
        </p>
      </div>
    </div>
  );
}

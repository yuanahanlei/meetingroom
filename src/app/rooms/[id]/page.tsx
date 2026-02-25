import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { combineDateTime } from "@/lib/time";
import { ReservationStatus } from "@prisma/client";

type Params = { id: string };
type SearchParams = {
  date?: string; // YYYY-MM-DD
  view?: "available" | "all"; // 顯示：可借/全部
  updated?: string; // 1 => 顯示「已更新」提示
};

const TZ = "Asia/Taipei";

// 08:30–17:30，每 30 分一格
function buildSlots() {
  const slots: { start: string; end: string }[] = [];
  let h = 8,
    m = 30;

  const fmt = (hh: number, mm: number) =>
    `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  while (true) {
    const start = fmt(h, m);

    let nh = h,
      nm = m + 30;
    if (nm >= 60) {
      nh += 1;
      nm = 0;
    }
    const end = fmt(nh, nm);

    slots.push({ start, end });

    if (end === "17:30") break;
    h = nh;
    m = nm;
  }
  return slots;
}

const SLOTS = buildSlots();

function formatYMDInTZ(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addMonthsSafe(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function isValidYmd(ymd: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

function clampDate(ymd: string, min: string, max: string) {
  if (ymd < min) return min;
  if (ymd > max) return max;
  return ymd;
}

function formatHMInTZ(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // ✅ 日期可選範圍：今天 ～ 今天+2個月（台北時區）
  const now = new Date();
  const minDate = formatYMDInTZ(now, TZ);
  const maxDate = formatYMDInTZ(addMonthsSafe(now, 2), TZ);

  const rawDate = sp.date && isValidYmd(sp.date) ? sp.date : minDate;
  const date = clampDate(rawDate, minDate, maxDate);

  const view: "available" | "all" = sp.view === "all" ? "all" : "available";
  const showUpdatedBanner = sp.updated === "1";

  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, name: true, floor: true, capacity: true },
  });
  if (!room) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          找不到會議室
        </div>
      </div>
    );
  }

  // ✅ 只顯示 08:30–17:30（不可跨日）
  const dayStart = combineDateTime(date, "08:30");
  const dayEnd = combineDateTime(date, "17:30");

  const reservations = await prisma.reservation.findMany({
    where: {
      roomId: id,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      organizer: { select: { name: true, dept: true } },
    },
  });

  const findBusy = (slotStart: Date, slotEnd: Date) => {
    return reservations.find((r) => r.startAt < slotEnd && r.endAt > slotStart);
  };

  const slotRows = SLOTS.map((s) => {
    const slotStart = combineDateTime(date, s.start);
    const slotEnd = combineDateTime(date, s.end);
    const busy = findBusy(slotStart, slotEnd);

    const organizerName = busy?.organizer?.name ?? "";
    const organizerDept = busy?.organizer?.dept ?? "";

    const organizerText =
      organizerName && organizerDept
        ? `${organizerName}（${organizerDept}）`
        : organizerName
        ? organizerName
        : organizerDept
        ? `（${organizerDept}）`
        : "";

    return {
      start: s.start,
      end: s.end,
      isBusy: Boolean(busy),
      organizerText,
    };
  });

  const availableCount = slotRows.filter((x) => !x.isBusy).length;
  const shownRows =
    view === "available" ? slotRows.filter((x) => !x.isBusy) : slotRows;

  const pageTitle = `${room.floor ? `${room.floor} · ` : ""}${room.name}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* 頁首 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          <div className="mt-1 text-sm text-zinc-500">
            可借時段：08:30–17:30（每 30 分）
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            href={`/search?date=${encodeURIComponent(date)}`}
          >
            返回搜尋
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            href={`/scan/room/${room.id}`}
          >
            掃碼頁
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        {/* ✅ 已更新提示 */}
        {showUpdatedBanner ? (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-blue-900">
              <span className="font-semibold">✅ 已更新</span>
              <span className="font-semibold">{date}</span>
              <span className="text-blue-800">
                （{view === "available" ? "可借" : "全部"}）
              </span>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-semibold text-blue-900">
                可借：{availableCount} 段
              </span>
              <span className="ml-auto text-xs text-blue-700">已重新計算</span>
            </div>
          </div>
        ) : null}

        {/* 條件列 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          {/* 左：日期 + 確認 */}
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="updated" value="1" />

            <div className="w-[320px] max-w-full">
              <div className="text-xs font-medium text-zinc-600">日期</div>
              <input
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                type="date"
                name="date"
                defaultValue={date}
                min={minDate}
                max={maxDate}
              />
            </div>

            <button
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
              type="submit"
            >
              確認
            </button>
          </form>

          {/* 右：顯示切換 */}
          <div className="justify-self-start lg:justify-self-end">
            <div className="text-xs font-medium text-zinc-600 lg:text-right">
              顯示
            </div>
            <div className="mt-1 inline-flex rounded-2xl border border-zinc-200 bg-white p-1">
              <Link
                className={[
                  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                  view === "available"
                    ? "bg-black text-white"
                    : "text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
                href={`/rooms/${room.id}?date=${encodeURIComponent(
                  date
                )}&view=available&updated=1`}
              >
                可借
              </Link>
              <Link
                className={[
                  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                  view === "all"
                    ? "bg-black text-white"
                    : "text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
                href={`/rooms/${room.id}?date=${encodeURIComponent(
                  date
                )}&view=all&updated=1`}
              >
                全部
              </Link>
            </div>
          </div>
        </div>

        <div className="my-5 h-px bg-zinc-100" />

        {/* 時間軸標題列 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900">當日時間軸</div>
            <p className="mt-1 text-sm text-zinc-500">
              忙碌時段僅顯示預約人與部門，方便協調。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
              可借：{availableCount} 段
            </span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
              顯示：{view === "available" ? "可借" : "全部"}
            </span>
          </div>
        </div>

        {/* ✅ 時段清單：用 Grid 固定右欄，避免中間「一大片空白」 */}
        <div className="mt-4 space-y-3">
          {shownRows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              目前沒有可借時段（可切換「全部」查看忙碌狀態）。
            </div>
          ) : (
            shownRows.map((s) => {
              const isBusy = s.isBusy;

              return (
                <div
                  key={`${s.start}-${s.end}`}
                  className={[
                    "rounded-2xl border border-zinc-200 bg-white p-4",
                    isBusy ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    {/* 左：內容 */}
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-zinc-900">
                        {s.start} – {s.end}
                      </div>
                      {isBusy ? (
                        <div className="mt-1 text-sm text-zinc-600">
                          已被預約
                          {s.organizerText ? ` · ${s.organizerText}` : ""}
                        </div>
                      ) : (
                        <div className="mt-1 text-sm text-zinc-600">可預約</div>
                      )}
                    </div>

                    {/* 右：按鈕（固定欄） */}
                    <div className="justify-self-start sm:justify-self-end">
                      {isBusy ? (
                        <span className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-500">
                          已被預約
                        </span>
                      ) : (
                        <Link
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:opacity-90"
                          href={`/reservations/new?roomId=${encodeURIComponent(
                            room.id
                          )}&date=${encodeURIComponent(
                            date
                          )}&start=${encodeURIComponent(
                            s.start
                          )}&end=${encodeURIComponent(s.end)}`}
                        >
                          立即預約
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="my-6 h-px bg-zinc-100" />

        {/* 忙碌清單 */}
        <div className="text-lg font-semibold text-zinc-900">忙碌清單（摘要）</div>
        {reservations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            此時段目前沒有任何已確認預約或維護時段。
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
            <table className="min-w-full border-collapse">
              <thead className="bg-zinc-50">
                <tr className="text-left text-sm text-zinc-600">
                  <th className="px-4 py-3 font-semibold">開始</th>
                  <th className="px-4 py-3 font-semibold">結束</th>
                  <th className="px-4 py-3 font-semibold">狀態</th>
                  <th className="px-4 py-3 font-semibold">預約人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {reservations.map((r) => {
                  const who = r.organizer?.name ?? "（未知）";
                  const dept = r.organizer?.dept ?? "";
                  return (
                    <tr key={r.id} className="text-sm text-zinc-700">
                      <td className="px-4 py-3">{formatHMInTZ(r.startAt, TZ)}</td>
                      <td className="px-4 py-3">{formatHMInTZ(r.endAt, TZ)}</td>
                      <td className="px-4 py-3">{r.status}</td>
                      <td className="px-4 py-3">
                        {who}
                        {dept ? (
                          <span className="ml-1 text-xs text-zinc-500">
                            （{dept}）
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

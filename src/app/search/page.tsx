import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  date?: string; // YYYY-MM-DD
  start?: string; // HH:mm
  end?: string; // HH:mm
  onlyAvailable?: string; // "1" | undefined
};

const TZ = "Asia/Taipei";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYMDInTZ(d: Date, timeZone: string) {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addMonthsSafe(date: Date, months: number) {
  // 同日，不存在就取月底
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function buildDateTime(dateYmd: string, hm: string) {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function generateTimeOptions(start = "08:30", end = "17:30", stepMin = 30) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const options: string[] = [];
  let minutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  while (minutes <= endMinutes) {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    options.push(`${pad2(hh)}:${pad2(mm)}`);
    minutes += stepMin;
  }
  return options;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  // 半開區間 [start, end)
  return aStart < bEnd && bStart < aEnd;
}

type Availability = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

function badgeMeta(a: Availability) {
  switch (a) {
    case "AVAILABLE":
      return {
        text: "可借",
        cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      };
    case "PARTIAL":
      return {
        text: "部分可借",
        cls: "bg-amber-50 text-amber-800 ring-amber-200",
      };
    case "UNAVAILABLE":
      // ✅ 調整：讓「已被預約」更顯眼，避免跟 disabled 灰按鈕混在一起
      return {
        text: "已被預約",
        cls: "bg-rose-50 text-rose-700 ring-rose-200",
      };
  }
}

function withParams(base: string, params: Record<string, string | undefined>) {
  const u = new URL(base, "http://local");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.searchParams.set(k, v);
  }
  return u.pathname + (u.search ? u.search : "");
}

/**
 * 樓層排序：
 * - 地下：B99 ~ B1（數字越大越下面，但顯示順序應該 B? 由小到大？通常是 B1、B2...；你想 B2 在 B1 前也可調）
 * - 地上：1F ~ 99F
 * - 其他：放最後（避免亂序）
 */
function floorSortKey(floor: string | null | undefined) {
  if (!floor) return Number.POSITIVE_INFINITY;

  const s = String(floor).trim().toUpperCase();

  // 常見格式：B1、B2、B1F
  let m = s.match(/^B(\d+)(F)?$/);
  if (m) {
    const n = Number(m[1]);
    // 讓 B1 在最前、B2 在 B1 後：B1 < B2 < B3
    // key 用負數區間確保地下都排在地上前面
    return -1000 + n; // B1=-999, B2=-998 ...
  }

  // 常見格式：1F、2F、10F
  m = s.match(/^(\d+)(F)?$/);
  if (m) {
    const n = Number(m[1]);
    return n; // 1,2,3...
  }

  // 其他格式：例如 "GF" "M" "R" 或空白：放最後
  return Number.POSITIVE_INFINITY;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // 日期可選範圍：今天 ～ 今天+2個月（台北時區）
  const now = new Date();
  const minDate = formatYMDInTZ(now, TZ);
  const maxDate = formatYMDInTZ(addMonthsSafe(now, 2), TZ);

  const date = sp.date ?? minDate;
  const start = sp.start ?? "08:30";
  const end = sp.end ?? "17:30";
  const onlyAvailable = sp.onlyAvailable === "1";

  const timeOptions = generateTimeOptions("08:30", "17:30", 30);

  const startAt = buildDateTime(date, start);
  let endAt = buildDateTime(date, end);
  if (endAt <= startAt) endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

  const roomsRaw = await prisma.room.findMany({
    // 這裡先不靠資料庫排序，改成後端 sort（可自訂 B1/1F/2F…順序）
    select: {
      id: true,
      name: true,
      floor: true, // 若沒有這欄位就刪掉
      capacity: true, // 若沒有這欄位就刪掉
    },
  });

  // ✅ 顯示順序：先樓層，再名稱
  const rooms = roomsRaw
    .slice()
    .sort(
      (a, b) =>
        floorSortKey(a.floor) -
          floorSortKey(b.floor) ||
        a.name.localeCompare(b.name, "zh-Hant")
    );

  const dayStart = buildDateTime(date, "00:00");
  const dayEnd = buildDateTime(date, "23:59");

  // ✅ organizer 的部門欄位是 dept，不是 department
  const reservations = await prisma.reservation.findMany({
    where: {
      cancelledAt: null,
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: {
      roomId: true,
      startAt: true,
      endAt: true,
      organizer: {
        select: {
          name: true,
          dept: true,
        },
      },
    },
  });

  const byRoom = new Map<
    string,
    {
      start: Date;
      end: Date;
      organizer?: { name?: string | null; dept?: string | null } | null;
    }[]
  >();

  for (const r of reservations) {
    const arr = byRoom.get(r.roomId) ?? [];
    arr.push({ start: r.startAt, end: r.endAt, organizer: (r as any).organizer });
    byRoom.set(r.roomId, arr);
  }

  const roomCardsAll = rooms.map((room) => {
    const rs = byRoom.get(room.id) ?? [];

    const overlapRes = rs.find((r) => overlaps(startAt, endAt, r.start, r.end)) ?? null;
    const hasOverlap = !!overlapRes;
    const hasAnyThatDay = rs.length > 0;

    const availability: Availability = hasOverlap
      ? "UNAVAILABLE"
      : hasAnyThatDay
      ? "PARTIAL"
      : "AVAILABLE";

    const bookedByName = overlapRes?.organizer?.name ?? null;
    const bookedByDept = overlapRes?.organizer?.dept ?? null;

    return { room, availability, hasOverlap, bookedByName, bookedByDept };
  });

  const roomCards = onlyAvailable
    ? roomCardsAll.filter((x) => x.availability !== "UNAVAILABLE")
    : roomCardsAll;

  const allHref = withParams("/search", { date, start, end });
  const onlyAvailHref = withParams("/search", {
    date,
    start,
    end,
    onlyAvailable: "1",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* ✅ 調整：頁面標題稍微放大一階 */}
          <h5 className="text-2xl font-semibold tracking-tight">搜尋會議室</h5>
          <p className="mt-1 text-sm text-zinc-500">
            可借時段：08:30–17:30（每 30 分鐘為單位）
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <form>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
            <div className="md:flex-1">
              <label className="block text-xs font-medium text-zinc-600">
                日期
              </label>
              <input
                name="date"
                type="date"
                defaultValue={date}
                min={minDate}
                max={maxDate}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div className="md:w-56">
              <label className="block text-xs font-medium text-zinc-600">
                開始時間
              </label>
              <select
                name="start"
                defaultValue={start}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:w-56">
              <label className="block text-xs font-medium text-zinc-600">
                結束時間
              </label>
              <select
                name="end"
                defaultValue={end}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:w-28">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-black px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                搜尋
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <div className="inline-flex items-center rounded-xl border border-zinc-300 bg-zinc-50 p-1">
              <Link
                href={allHref}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  !onlyAvailable
                    ? "bg-white shadow-sm text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900",
                ].join(" ")}
                aria-current={!onlyAvailable ? "page" : undefined}
              >
                全部
              </Link>
              <Link
                href={onlyAvailHref}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  onlyAvailable
                    ? "bg-white shadow-sm text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900",
                ].join(" ")}
                aria-current={onlyAvailable ? "page" : undefined}
              >
                可預約
              </Link>
            </div>
          </div>
        </form>
      </div>

      {/* Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {roomCards.map(
          ({ room, availability, hasOverlap, bookedByName, bookedByDept }) => {
            const badge = badgeMeta(availability);

            const reserveHref = withParams("/reservations/new", {
              roomId: room.id,
              date,
              start,
              end,
            });

            const scheduleHref = withParams(`/rooms/${room.id}`, { date });

            const titlePrefix = room.floor ? `${room.floor}・` : "";
            const title = `${titlePrefix}${room.name}`;

            const bookedText =
              bookedByName && bookedByDept
                ? `已被 ${bookedByName}（${bookedByDept}）預約`
                : bookedByName
                ? `已被 ${bookedByName} 預約`
                : "此時段不可借";

            return (
              <div
                key={room.id}
                className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">
                        {title}
                      </h3>
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          badge.cls,
                        ].join(" ")}
                      >
                        {badge.text}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600">
                      {typeof room.capacity === "number" ? (
                        <span>建議 {room.capacity} 人</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {hasOverlap ? (
                      <button
                        type="button"
                        disabled
                        className="h-10 cursor-not-allowed rounded-xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-500"
                        title={bookedText}
                      >
                        已被預約
                      </button>
                    ) : (
                      <Link
                        href={reserveHref}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:opacity-90"
                      >
                        預約
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
                  <Link
                    href={scheduleHref}
                    className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
                  >
                    查看時段
                  </Link>

                  {availability === "PARTIAL" ? (
                    <span className="text-xs text-zinc-500">此日已有部分預約</span>
                  ) : availability === "UNAVAILABLE" ? (
                    // ✅ 調整：預約人資訊更醒目（顏色 + 字重），方便內部協調
                    <span className="text-xs font-medium text-rose-700">
                      {bookedText}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">此時段可借</span>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {roomCards.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <div className="text-sm font-semibold text-zinc-900">
            沒有符合條件的會議室
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            你可以切回「全部」，或調整時間範圍再試一次。
          </div>
        </div>
      ) : null}
    </div>
  );
}

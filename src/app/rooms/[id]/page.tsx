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

function isValidYmd(ymd: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

function clampDate(ymd: string, min: string, max: string) {
  // YYYY-MM-DD 可直接比較
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
  if (!room) return <div className="container">找不到會議室</div>;

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

  // 幫每一格判斷是否被佔用（重疊即 busy）
  const findBusy = (slotStart: Date, slotEnd: Date) => {
    return reservations.find((r) => r.startAt < slotEnd && r.endAt > slotStart);
  };

  const slotRows = SLOTS.map((s) => {
    const slotStart = combineDateTime(date, s.start);
    const slotEnd = combineDateTime(date, s.end);
    const busy = findBusy(slotStart, slotEnd);

    const organizerText = busy?.organizer
      ? `${busy.organizer.name}${busy.organizer.dept ? `（${busy.organizer.dept}）` : ""}`
      : "";

    return {
      start: s.start,
      end: s.end,
      isBusy: Boolean(busy),
      organizerText,
    };
  });

  const availableCount = slotRows.filter((x) => !x.isBusy).length;
  const shownRows = view === "available" ? slotRows.filter((x) => !x.isBusy) : slotRows;

  return (
    <div className="container">
      {/* 頁首：標題 + 行動 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {room.floor ? `${room.floor} · ` : ""}
            {room.name}
          </h1>
          <div className="mt-1 text-sm text-zinc-500">
            可借時段：08:30–17:30（每 30 分）
          </div>
        </div>

        <div className="flex gap-2">
          <Link className="btn" href={`/search?date=${encodeURIComponent(date)}`}>
            返回搜尋
          </Link>
          <Link className="btn" href={`/scan/room/${room.id}`}>
            掃碼頁
          </Link>
        </div>
      </div>

      <div className="h-4" />

      <div className="card">
        {/* ✅ 已更新提示（更醒目但不吵） */}
        {showUpdatedBanner ? (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                ✅ 已更新
                <span className="font-semibold">{date}</span>
                <span className="text-blue-800">（{view === "available" ? "可借" : "全部"}）</span>
              </span>
              <span className="ml-1 inline-flex items-center rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-semibold text-blue-900">
                可借：{availableCount} 段
              </span>
              <span className="ml-auto text-xs text-blue-700">已重新計算</span>
            </div>
          </div>
        ) : null}

        {/* 條件列：日期 + 確認（左）/ 顯示切換（右） */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          {/* 左：日期 + 確認（✅ items-end 讓按鈕跟 input 底部對齊） */}
          <form method="get" className="flex items-end gap-3">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="updated" value="1" />

            <div className="w-[320px] max-w-full">
              <div className="label">日期</div>
              <input
                className="input h-11"
                type="date"
                name="date"
                defaultValue={date}
                min={minDate}
                max={maxDate}
              />
            </div>

            <button className="btn primary h-11 px-5" type="submit">
              確認
            </button>
          </form>

          {/* 右：顯示切換（降低權重，像 toggle） */}
          <div className="flex items-end justify-between gap-3 md:justify-end">
            <div className="text-xs text-zinc-500 md:hidden">
              顯示：{view === "available" ? "可借" : "全部"}
            </div>

            <div>
              <div className="label text-right">顯示</div>
              <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1">
                <Link
                  className={[
                    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                    view === "available" ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                  href={`/rooms/${room.id}?date=${encodeURIComponent(date)}&view=available&updated=1`}
                >
                  可借
                </Link>
                <Link
                  className={[
                    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                    view === "all" ? "bg-black text-white" : "text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                  href={`/rooms/${room.id}?date=${encodeURIComponent(date)}&view=all&updated=1`}
                >
                  全部
                </Link>
              </div>
            </div>
          </div>
        </div>

        <hr />

        {/* 時間軸 */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="h2">當日時間軸</div>
            <p className="muted small" style={{ marginTop: 6 }}>
              忙碌時段僅顯示預約人與部門，方便協調。
            </p>
          </div>

          {/* ✅ 只保留一個「可借段數」入口 */}
          <div className="inline-flex items-center gap-2">
            <span className="badge">可借：{availableCount} 段</span>
            <span className="badge">顯示：{view === "available" ? "可借" : "全部"}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {shownRows.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              目前沒有可借時段（可切換「全部」查看忙碌狀態）。
            </div>
          ) : (
            shownRows.map((s) => {
              const isBusy = s.isBusy;

              return (
                <div
                  key={`${s.start}-${s.end}`}
                  className="card"
                  style={{
                    padding: 14,
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="text-xl font-semibold">
                        {s.start} – {s.end}
                      </div>
                      {isBusy ? (
                        <div className="muted small">已被預約 · {s.organizerText}</div>
                      ) : (
                        <div className="muted small">可預約</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isBusy ? (
                        <span className="btn" aria-disabled="true">
                          已被預約
                        </span>
                      ) : (
                        <Link
                          className="btn primary"
                          href={`/reservations/new?roomId=${encodeURIComponent(
                            room.id
                          )}&date=${encodeURIComponent(date)}&start=${encodeURIComponent(
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

        <hr />

        {/* 忙碌清單 */}
        <div className="h2">忙碌清單（摘要）</div>
        {reservations.length === 0 ? (
          <p className="muted">此時段目前沒有任何已確認預約或維護時段。</p>
        ) : (
          <table className="mt-2">
            <thead>
              <tr>
                <th>開始</th>
                <th>結束</th>
                <th>狀態</th>
                <th>預約人</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>{formatHMInTZ(new Date(r.startAt), TZ)}</td>
                  <td>{formatHMInTZ(new Date(r.endAt), TZ)}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.organizer.name}
                    {r.organizer.dept ? (
                      <span className="muted small">（{r.organizer.dept}）</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

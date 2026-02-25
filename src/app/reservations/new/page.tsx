import Link from "next/link";
import { redirect } from "next/navigation";
import { ReservationStatus } from "@prisma/client";
import AttendeePicker, { AttendeeOption } from "@/components/AttendeePicker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  roomId?: string;
  date?: string; // YYYY-MM-DD or YYYY/MM/DD
  start?: string; // HH:mm
  end?: string; // HH:mm
  updated?: string; // "1"
  error?: string; // "conflict" | "demo" | ...
};

const TZ = "Asia/Taipei";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

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

function normalizeDateYmd(input: string | undefined, fallback: string) {
  if (!input) return fallback;
  const v = input.trim().replaceAll("/", "-");
  if (!isValidYmd(v)) return fallback;
  return v;
}

function clampYmd(ymd: string, minYmd: string, maxYmd: string) {
  return ymd < minYmd ? minYmd : ymd > maxYmd ? maxYmd : ymd;
}

function isValidHm(v: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function normalizeTimeHm(input: string | undefined, fallback: string) {
  if (!input) return fallback;
  const v = input.trim();
  if (!isValidHm(v)) return fallback;
  return v;
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
  return aStart < bEnd && bStart < aEnd;
}

function toDisplayYMD(ymd: string) {
  return ymd.replaceAll("-", "/");
}

type RoomLite = {
  id: string;
  name: string;
  floor: string | null;
  capacity: number | null;
};

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const hasDb = !!process.env.DATABASE_URL;

  const roomId = searchParams.roomId;

  // ✅ Demo 模式：即使沒有 roomId 也不要 redirect（可展示頁面）
  // ✅ 真實模式：沒 roomId 才 redirect 回 search
  if (!roomId && hasDb) redirect("/search");

  const wasUpdated = searchParams.updated === "1";
  const errorConflict = searchParams.error === "conflict";
  const errorDemo = searchParams.error === "demo";

  const now = new Date();
  const minDate = formatYMDInTZ(now, TZ);
  const maxDate = formatYMDInTZ(addMonthsSafe(now, 2), TZ);

  const rawDate = normalizeDateYmd(searchParams.date, minDate);
  const clampedDate = clampYmd(rawDate, minDate, maxDate);

  const start = normalizeTimeHm(searchParams.start, "08:30");
  const end = normalizeTimeHm(searchParams.end, "17:30");

  const timeOptions = generateTimeOptions("08:30", "17:30", 30);

  const startAt = buildDateTime(clampedDate, start);
  let endAt = buildDateTime(clampedDate, end);
  if (endAt <= startAt) endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    const rid = roomId ?? "demo-room";
    redirect(
      `/reservations/new?roomId=${encodeURIComponent(
        rid
      )}&date=${encodeURIComponent(minDate)}&start=08:30&end=09:00`
    );
  }

  const startAtISO = startAt.toISOString();
  const endAtISO = endAt.toISOString();

  // ----------------------------
  // ✅ 1) Demo 模式（沒 DB 也能跑）
  // ----------------------------
  let room: RoomLite | null = null;
  let attendeeOptions: AttendeeOption[] = [];
  let hasConflict = false;

  if (!hasDb) {
    const demoRoomId = roomId ?? "demo-room";
    room = {
      id: demoRoomId,
      name: "示範會議室",
      floor: "3F",
      capacity: 10,
    };

    attendeeOptions = [
      { id: "u1", name: "王小明", dept: "產品", email: "ming@example.com" },
      { id: "u2", name: "陳小華", dept: "工程", email: "hua@example.com" },
      { id: "u3", name: "林怡君", dept: "行政", email: "yi@example.com" },
    ];

    hasConflict = false;
  } else {
    // ----------------------------
    // ✅ 2) 真實模式：runtime 才載入 prisma（避免 build 階段炸）
    // ----------------------------
    const { prisma } = await import("@/lib/prisma");

    const foundRoom = await prisma.room.findUnique({
      where: { id: roomId! },
      select: { id: true, name: true, floor: true, capacity: true },
    });
    if (!foundRoom) redirect("/search");

    room = {
      id: foundRoom.id,
      name: foundRoom.name,
      floor: foundRoom.floor ?? null,
      capacity: typeof foundRoom.capacity === "number" ? foundRoom.capacity : null,
    };

    const dayStart = buildDateTime(clampedDate, "00:00");
    const dayEnd = buildDateTime(clampedDate, "23:59");

    const existing = await prisma.reservation.findMany({
      where: {
        roomId: room.id,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
    });

    hasConflict = existing.some((r) => overlaps(startAt, endAt, r.startAt, r.endAt));

    // ✅ 安全 fallback：employee -> user -> []
    const p: any = prisma;

    const rawPeople: {
      id: string;
      name: string | null;
      dept?: string | null;
      email?: string | null;
    }[] = p?.employee?.findMany
      ? await p.employee.findMany({
          select: { id: true, name: true, dept: true, email: true },
          orderBy: [{ dept: "asc" }, { name: "asc" }],
        })
      : p?.user?.findMany
      ? await p.user.findMany({
          select: { id: true, name: true, dept: true, email: true },
          orderBy: [{ dept: "asc" }, { name: "asc" }],
        })
      : [];

    attendeeOptions = rawPeople.map((e) => ({
      id: e.id,
      name: e.name ?? "（未命名）",
      dept: e.dept?.trim() ? e.dept.trim() : "未分類",
      email: e.email?.trim() ? e.email.trim() : null,
    }));
  }

  // 這時 room 一定有值（demo / real 都會設定）
  const isBlockedNow = (!hasDb ? false : hasConflict || errorConflict);

  const titlePrefix = room.floor ? `${room.floor}・` : "";
  const roomTitle = `${titlePrefix}${room.name}`;

  const backToSearchHref = `/search?date=${encodeURIComponent(
    clampedDate
  )}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

  const currentHrefClean = `/reservations/new?roomId=${encodeURIComponent(
    room.id
  )}&date=${encodeURIComponent(clampedDate)}&start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}`;

  async function action(formData: FormData) {
    "use server";
    // ✅ Demo 模式：不碰 DB，直接回到同頁顯示提示（讓 UI 流程可展示）
    if (!process.env.DATABASE_URL) {
      redirect(`${currentHrefClean}&updated=1&error=demo`);
    }

    // ✅ 真實模式：runtime 才 import server action（避免 build 階段就碰 DB）
    const mod = await import("@/app/actions/reservations");
    await mod.createReservation(formData);
  }

  async function updateCriteria(formData: FormData) {
    "use server";

    const nextDateRaw = normalizeDateYmd(
      String(formData.get("date") ?? clampedDate),
      minDate
    );
    const nextDate = clampYmd(nextDateRaw, minDate, maxDate);

    const nextStart = normalizeTimeHm(
      String(formData.get("start") ?? start),
      "08:30"
    );
    const nextEnd = normalizeTimeHm(
      String(formData.get("end") ?? end),
      "17:30"
    );

    redirect(
      `/reservations/new?roomId=${encodeURIComponent(
        room.id
      )}&date=${encodeURIComponent(nextDate)}&start=${encodeURIComponent(
        nextStart
      )}&end=${encodeURIComponent(nextEnd)}&updated=1`
    );
  }

  const openEditPanel = hasDb ? hasConflict || errorConflict : true;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 pb-28 lg:pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">建立預約</h1>
        <p className="mt-1 text-sm text-zinc-500">確認摘要後即可完成預約。</p>

        {!hasDb ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            目前為 <span className="font-semibold">Demo 模式</span>（未設定 DATABASE_URL），
            可用來展示 UI 與流程；送出不會寫入資料庫。
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        {errorConflict ? (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-rose-900">
                送出失敗：此時段剛被他人預約
              </div>
              <div className="mt-1 text-sm text-rose-800">
                {toDisplayYMD(clampedDate)}　{start} – {end}
              </div>
              <div className="mt-2 text-sm text-rose-800">
                請直接在下方「修改時間」調整後再送出。
              </div>
            </div>

            <Link
              href={currentHrefClean}
              className="self-start rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100"
              title="關閉提示"
            >
              關閉
            </Link>
          </div>
        ) : null}

        {errorDemo ? (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Demo 模式：已送出（未寫入資料庫）
              </div>
              <div className="mt-1 text-sm text-amber-800">
                {toDisplayYMD(clampedDate)}　{start} – {end}
              </div>
              <div className="mt-2 text-sm text-amber-800">
                目前僅用於展示 UI/流程；要啟用真實預約請設定 DATABASE_URL。
              </div>
            </div>

            <Link
              href={currentHrefClean}
              className="self-start rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              title="關閉提示"
            >
              關閉
            </Link>
          </div>
        ) : null}

        {!errorConflict && wasUpdated ? (
          <div
            className={[
              "mb-5 flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-start md:justify-between",
              hasDb && hasConflict
                ? "border-rose-200 bg-rose-50"
                : "border-emerald-200 bg-emerald-50",
            ].join(" ")}
          >
            <div>
              <div
                className={[
                  "text-sm font-semibold",
                  hasDb && hasConflict ? "text-rose-900" : "text-emerald-900",
                ].join(" ")}
              >
                {hasDb && hasConflict
                  ? "已更新條件，但此時段仍有撞期"
                  : "已更新條件（可預約）"}
              </div>
              <div
                className={[
                  "mt-1 text-sm",
                  hasDb && hasConflict ? "text-rose-800" : "text-emerald-800",
                ].join(" ")}
              >
                {toDisplayYMD(clampedDate)}　{start} – {end}
              </div>
            </div>

            <Link
              href={currentHrefClean}
              className={[
                "self-start rounded-xl border px-3 py-2 text-xs font-semibold",
                hasDb && hasConflict
                  ? "border-rose-200 bg-white text-rose-900 hover:bg-rose-100"
                  : "border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100",
              ].join(" ")}
              title="關閉提示"
            >
              關閉
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左：摘要 */}
          <div className="lg:col-span-5">
            <div className="text-lg font-semibold text-zinc-900">預約摘要</div>

            <div className="mt-4 flex items-center gap-3">
              {room.floor ? (
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                  {room.floor}
                </span>
              ) : null}
              <div className="text-lg font-semibold">{room.name}</div>
            </div>

            <div className="mt-3 space-y-1 text-sm text-zinc-700">
              <div>
                <span className="text-zinc-500">日期：</span>
                {toDisplayYMD(clampedDate)}
              </div>
              <div>
                <span className="text-zinc-500">時段：</span>
                {start} – {end}
              </div>
            </div>

            {isBlockedNow ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                這個時段已被預約，請按「修改時間」調整後再送出。
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                這個時段目前可預約。
              </div>
            )}

            <details
              className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50"
              open={openEditPanel}
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900">
                修改時間
              </summary>

              <form action={updateCriteria} className="px-4 pb-4 pt-2">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">
                      日期
                    </label>
                    <input
                      name="date"
                      type="date"
                      defaultValue={clampedDate}
                      min={minDate}
                      max={maxDate}
                      className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                    />
                    <div className="mt-1 text-xs text-zinc-500">
                      可選：{minDate} ～ {maxDate}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600">
                        開始時間
                      </label>
                      <select
                        name="start"
                        defaultValue={start}
                        className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600">
                        結束時間
                      </label>
                      <select
                        name="end"
                        defaultValue={end}
                        className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 sm:w-auto"
                    >
                      更新條件
                    </button>

                    <span className="text-xs text-zinc-500">
                      更新後會重新檢查撞期
                    </span>
                  </div>
                </div>
              </form>
            </details>

            <div className="mt-4 hidden lg:block">
              <Link
                href={backToSearchHref}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                返回搜尋
              </Link>
            </div>
          </div>

          {/* 右：表單 */}
          <div className="lg:col-span-7">
            <div className="text-sm font-semibold text-zinc-900">預約資訊</div>

            <form action={action} className="mt-4 space-y-4">
              <input type="hidden" name="roomId" value={room.id} />
              <input type="hidden" name="startAt" value={startAtISO} />
              <input type="hidden" name="endAt" value={endAtISO} />

              <div>
                <label className="block text-xs font-medium text-zinc-600">
                  會議名稱（選填）
                </label>
                <input
                  name="title"
                  placeholder="例如：POA 會議（可留空）"
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600">
                  參與人數
                </label>
                <input
                  name="headcount"
                  type="number"
                  min={1}
                  defaultValue={
                    typeof room.capacity === "number"
                      ? Math.min(10, Math.max(1, room.capacity))
                      : 10
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                />
                {typeof room.capacity === "number" ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    建議容納：{room.capacity} 人
                  </div>
                ) : null}
              </div>

              <AttendeePicker
                employees={attendeeOptions}
                fieldName="attendeeIds"
                defaultSelectedIds={[]}
                searchable
              />

              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <div className="font-semibold text-zinc-900">本次預約</div>
                <div className="mt-2 text-zinc-700">
                  <div>
                    <span className="text-zinc-500">會議室：</span>
                    {roomTitle}
                  </div>
                  <div>
                    <span className="text-zinc-500">時間：</span>
                    {clampedDate} {start}–{end}
                  </div>
                </div>
              </div>

              <div className="pt-2 text-center lg:hidden">
                <Link
                  href={backToSearchHref}
                  className="text-sm font-medium text-zinc-500 underline-offset-4 hover:underline"
                >
                  返回搜尋
                </Link>
              </div>

              <div
                className={[
                  "fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur",
                  "lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0",
                ].join(" ")}
              >
                <button
                  type="submit"
                  disabled={hasDb ? isBlockedNow : false}
                  className={[
                    "h-11 w-full rounded-xl text-sm font-semibold",
                    "lg:w-auto lg:px-6",
                    hasDb && isBlockedNow
                      ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                      : "bg-black text-white hover:opacity-90",
                  ].join(" ")}
                  title={
                    hasDb && isBlockedNow
                      ? "此時段已被預約，請修改時間"
                      : "確認送出預約"
                  }
                >
                  確認預約
                </button>

                <div className="mt-2 text-center text-xs text-zinc-500 lg:text-left">
                  {hasDb
                    ? isBlockedNow
                      ? "此時段已被預約，請先修改時間"
                      : "送出後會再次檢查撞期"
                    : "Demo 模式：送出後只顯示提示，不會寫入資料庫"}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import OverviewGrid from "@/components/OverviewGrid";
import { ReservationStatus } from "@prisma/client";

/**
 * 🔥 重要：避免 Vercel 在 build 階段預渲染這頁
 * 強制改為 runtime 才執行（每次 request 才查 DB）
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

// 固定 30 分 slots：08:30..17:00（start），09:00..17:30（end）
function buildHalfHourSlots() {
  const starts: string[] = [];
  const ends: string[] = [];

  const min = 8 * 60 + 30;
  const max = 17 * 60 + 30;

  for (let m = min; m < max; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    starts.push(`${pad2(h)}:${pad2(mm)}`);
  }

  for (let m = min + 30; m <= max; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    ends.push(`${pad2(h)}:${pad2(mm)}`);
  }

  return { starts, ends, endLabel: "17:30" };
}

function floorSortKey(floor: string | null | undefined) {
  if (!floor) return Number.POSITIVE_INFINITY;
  const s = String(floor).trim().toUpperCase();

  let m = s.match(/^B(\d+)(F)?$/);
  if (m) return -1000 + Number(m[1]);

  m = s.match(/^(\d+)(F)?$/);
  if (m) return Number(m[1]);

  return Number.POSITIVE_INFINITY;
}

type SearchParams = {
  date?: string;
};

type RoomRow = {
  id: string;
  title: string;
  capacity: number | null;
};

type BookingRow = {
  roomId: string;
  startAt: string; // ISO
  endAt: string; // ISO
  organizerName: string | null;
  organizerDept: string | null;
};

type AttendeeOption = {
  id: string;
  name: string;
  dept: string | null;
  email: string | null;
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const hasDb = !!process.env.DATABASE_URL;

  const now = new Date();
  const dateYmd = searchParams?.date ?? formatYMDInTZ(now, TZ);

  const { starts: SLOT_STARTS, ends: SLOT_ENDS, endLabel } =
    buildHalfHourSlots();

  // ----------------------------
  // ✅ Demo 模式：沒 DB 也能展示
  // ----------------------------
  if (!hasDb) {
    const demoRooms: RoomRow[] = [
      { id: "r1", title: "3F・示範會議室 A", capacity: 8 },
      { id: "r2", title: "3F・示範會議室 B", capacity: 12 },
      { id: "r3", title: "2F・示範會議室 C", capacity: 6 },
    ];

    const demoBookings: BookingRow[] = [
      {
        roomId: "r1",
        startAt: new Date(`${dateYmd}T09:00:00`).toISOString(),
        endAt: new Date(`${dateYmd}T10:00:00`).toISOString(),
        organizerName: "王小明",
        organizerDept: "產品",
      },
      {
        roomId: "r2",
        startAt: new Date(`${dateYmd}T13:30:00`).toISOString(),
        endAt: new Date(`${dateYmd}T14:30:00`).toISOString(),
        organizerName: "林怡君",
        organizerDept: "工程",
      },
    ];

    const demoAttendees: AttendeeOption[] = [
      { id: "u1", name: "王小明", dept: "產品", email: "ming@example.com" },
      { id: "u2", name: "陳小華", dept: "工程", email: "hua@example.com" },
      { id: "u3", name: "林怡君", dept: "行政", email: "yi@example.com" },
    ];

    return (
      <div>
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          目前為 <span className="font-semibold">Demo 模式</span>（未設定
          DATABASE_URL），此頁使用示範資料供展示。
        </div>

        <OverviewGrid
          dateYmd={dateYmd}
          slotStarts={SLOT_STARTS}
          slotEnds={SLOT_ENDS}
          rangeEndLabel={endLabel}
          rooms={demoRooms}
          bookings={demoBookings}
          attendeeOptions={demoAttendees}
        />
      </div>
    );
  }

  // ----------------------------
  // ✅ 真實模式：runtime 才載入 prisma（避免 build 階段炸）
  // ----------------------------
  try {
    const { prisma } = await import("@/lib/prisma");

    const roomsRaw = await prisma.room.findMany({
      select: { id: true, name: true, floor: true, capacity: true },
    });

    const rooms: RoomRow[] = roomsRaw
      .slice()
      .sort(
        (a, b) =>
          floorSortKey(a.floor) - floorSortKey(b.floor) ||
          a.name.localeCompare(b.name, "zh-Hant")
      )
      .map((r) => ({
        id: r.id,
        title: `${r.floor ? `${r.floor}・` : ""}${r.name}`,
        capacity: typeof r.capacity === "number" ? r.capacity : null,
      }));

    const dayStart = new Date(`${dateYmd}T00:00:00`);
    const dayEnd = new Date(`${dateYmd}T23:59:59`);

    const bookings = await prisma.reservation.findMany({
      where: {
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      select: {
        roomId: true,
        startAt: true,
        endAt: true,
        organizer: { select: { name: true, dept: true } },
      },
    });

    const normalized: BookingRow[] = bookings.map((b) => ({
      roomId: b.roomId,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      organizerName: b.organizer?.name ?? null,
      organizerDept: b.organizer?.dept ?? null,
    }));

    const people = await prisma.user.findMany({
      select: { id: true, name: true, dept: true, email: true },
      orderBy: [{ dept: "asc" }, { name: "asc" }],
      take: 2000,
    });

    const attendeeOptions: AttendeeOption[] = people.map((p) => ({
      id: p.id,
      name: p.name ?? "（未命名）",
      dept: p.dept ?? "未分類",
      email: p.email ?? null, // ✅ 用 null 比 undefined 更穩
    }));

    return (
      <div>
        <OverviewGrid
          dateYmd={dateYmd}
          slotStarts={SLOT_STARTS}
          slotEnds={SLOT_ENDS}
          rangeEndLabel={endLabel}
          rooms={rooms}
          bookings={normalized}
          attendeeOptions={attendeeOptions}
        />
      </div>
    );
  } catch (error) {
    console.error("Overview page error:", error);

    return (
      <div className="p-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          系統暫時無法連線資料庫，請稍後再試。
        </div>
      </div>
    );
  }
}

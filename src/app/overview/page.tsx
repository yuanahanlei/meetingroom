import { prisma } from "@/lib/prisma";
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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const dateYmd = searchParams?.date ?? formatYMDInTZ(now, TZ);

  const { starts: SLOT_STARTS, ends: SLOT_ENDS, endLabel } =
    buildHalfHourSlots();

  // 🔥 建議包 try/catch，避免 DB 暫時失敗直接炸整頁
  try {
    const roomsRaw = await prisma.room.findMany({
      select: { id: true, name: true, floor: true, capacity: true },
    });

    const rooms = roomsRaw
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
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.BLOCKED],
        },
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

    const normalized = bookings.map((b) => ({
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

    const attendeeOptions = people.map((p) => ({
      id: p.id,
      name: p.name ?? "（未命名）",
      dept: p.dept ?? "未分類",
      email: p.email ?? undefined,
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
      <div className="p-10 text-red-500">
        系統暫時無法連線資料庫，請稍後再試。
      </div>
    );
  }
}

import { prisma } from "@/lib/prisma";
import OverviewGrid from "@/components/OverviewGrid";

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

// ✅ 固定產生 30 分鐘 slots：
// starts: 08:30..17:00
// ends:   09:00..17:30
function buildHalfHourSlots() {
  const starts: string[] = [];
  const ends: string[] = [];

  // start: 08:30 => 510 min
  // end:   17:30 => 1050 min
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
  if (m) return -1000 + Number(m[1]); // B1=-999, B2=-998...

  m = s.match(/^(\d+)(F)?$/);
  if (m) return Number(m[1]); // 1,2,3...

  return Number.POSITIVE_INFINITY;
}

type SearchParams = {
  date?: string; // YYYY-MM-DD
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const dateYmd = sp.date ?? formatYMDInTZ(now, TZ);

  const { starts: SLOT_STARTS, ends: SLOT_ENDS, endLabel } = buildHalfHourSlots();

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

  // 取該日所有預約（未取消）
  const dayStart = new Date(`${dateYmd}T00:00:00`);
  const dayEnd = new Date(`${dateYmd}T23:59:59`);

  const bookings = await prisma.reservation.findMany({
    where: {
      cancelledAt: null,
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

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">總覽</h1>
          <p className="mt-1 text-sm text-zinc-500">
            先拖曳選取空白時段 → 再按「預約」開啟預約（08:30–17:30 / 每 30 分）
          </p>
        </div>

        <form className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600">日期</label>
            <input
              name="date"
              type="date"
              defaultValue={dateYmd}
              className="mt-1 h-11 w-[220px] rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            切換
          </button>
        </form>
      </div>

      <OverviewGrid
        dateYmd={dateYmd}
        slotStarts={SLOT_STARTS}
        slotEnds={SLOT_ENDS}
        rangeEndLabel={endLabel}
        rooms={rooms}
        bookings={normalized}
      />
    </div>
  );
}

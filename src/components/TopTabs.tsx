import { prisma } from "@/lib/prisma";
import OverviewGrid from "@/components/OverviewGrid";

type SearchParams = { date?: string };

function ymdTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const date = sp.date || ymdTodayLocal();

  const rooms = await prisma.room.findMany({
    select: { id: true, name: true, floor: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  // 當日範圍
  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);

  const reservations = await prisma.reservation.findMany({
    where: {
      cancelledAt: null,
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
    select: {
      id: true,
      roomId: true,
      startAt: true,
      endAt: true,
      organizer: { select: { name: true, dept: true } },
    },
  });

  const bookings = reservations.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    organizerName: r.organizer?.name ?? null,
    organizerDept: r.organizer?.dept ?? null,
  }));

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">總覽</h1>
          <p className="mt-1 text-sm text-zinc-500">
            拖曳選取空白時段 → 下方按「預約」開啟預約（08:30–17:30 / 每 30 分）
          </p>
        </div>

        <form className="flex items-end gap-2">
          <div>
            <div className="text-xs font-medium text-zinc-600">日期</div>
            <input
              className="mt-1 h-11 w-[220px] rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              type="date"
              name="date"
              defaultValue={date}
            />
          </div>

          <button
            className="h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:opacity-90"
            type="submit"
          >
            切換
          </button>
        </form>
      </div>

      <OverviewGrid dateYmd={date} rooms={rooms} bookings={bookings} />
    </div>
  );
}

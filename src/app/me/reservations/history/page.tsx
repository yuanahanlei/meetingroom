import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ReservationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const TZ = "Asia/Taipei";

function formatYMD(d: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return ymd.replaceAll("-", "/");
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

export default async function ReservationHistoryPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">歷史紀錄</h1>
        <p className="mt-2 text-sm text-zinc-500">尚未登入。</p>
        <div className="mt-6">
          <Link
            href="/me/reservations"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            回到我的預約
          </Link>
        </div>
      </div>
    );
  }

  const now = new Date();

  // ✅ 只顯示「已結束」：endAt < now
  const history = await prisma.reservation.findMany({
    where: {
      organizerId: user.id,
      endAt: { lt: now },
      // 這裡不排除 CANCELLED，因為歷史本來就應該看得到取消
    },
    orderBy: { startAt: "desc" },
    include: { room: true },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">歷史紀錄</h1>
          <p className="mt-1 text-sm text-zinc-500">
            這裡會顯示已結束的預約（包含已取消）。
          </p>
        </div>

        <div className="shrink-0">
          <Link
            href="/me/reservations"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            回到我的預約
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm text-zinc-500">
          登入者：{user.name} · {user.email}
        </div>
        <div className="mt-4 border-t border-zinc-100" />

        {history.length === 0 ? (
          <div className="py-8">
            <div className="text-lg font-semibold text-zinc-900">
              目前沒有歷史紀錄
            </div>
            <div className="mt-2 text-sm text-zinc-500">
              等預約結束後，就會出現在這裡。
            </div>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:hidden">
              {history.map((r) => {
                const meta = statusMeta(r.status);
                const dateText = formatYMD(r.startAt);
                const timeText = `${formatHM(r.startAt)}–${formatHM(r.endAt)}`;

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4"
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

                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                          meta.cls,
                        ].join(" ")}
                      >
                        {meta.text}
                      </span>
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
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="mt-5 hidden md:block">
              <div className="overflow-hidden rounded-2xl border border-zinc-200">
                <table className="min-w-full border-collapse">
                  <thead className="bg-zinc-50">
                    <tr className="text-left text-sm text-zinc-600">
                      <th className="px-4 py-3 font-semibold">時間</th>
                      <th className="px-4 py-3 font-semibold">會議室</th>
                      <th className="px-4 py-3 font-semibold">會議</th>
                      <th className="px-4 py-3 font-semibold">狀態</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {history.map((r) => {
                      const meta = statusMeta(r.status);
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-4 align-top">
                            <div className="font-semibold text-zinc-900">
                              {formatYMD(r.startAt)}
                            </div>
                            <div className="text-sm text-zinc-600">
                              {formatHM(r.startAt)}–{formatHM(r.endAt)}
                            </div>
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
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                meta.cls,
                              ].join(" ")}
                            >
                              {meta.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                提示：歷史紀錄僅顯示已結束的預約。
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

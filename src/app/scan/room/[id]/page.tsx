import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { scanRoom } from "@/app/actions/scan";
import { getCurrentUser } from "@/lib/auth";

type Params = { id: string };

export default async function ScanRoomPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return <div className="container">找不到會議室</div>;

  const logs = await prisma.accessLog.findMany({
    where: { roomId: id, userId: user.id },
    orderBy: { scannedAt: "desc" },
    take: 10,
    include: { reservation: true },
  });

  return (
    <div className="container">
      <h1 className="h1">掃碼報到（Phase 1）</h1>
      <p className="muted">此頁模擬「掃描門口固定 Room QR」後的落地頁。</p>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div className="h2">{room.floor} · {room.name}</div>
            <div className="muted small">登入者（Mock）：{user.name}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn" href={`/rooms/${room.id}`}>會議室日程</Link>
            <Link className="btn" href="/search">搜尋</Link>
          </div>
        </div>

        <hr />

        <form action={async () => { "use server"; await scanRoom(room.id); }}>
          <button className="btn primary" type="submit">掃碼記錄（寫入 AccessLog）</button>
        </form>

        <hr />

        <div className="h2">最近 10 筆掃碼紀錄</div>
        {logs.length === 0 ? (
          <p className="muted">尚無紀錄。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>對應預約</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.scannedAt).toLocaleString()}</td>
                  <td>
                    {l.reservation ? (
                      <div>
                        <div>{l.reservation.title}</div>
                        <div className="muted small">{new Date(l.reservation.startAt).toLocaleString()} ~ {new Date(l.reservation.endAt).toLocaleString()}</div>
                      </div>
                    ) : (
                      <span className="muted">（無匹配預約）</span>
                    )}
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

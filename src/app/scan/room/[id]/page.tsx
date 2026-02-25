import Link from "next/link";
import { scanRoom } from "@/app/actions/scan";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { id: string };

function formatLocal(d: Date) {
  try {
    return d.toLocaleString("zh-TW");
  } catch {
    return d.toISOString();
  }
}

export default async function ScanRoomPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const p = (await params) as Params;
  const { id } = p;

  const hasDb = !!process.env.DATABASE_URL;

  // ✅ user 可能拿不到（mock auth 也可能沒設 env），所以要保護
  let user: any = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error("getCurrentUser error:", e);
    user = null;
  }

  // ----------------------------
  // ✅ Demo 模式：沒 DB 也能展示
  // ----------------------------
  if (!hasDb) {
    const demoRoom = { id, floor: "3F", name: "示範會議室 A" };
    const demoUser = user?.name ? user : { id: "demo-user", name: "Demo 使用者" };

    return (
      <div className="container">
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          目前為 <span className="font-semibold">Demo 模式</span>（未設定 DATABASE_URL），此頁使用示範資料供展示。
        </div>

        <h1 className="h1">掃碼報到（Phase 1）</h1>
        <p className="muted">此頁模擬「掃描門口固定 Room QR」後的落地頁。</p>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="h2">
                {demoRoom.floor} · {demoRoom.name}
              </div>
              <div className="muted small">
                登入者（Mock）：{demoUser?.name ?? "尚未登入"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/rooms/${demoRoom.id}`}>
                會議室日程
              </Link>
              <Link className="btn" href="/search">
                搜尋
              </Link>
            </div>
          </div>

          <hr />

          {/* Demo：不寫 DB，但可以讓你展示「按了會有反應」 */}
          <form
            action={async () => {
              "use server";
              // 不做任何事，避免誤導寫入
            }}
          >
            <button className="btn primary" type="submit">
              掃碼記錄（Demo：不寫入資料庫）
            </button>
          </form>

          <hr />

          <div className="h2">最近 10 筆掃碼紀錄</div>
          <p className="muted">Demo 模式下不會讀取資料庫紀錄。</p>

          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>對應預約</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatLocal(new Date())}</td>
                <td>
                  <span className="muted">（示範）無匹配預約</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ----------------------------
  // ✅ 真實模式：runtime 才 import prisma + 查 DB
  // ----------------------------
  try {
    const { prisma } = await import("@/lib/prisma");

    const room = await prisma.room.findUnique({
      where: { id },
      select: { id: true, floor: true, name: true },
    });

    if (!room) return <div className="container">找不到會議室</div>;

    // user 可能為 null，這裡用安全邏輯
    const userId = user?.id ?? null;

    const logs =
      userId != null
        ? await prisma.accessLog.findMany({
            where: { roomId: id, userId },
            orderBy: { scannedAt: "desc" },
            take: 10,
            include: { reservation: true },
          })
        : [];

    return (
      <div className="container">
        <h1 className="h1">掃碼報到（Phase 1）</h1>
        <p className="muted">此頁模擬「掃描門口固定 Room QR」後的落地頁。</p>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="h2">
                {room.floor ?? ""} {room.floor ? "·" : ""} {room.name}
              </div>
              <div className="muted small">
                登入者（Mock）：{user?.name ?? "尚未登入"}
              </div>
              {!user?.id ? (
                <div className="muted small">
                  ※ 尚未登入時不會讀取/寫入掃碼紀錄
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/rooms/${room.id}`}>
                會議室日程
              </Link>
              <Link className="btn" href="/search">
                搜尋
              </Link>
            </div>
          </div>

          <hr />

          <form
            action={async () => {
              "use server";
              // ✅ 有登入才寫入
              const u = await getCurrentUser().catch(() => null);
              if (!u?.id) return;
              await scanRoom(room.id);
            }}
          >
            <button className="btn primary" type="submit" disabled={!user?.id}>
              掃碼記錄（寫入 AccessLog）
            </button>
          </form>

          <hr />

          <div className="h2">最近 10 筆掃碼紀錄</div>
          {!user?.id ? (
            <p className="muted">尚未登入，無法顯示個人掃碼紀錄。</p>
          ) : logs.length === 0 ? (
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
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td>{formatLocal(new Date(l.scannedAt))}</td>
                    <td>
                      {l.reservation ? (
                        <div>
                          <div>{l.reservation.title ?? "（未填）"}</div>
                          <div className="muted small">
                            {formatLocal(new Date(l.reservation.startAt))} ~{" "}
                            {formatLocal(new Date(l.reservation.endAt))}
                          </div>
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
  } catch (e) {
    console.error("ScanRoomPage DB error:", e);
    return (
      <div className="container">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          系統暫時無法連線資料庫，請稍後再試。
        </div>
      </div>
    );
  }
}

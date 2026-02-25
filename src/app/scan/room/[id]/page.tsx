import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Params = { id: string };

function formatLocal(d: Date) {
  try {
    return d.toLocaleString("zh-Hant-TW", { hour12: false });
  } catch {
    return d.toISOString();
  }
}

export default async function ScanRoomPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const { id } = (await params) as Params;

  const hasDb = !!process.env.DATABASE_URL;

  // ----------------------------
  // ✅ Demo 模式：沒 DB 也能展示
  // ----------------------------
  if (!hasDb) {
    // demo user：不碰 auth（避免 env 沒設又出錯）
    const demoRoom = { id, floor: "3F", name: "示範會議室 A" };
    const demoUser = { id: "demo-user", name: "Demo 使用者" };

    return (
      <div className="container">
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          目前為 <span className="font-semibold">Demo 模式</span>（未設定
          DATABASE_URL），此頁使用示範資料供展示。
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
                登入者（Mock）：{demoUser.name}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/rooms/${encodeURIComponent(demoRoom.id)}`}>
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
              // Demo 模式不做任何事
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
  // ✅ 真實模式：runtime 才 import prisma + auth + action
  // ----------------------------
  try {
    const [{ prisma }, auth, scan] = await Promise.all([
      import("@/lib/prisma"),
      import("@/lib/auth"),
      import("@/app/actions/scan"),
    ]);

    // ✅ user 可能拿不到（mock auth 沒設 env），所以要保護
    const user = await auth.getCurrentUser().catch((e) => {
      console.error("getCurrentUser error:", e);
      return null;
    });

    const room = await prisma.room.findUnique({
      where: { id },
      select: { id: true, floor: true, name: true },
    });

    if (!room) return <div className="container">找不到會議室</div>;

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
                <div className="muted small">※ 尚未登入時不會讀取/寫入掃碼紀錄</div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={`/rooms/${encodeURIComponent(room.id)}`}>
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
              // ✅ 有登入才寫入（這裡再次取一次 user，避免外層 user 失效）
              const auth2 = await import("@/lib/auth");
              const scan2 = await import("@/app/actions/scan");
              const u = await auth2.getCurrentUser().catch(() => null);
              if (!u?.id) return;

              await scan2.scanRoom(room.id);
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
    console.error("ScanRoomPage error:", e);
    return (
      <div className="container">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          系統暫時無法連線資料庫或載入登入資訊，請稍後再試。
        </div>
      </div>
    );
  }
}

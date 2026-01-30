import "./globals.css";
import Link from "next/link";
import TopNavTabs from "@/components/TopNavTabs";

export const metadata = {
  title: "會議室租借",
  description: "公司內部會議室線上租借 v2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="bg-zinc-50 text-zinc-900">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <strong className="text-2xl md:text-3xl font-semibold tracking-tight">
                  會議室租借
                </strong>
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                  v2
                </span>
              </div>

              <nav className="flex items-center gap-2">
                <Link
                  href="/me/reservations"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  我的預約
                </Link>
              </nav>
            </div>

            {/* Tabs（總覽當主要入口，順序：總覽 → 搜尋） */}
            <TopNavTabs
              items={[
                { href: "/overview", label: "總覽" },
                { href: "/search", label: "搜尋" },
              ]}
            />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-zinc-500">
          v1 使用 Mock Auth（之後可接 SSO）。掃碼頁：/scan/room/[roomId]
        </footer>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export default function TopNavTabs({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="pb-3">
      <div className="flex gap-2 border-b border-zinc-200">
        {items.map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "relative -mb-px inline-flex h-11 items-center justify-center rounded-t-xl px-4 text-sm font-semibold transition",
                active
                  ? "bg-white text-zinc-900 border border-zinc-200 border-b-white"
                  : "text-zinc-600 hover:text-zinc-900",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

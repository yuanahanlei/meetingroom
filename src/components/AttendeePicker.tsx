"use client";

import { useMemo, useState, useCallback, useEffect } from "react";

export type AttendeeOption = {
  id: string;
  name: string;
  dept: string | null;
  email: string | null;
};

type DeptGroup = {
  dept: string;
  people: AttendeeOption[];
};

type Props = {
  /** 由 server page 傳進來的員工清單 */
  employees: AttendeeOption[];

  /** 表單欄位名稱：預設 attendeeIds（逗號分隔） */
  fieldName?: string;

  /** 預設已選 */
  defaultSelectedIds?: string[];

  /** 是否顯示搜尋 */
  searchable?: boolean;

  /** 預設展開前幾個部門（其餘收起）；0 = 全部收起 */
  defaultOpenDeptCount?: number;

  /** 清單最大高度（控制「選人區塊」在 modal 內不要撐太高） */
  listMaxHeightClassName?: string; // e.g. "max-h-[28vh]" | "max-h-[320px]"

  /** ✅ 整個選人區塊是否可收合（建議在 modal 內開啟） */
  collapsible?: boolean;

  /** ✅ 可收合時，預設是否展開（預設 false：收合） */
  defaultExpanded?: boolean;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

// ✅ 統一 icon：展開=▴、收合=▾（語意一致）
function Chevron({ open }: { open: boolean }) {
  return <span className="text-xs text-zinc-500">{open ? "▴" : "▾"}</span>;
}

export default function AttendeePicker({
  employees,
  fieldName = "attendeeIds",
  defaultSelectedIds = [],
  searchable = true,
  defaultOpenDeptCount = 0,
  listMaxHeightClassName = "max-h-[28vh]",
  collapsible = true,
  defaultExpanded = false,
}: Props) {
  // ✅ 用 array 存，更新時 immutable
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [
    ...new Set(defaultSelectedIds),
  ]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // ✅ 整區收合
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const [q, setQ] = useState("");
  const query = normalize(q);

  // 部門開合狀態：true=open, false=closed
  const [openDept, setOpenDept] = useState<Record<string, boolean>>({});

  // ✅ 當 modal 重開/props default 改變時，能 reset 回預設（避免殘留）
  useEffect(() => {
    setSelectedIds([...new Set(defaultSelectedIds)]);
  }, [defaultSelectedIds]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const clearSelected = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const filtered = useMemo(() => {
    const list = employees ?? [];
    if (!query) return list;
    return list.filter((p) => {
      const hay = `${p.name ?? ""} ${p.email ?? ""} ${p.dept ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [employees, query]);

  const groups: DeptGroup[] = useMemo(() => {
    const map = new Map<string, AttendeeOption[]>();

    for (const p of filtered) {
      const key = p.dept?.trim() ? p.dept!.trim() : "未分類";
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "未分類") return 1;
      if (b === "未分類") return -1;
      return a.localeCompare(b, "zh-Hant");
    });

    return keys.map((dept) => ({
      dept,
      people: (map.get(dept) ?? []).slice().sort((a, b) => {
        return (a.name ?? "").localeCompare(b.name ?? "", "zh-Hant");
      }),
    }));
  }, [filtered]);

  // ✅ 計算：每個 dept 已選幾人（用目前顯示的 groups）
  const selectedCountByDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of groups) {
      let cnt = 0;
      for (const p of g.people) if (selectedSet.has(p.id)) cnt += 1;
      map.set(g.dept, cnt);
    }
    return map;
  }, [groups, selectedSet]);

  // ✅ 第一次有 groups 時：預設展開前 N 個部門
  useEffect(() => {
    if (!groups.length) return;

    setOpenDept((prev) => {
      if (Object.keys(prev).length > 0) return prev;

      const next: Record<string, boolean> = {};
      groups.forEach((g, idx) => {
        next[g.dept] = idx < defaultOpenDeptCount;
      });
      return next;
    });
  }, [groups, defaultOpenDeptCount]);

  // ✅ 搜尋時：展開區塊 + 展開部門
  useEffect(() => {
    if (!query) return;
    if (!groups.length) return;

    if (collapsible) setExpanded(true);

    setOpenDept((prev) => {
      const next = { ...prev };
      for (const g of groups) next[g.dept] = true;
      return next;
    });
  }, [query, groups, collapsible]);

  const toggleDept = useCallback((dept: string) => {
    setOpenDept((prev) => {
      const cur = prev[dept] ?? false;
      return { ...prev, [dept]: !cur };
    });
  }, []);

  // ✅ 合併：切換全部展開 / 全部收起（用 prev 計算，避免 closure 不準）
  const toggleAll = useCallback(() => {
    setOpenDept((prev) => {
      const isAllOpen =
        groups.length > 0 && groups.every((g) => (prev[g.dept] ?? false) === true);

      const next = { ...prev };
      const shouldOpen = !isAllOpen;
      for (const g of groups) next[g.dept] = shouldOpen;
      return next;
    });
  }, [groups]);

  const isAllExpanded = useMemo(() => {
    if (!groups.length) return false;
    return groups.every((g) => (openDept[g.dept] ?? false) === true);
  }, [groups, openDept]);

  // ✅ hidden input
  const hiddenValue = selectedIds.join(",");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      {/* header */}
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => {
            if (!collapsible) return;
            setExpanded((v) => !v);
          }}
        >
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-zinc-900">選擇與會人員</div>
            {collapsible ? <Chevron open={expanded} /> : null}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">已選 {selectedIds.length} 人</div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            disabled={!expanded || groups.length === 0}
            title={!expanded ? "展開後可使用" : undefined}
          >
            {isAllExpanded ? "全部收起" : "全部展開"}
          </button>

          <button
            type="button"
            onClick={clearSelected}
            disabled={selectedIds.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            清空已選
          </button>

          {searchable ? (
            <div className="w-[260px] max-w-full md:w-[320px]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋姓名 / 部門 / Email"
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-zinc-100" />

      {/* hidden field */}
      <input type="hidden" name={fieldName} value={hiddenValue} />

      {/* list */}
      {(!collapsible || expanded) ? (
        <div className={`${listMaxHeightClassName} overflow-auto p-3`}>
          {groups.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              找不到符合的人員
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const isOpen = openDept[g.dept] ?? false;
                const count = g.people.length;
                const selectedInDept = selectedCountByDept.get(g.dept) ?? 0;

                return (
                  <div key={g.dept} className="rounded-2xl border border-zinc-200">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                      onClick={() => toggleDept(g.dept)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {g.dept}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {count} 人{selectedInDept > 0 ? ` · 已選 ${selectedInDept}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedInDept > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            已選 {selectedInDept}
                          </span>
                        ) : null}
                        <Chevron open={isOpen} />
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-zinc-100">
                        {g.people.map((p) => {
                          const checked = selectedSet.has(p.id);

                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleId(p.id);
                                }}
                              >
                                <div className="truncate text-sm font-semibold text-zinc-900">
                                  {p.name || "（未命名）"}
                                </div>
                                <div className="truncate text-xs text-zinc-500">
                                  {p.email ?? ""}
                                </div>
                              </button>

                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleId(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 w-5 rounded border-zinc-300"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 text-sm text-zinc-600">
          點上方「選擇與會人員」可展開選人清單
        </div>
      )}
    </div>
  );
}

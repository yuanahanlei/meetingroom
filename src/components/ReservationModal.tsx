"use client";

import { useEffect, useMemo, useState } from "react";

type Attendee = {
  id: string;
  name: string;
  email: string;
  dept?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;

  // 固定資訊
  roomTitle: string;
  roomId: string;

  // 初始（來自拖曳選取）
  initialDateYmd: string; // YYYY-MM-DD
  initialStart: string; // HH:mm
  initialEnd: string; // HH:mm

  // 與會者清單（由父層傳入或 API 拉回）
  attendees: Attendee[];

  // 按下「確認預約」要做什麼（由父層處理：呼叫 server action / route）
  onConfirm: (payload: {
    roomId: string;
    dateYmd: string;
    start: string;
    end: string;
    title?: string;
    headcount?: number;
    attendeeIds: string[];
  }) => Promise<void> | void;

  // 允許時間範圍（預設 08:30–17:30）
  minTime?: string; // HH:mm
  maxTime?: string; // HH:mm
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hmToMin(hm: string) {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return h * 60 + m;
}

function minToHm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function buildTimeOptions(minTime: string, maxTime: string, step = 30) {
  const min = hmToMin(minTime);
  const max = hmToMin(maxTime);
  const arr: string[] = [];
  for (let t = min; t <= max; t += step) arr.push(minToHm(t));
  return arr;
}

export default function ReservationModal({
  open,
  onClose,
  roomTitle,
  roomId,
  initialDateYmd,
  initialStart,
  initialEnd,
  attendees,
  onConfirm,
  minTime = "08:30",
  maxTime = "17:30",
}: Props) {
  const [dateYmd, setDateYmd] = useState(initialDateYmd);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [title, setTitle] = useState("");
  const [headcount, setHeadcount] = useState<number>(0);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 每次重新開 modal，就用新的初始值重置（避免上一次殘留）
  useEffect(() => {
    if (!open) return;
    setDateYmd(initialDateYmd);
    setStart(initialStart);
    setEnd(initialEnd);
    setTitle("");
    setSelected(new Set());
    setErr(null);
    setSubmitting(false);
  }, [open, initialDateYmd, initialStart, initialEnd]);

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const timeOptions = useMemo(
    () => buildTimeOptions(minTime, maxTime, 30),
    [minTime, maxTime]
  );

  // 讓 end 的選項至少 > start
  const endOptions = useMemo(() => {
    const sMin = hmToMin(start);
    return timeOptions.filter((t) => hmToMin(t) > sMin);
  }, [timeOptions, start]);

  // 如果 start 改到 >= end，自動把 end 往後推一格（避免無效狀態）
  useEffect(() => {
    const s = hmToMin(start);
    const e = hmToMin(end);
    if (e > s) return;
    const next = timeOptions.find((t) => hmToMin(t) > s);
    if (next) setEnd(next);
  }, [start, end, timeOptions]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return attendees;

    return attendees.filter((a) => {
      const s = `${a.name} ${a.email} ${a.dept ?? ""}`.toLowerCase();
      return s.includes(kw);
    });
  }, [attendees, q]);

  const selectedCount = selected.size;

  // headcount：若有選與會者，以「已選 + 1(自己)」作為建議（你也可以改成不 +1）
  useEffect(() => {
    // 如果使用者自己手動改 headcount（>0），我們不覆寫他
    // 這裡做「第一次開啟」預設值：自己 + 已選
    if (!open) return;
    setHeadcount(Math.max(1, selectedCount + 1));
  }, [open, selectedCount]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return "日期格式不正確";
    const s = hmToMin(start);
    const e = hmToMin(end);
    if (e <= s) return "結束時間必須晚於開始時間";
    if (s < hmToMin(minTime) || e > hmToMin(maxTime)) {
      return `時間需在 ${minTime}–${maxTime} 內`;
    }
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await onConfirm({
        roomId,
        dateYmd,
        start,
        end,
        title: title.trim() ? title.trim() : undefined,
        headcount: headcount > 0 ? headcount : undefined,
        attendeeIds: Array.from(selected),
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "預約失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4 py-8"
      onMouseDown={onClose}
      onPointerDown={onClose}
    >
      {/* 這層是關鍵：阻止事件往外冒泡，避免被總覽拖曳 handler 吃掉 */}
      <div
        data-reservation-modal="1"
        className="w-full max-w-5xl rounded-3xl bg-white shadow-xl ring-1 ring-black/5"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-8 py-7">
          <div>
            <div className="text-2xl font-semibold tracking-tight">確認預約</div>
            <div className="mt-1 text-sm text-zinc-500">{roomTitle}</div>
          </div>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            onClick={onClose}
          >
            關閉
          </button>
        </div>

        <div className="px-8 pb-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="text-sm font-semibold text-zinc-700">日期</div>
              <input
                className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base font-semibold outline-none focus:ring-2 focus:ring-zinc-200"
                type="date"
                value={dateYmd}
                onChange={(e) => setDateYmd(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="text-sm font-semibold text-zinc-700">開始</div>
              <select
                className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base font-semibold outline-none focus:ring-2 focus:ring-zinc-200"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              >
                {timeOptions
                  .filter((t) => hmToMin(t) < hmToMin(maxTime))
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="text-sm font-semibold text-zinc-700">結束</div>
              <select
                className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base font-semibold outline-none focus:ring-2 focus:ring-zinc-200"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              >
                {endOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-sm font-semibold text-zinc-800">
                會議主題（可選）
              </div>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                placeholder="例如：產品對齊 / 專案討論"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-zinc-800">人數</div>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                inputMode="numeric"
                value={String(headcount || "")}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isNaN(v)) return;
                  setHeadcount(Math.max(0, Math.floor(v)));
                }}
              />
              <div className="mt-2 text-xs text-zinc-500">
                若有選與會者，系統會帶入人數（以已選為準）。
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-sm font-semibold text-zinc-800">與會者（可選）</div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200">
              <div className="flex items-center justify-between gap-3 bg-zinc-50 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-zinc-900">
                    選擇與會人員
                  </div>
                  <div className="text-sm text-zinc-500">已選 {selectedCount} 人</div>
                </div>

                <input
                  className="h-11 w-[320px] max-w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  placeholder="搜尋姓名 / 部門 / Email"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div
                className="max-h-[320px] overflow-auto bg-white"
                // 這裡也很重要：避免外層拖曳監聽誤判
                onPointerDownCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
              >
                {filtered.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-zinc-500">
                    找不到符合的人員
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {filtered.map((a) => {
                      const checked = selected.has(a.id);
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-900">
                              {a.dept ? `${a.dept} - ` : ""}
                              {a.name}
                            </div>
                            <div className="truncate text-sm text-zinc-500">
                              {a.email}
                            </div>
                          </div>

                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-zinc-300"
                              checked={checked}
                              onChange={() => toggle(a.id)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {err ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {err}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </button>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "送出中…" : "確認預約"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

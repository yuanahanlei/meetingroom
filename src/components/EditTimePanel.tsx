"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  roomId: string;
  date: string;          // YYYY-MM-DD
  start: string;         // HH:mm
  end: string;           // HH:mm
};

function buildSlots() {
  const slots: string[] = [];
  let h = 8, m = 30;
  while (true) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    if (h === 17 && m === 30) break;
    m += 30;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
  }
  return slots;
}

const ALL = buildSlots();
const START_OPTIONS = ALL.slice(0, -1); // 08:30–17:00
const END_OPTIONS = ALL.slice(1);       // 09:00–17:30

function pickValid(value: string, options: string[], fallback: string) {
  return options.includes(value) ? value : fallback;
}

export default function EditTimePanel({ roomId, date, start, end }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const init = useMemo(() => {
    return {
      date,
      start: pickValid(start, START_OPTIONS, "10:00"),
      end: pickValid(end, END_OPTIONS, "12:00"),
    };
  }, [date, start, end]);

  const [d, setD] = useState(init.date);
  const [s, setS] = useState(init.start);
  const [e, setE] = useState(init.end);

  // 外部 query 改變時（例如按返回/切換），同步一次
  // 簡單處理：只在「收合」狀態同步，避免你展開時被覆蓋
  if (!open && (d !== init.date || s !== init.start || e !== init.end)) {
    setD(init.date);
    setS(init.start);
    setE(init.end);
  }

  const canApply = Boolean(d && s && e);

  const apply = () => {
    const url =
      `/reservations/new?roomId=${encodeURIComponent(roomId)}` +
      `&date=${encodeURIComponent(d)}` +
      `&start=${encodeURIComponent(s)}` +
      `&end=${encodeURIComponent(e)}`;
    router.push(url);
    setOpen(false);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "收合時間設定" : "修改時間"}
      </button>

      {open ? (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="label">日期</div>
          <input
            className="input"
            type="date"
            value={d}
            onChange={(ev) => setD(ev.target.value)}
          />

          <div style={{ height: 10 }} />

          <div className="label">開始</div>
          <select className="input" value={s} onChange={(ev) => setS(ev.target.value)}>
            {START_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ height: 10 }} />

          <div className="label">結束</div>
          <select className="input" value={e} onChange={(ev) => setE(ev.target.value)}>
            {END_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ height: 14 }} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn primary"
              onClick={apply}
              disabled={!canApply}
            >
              確認
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
            >
              取消
            </button>
          </div>

          <p className="muted small" style={{ marginTop: 10 }}>
            08:30–17:30、每 30 分鐘、不可跨日（伺服器端也會再驗證）。
          </p>
        </div>
      ) : null}
    </div>
  );
}

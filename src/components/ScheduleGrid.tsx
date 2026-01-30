"use client";

import { useMemo, useRef, useState } from "react";
import QuickReserveModal from "@/components/QuickReserveModal";

type Room = { id: string; name: string; floor?: string | null };

type BusyRow = { busy: boolean[]; label: (string | null)[] };

type Props = {
  rooms: Room[];
  date: string;        // YYYY-MM-DD
  slots: string[];     // 含最後一個 17:30
  busyMap: Record<string, BusyRow>;
};

type Sel = {
  roomId: string;
  a: number; // start index (cell index)
  b: number; // end index (cell index)
} | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hourLabel(hm: string) {
  // 只在整點顯示 09:00 / 10:00 ...
  return hm.endsWith(":00") ? hm : "";
}

export default function ScheduleGrid({ rooms, date, slots, busyMap }: Props) {
  const cellCount = slots.length - 1;

  const [dragging, setDragging] = useState(false);
  const [anchor, setAnchor] = useState<{ roomId: string; idx: number } | null>(null);
  const [selection, setSelection] = useState<Sel>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    roomId: string;
    roomTitle: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const roomTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms) {
      const prefix = r.floor ? `${r.floor}・` : "";
      map.set(r.id, `${prefix}${r.name}`);
    }
    return map;
  }, [rooms]);

  const isCellBusy = (roomId: string, idx: number) => {
    const row = busyMap[roomId];
    return row?.busy?.[idx] ?? false;
  };

  const adjustToNearestFreeRange = (roomId: string, from: number, to: number) => {
    // from/to 都是 cell index（0..cellCount-1）
    // 需求：拖曳時不允許跨過忙碌格 → 截斷到最後一格可用
    const a = clamp(from, 0, cellCount - 1);
    const b = clamp(to, 0, cellCount - 1);

    const min = Math.min(a, b);
    const max = Math.max(a, b);

    // 若 anchor 本身就是 busy，直接不給選
    if (isCellBusy(roomId, a)) return { ok: false, a, b: a };

    // 往目標方向掃描，遇到 busy 就截斷
    if (b >= a) {
      // 往右拖
      let end = a;
      for (let i = a; i <= max; i++) {
        if (isCellBusy(roomId, i)) break;
        end = i;
      }
      return { ok: true, a, b: end };
    } else {
      // 往左拖
      let start = a;
      for (let i = a; i >= min; i--) {
        if (isCellBusy(roomId, i)) break;
        start = i;
      }
      return { ok: true, a: start, b: a };
    }
  };

  const begin = (roomId: string, idx: number) => {
    if (isCellBusy(roomId, idx)) return;
    setDragging(true);
    setAnchor({ roomId, idx });
    setSelection({ roomId, a: idx, b: idx });
  };

  const move = (roomId: string, idx: number) => {
    if (!dragging || !anchor) return;
    if (anchor.roomId !== roomId) return; // 只允許同一列
    const res = adjustToNearestFreeRange(roomId, anchor.idx, idx);
    if (!res.ok) return;
    setSelection({ roomId, a: res.a, b: res.b });
  };

  const end = () => {
    if (!dragging || !selection) {
      setDragging(false);
      setAnchor(null);
      return;
    }

    setDragging(false);
    setAnchor(null);

    const startIdx = Math.min(selection.a, selection.b);
    const endIdx = Math.max(selection.a, selection.b) + 1; // end 是下一個 slot

    // 最少選 1 格（30 分）
    if (endIdx <= startIdx) {
      setSelection(null);
      return;
    }

    const roomId = selection.roomId;
    const startTime = slots[startIdx];
    const endTime = slots[endIdx];

    setModalData({
      roomId,
      roomTitle: roomTitle.get(roomId) ?? "會議室",
      startTime,
      endTime,
    });
    setModalOpen(true);
  };

  const isSelected = (roomId: string, idx: number) => {
    if (!selection) return false;
    if (selection.roomId !== roomId) return false;
    const lo = Math.min(selection.a, selection.b);
    const hi = Math.max(selection.a, selection.b);
    return idx >= lo && idx <= hi;
  };

  return (
    <>
      <div
        ref={containerRef}
        onMouseUp={end}
        onMouseLeave={() => {
          // 離開區域也結束拖曳（避免卡住）
          if (dragging) end();
        }}
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          overflow: "auto",
          background: "white",
        }}
      >
        <div style={{ minWidth: 980 }}>
          {/* header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `260px repeat(${cellCount}, 1fr)`,
              position: "sticky",
              top: 0,
              zIndex: 5,
              background: "white",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ padding: "10px 12px", fontWeight: 700 }}>會議室</div>
            {Array.from({ length: cellCount }).map((_, i) => {
              const label = hourLabel(slots[i]);
              return (
                <div
                  key={i}
                  style={{
                    padding: "10px 6px",
                    fontSize: 12,
                    color: "#666",
                    textAlign: "center",
                    borderLeft: "1px solid #f3f3f3",
                    fontWeight: label ? 700 : 400,
                  }}
                  title={slots[i]}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* rows */}
          {rooms.map((room) => {
            const row = busyMap[room.id];
            return (
              <div
                key={room.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `260px repeat(${cellCount}, 1fr)`,
                  borderBottom: "1px solid #f6f6f6",
                }}
              >
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700 }}>
                    {room.floor ? `${room.floor}・` : ""}
                    {room.name}
                  </div>
                  <div className="muted small">{date}</div>
                </div>

                {Array.from({ length: cellCount }).map((_, idx) => {
                  const busy = row?.busy?.[idx] ?? false;
                  const label = row?.label?.[idx] ?? null;
                  const selected = isSelected(room.id, idx);

                  const bg = busy
                    ? "#fff1f2" // rose-50
                    : selected
                    ? "#e0f2fe" // light blue for selection
                    : "white";

                  const borderColor = selected ? "#38bdf8" : "#f3f3f3";

                  return (
                    <div
                      key={idx}
                      onMouseDown={() => begin(room.id, idx)}
                      onMouseEnter={() => move(room.id, idx)}
                      style={{
                        userSelect: "none",
                        height: 38,
                        borderLeft: `1px solid ${borderColor}`,
                        background: bg,
                        cursor: busy ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 6px",
                        fontSize: 11,
                        color: busy ? "#9f1239" : "#111",
                      }}
                      title={busy ? label ?? "已預約" : "拖曳選取可預約"}
                    >
                      {busy ? (
                        <span
                          style={{
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label ?? "已預約"}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ padding: 12, background: "#fafafa" }} className="muted small">
          操作：在同一間會議室那一列，按住滑鼠拖曳選取空白格 → 放開後會跳出預約小視窗。
          （遇到已預約格會自動截斷，避免跨過）
        </div>
      </div>

      {modalOpen && modalData ? (
        <QuickReserveModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          date={date}
          roomId={modalData.roomId}
          roomTitle={modalData.roomTitle}
          startTime={modalData.startTime}
          endTime={modalData.endTime}
        />
      ) : null}
    </>
  );
}

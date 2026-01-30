"use client";

import { useEffect } from "react";
import { createReservation } from "@/app/actions/reservations";

type Props = {
  open: boolean;
  onClose: () => void;

  date: string;       // YYYY-MM-DD
  roomId: string;
  roomTitle: string;

  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
};

function toISO(date: string, hm: string) {
  // "YYYY-MM-DDTHH:mm:00" 會以「使用者本機」時間解析（你們都是台灣內網使用，OK）
  const d = new Date(`${date}T${hm}:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function QuickReserveModal({
  open,
  onClose,
  date,
  roomId,
  roomTitle,
  startTime,
  endTime,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  const startAt = toISO(date, startTime);
  const endAt = toISO(date, endTime);

  return (
    <div
      onMouseDown={() => onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        className="card"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: "min(640px, 100%)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div className="h2">快速預約</div>
            <div className="muted small">
              {roomTitle}｜{date}｜{startTime}–{endTime}
            </div>
          </div>
          <button className="btn" type="button" onClick={onClose}>
            關閉
          </button>
        </div>

        <div style={{ height: 12 }} />

        <form action={createReservation}>
          <input type="hidden" name="roomId" value={roomId} />
          <input type="hidden" name="startAt" value={startAt} />
          <input type="hidden" name="endAt" value={endAt} />

          <div className="label">會議名稱（選填）</div>
          <input className="input" name="title" placeholder="例如：POA 會議（可留空）" />

          <div style={{ height: 10 }} />

          <div className="label">參與人數</div>
          <input className="input" type="number" min={1} name="headcount" defaultValue={10} required />

          <div style={{ height: 14 }} />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button className="btn primary" type="submit" disabled={!startAt || !endAt}>
              確認預約
            </button>
          </div>

          {!startAt || !endAt ? (
            <p className="muted small" style={{ marginTop: 10 }}>
              時間格式不正確，請關閉後重新選取。
            </p>
          ) : (
            <p className="muted small" style={{ marginTop: 10 }}>
              送出後伺服器會再檢查撞期；若撞期將回傳錯誤。
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

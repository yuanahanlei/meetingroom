"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RoomRow = {
  id: string;
  title: string;
  capacity: number | null;
};

type Booking = {
  roomId: string;
  startAt: string; // ISO
  endAt: string; // ISO
  organizerName: string | null;
  organizerDept: string | null;
};

type Props = {
  dateYmd: string; // YYYY-MM-DD
  slotStarts: string[]; // 08:30..17:00
  slotEnds: string[]; // 09:00..17:30
  rangeEndLabel: string; // "17:30"
  rooms: RoomRow[];
  bookings: Booking[];
};

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function formatRange(startHm: string, endHm: string) {
  return `${startHm}–${endHm}`;
}

export default function OverviewGrid(props: Props) {
  const router = useRouter();
  const { dateYmd, slotStarts, slotEnds, rangeEndLabel, rooms, bookings } = props;

  // 固定 30 分/格
  const startMinute = hmToMinutes(slotStarts[0] ?? "08:30");
  const cellCount = slotStarts.length;
  const cellMinutes = 30;

  // 視覺參數
  const CELL_W = 96;
  const ROW_H = 76;
  const leftColW = 260;

  // ✅ 新增一個「右側 end label 欄」避免 17:00 跟 17:30 黏在一起
  const END_LABEL_W = 72;

  const gridRef = useRef<HTMLDivElement | null>(null);

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const arr = map.get(b.roomId) ?? [];
      arr.push(b);
      map.set(b.roomId, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.startAt.localeCompare(b.startAt));
      map.set(k, arr);
    }
    return map;
  }, [bookings]);

  // selection state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selStartIdx, setSelStartIdx] = useState<number | null>(null);
  const [selEndIdx, setSelEndIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // tooltip
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const selection = useMemo(() => {
    if (!selectedRoomId || selStartIdx === null || selEndIdx === null) return null;
    const a = Math.min(selStartIdx, selEndIdx);
    const b = Math.max(selStartIdx, selEndIdx);
    const startHm = slotStarts[a];
    const endHm = slotEnds[b];
    if (!startHm || !endHm) return null;
    return { roomId: selectedRoomId, a, b, startHm, endHm };
  }, [selectedRoomId, selStartIdx, selEndIdx, slotStarts, slotEnds]);

  const isSelectionOverlapping = useMemo(() => {
    if (!selection) return false;
    const roomBookings = bookingsByRoom.get(selection.roomId) ?? [];
    const selStartMin = startMinute + selection.a * cellMinutes;
    const selEndMin = startMinute + (selection.b + 1) * cellMinutes;

    for (const bk of roomBookings) {
      const s = new Date(bk.startAt);
      const e = new Date(bk.endAt);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      if (selStartMin < eMin && sMin < selEndMin) return true;
    }
    return false;
  }, [selection, bookingsByRoom, startMinute]);

  function getCellIndexFromEvent(ev: PointerEvent | React.PointerEvent, rowEl: HTMLElement) {
    const rect = rowEl.getBoundingClientRect();
    const x = ("clientX" in ev ? ev.clientX : 0) - rect.left;
    const xInTimeline = x - leftColW;
    const idx = Math.floor(xInTimeline / CELL_W);
    return clamp(idx, 0, cellCount - 1);
  }

  function clearSelection() {
    setSelectedRoomId(null);
    setSelStartIdx(null);
    setSelEndIdx(null);
    setIsDragging(false);
  }

  useEffect(() => {
    const onPointerUp = () => setIsDragging(false);
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  // Header labels：顯示 08:30 + 每整點
  const headerLabels = useMemo(() => {
    return slotStarts.map((t, i) => {
      const show = i === 0 || t.endsWith(":00");
      return { t, i, show };
    });
  }, [slotStarts]);

  // timeline 寬度（不包含右側 end label 欄）
  const timelineW = cellCount * CELL_W;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div ref={gridRef} className="w-full overflow-x-auto">
        <div
          className="min-w-max"
          style={{ width: leftColW + timelineW + END_LABEL_W }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-20 bg-white"
            style={{
              display: "grid",
              gridTemplateColumns: `${leftColW}px repeat(${cellCount}, ${CELL_W}px) ${END_LABEL_W}px`,
              borderBottom: "1px solid rgb(228 228 231)",
            }}
          >
            <div className="px-5 py-4 text-sm font-semibold text-zinc-900">會議室</div>

            {headerLabels.map(({ t, show }) => (
              <div
                key={t}
                className="py-4 text-center text-sm font-semibold text-zinc-600"
              >
                {show ? t : ""}
              </div>
            ))}

            {/* ✅ 最右側獨立欄位：17:30（不會再黏 17:00） */}
            <div className="py-4 pr-4 text-right text-sm font-semibold text-zinc-500">
              {rangeEndLabel}
            </div>
          </div>

          {/* Rows */}
          {rooms.map((room) => {
            const roomBookings = bookingsByRoom.get(room.id) ?? [];

            return (
              <div
                key={room.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `${leftColW}px repeat(${cellCount}, ${CELL_W}px) ${END_LABEL_W}px`,
                  height: ROW_H,
                  borderBottom: "1px solid rgb(244 244 245)",
                  position: "relative",
                }}
                onPointerDown={(e) => {
                  const rowEl = e.currentTarget as unknown as HTMLElement;
                  const target = e.target as HTMLElement;
                  if (target?.dataset?.booking === "1") return;

                  e.preventDefault();
                  const idx = getCellIndexFromEvent(e, rowEl);

                  setSelectedRoomId(room.id);
                  setSelStartIdx(idx);
                  setSelEndIdx(idx);
                  setIsDragging(true);

                  try {
                    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                  } catch {}
                }}
                onPointerMove={(e) => {
                  if (!isDragging) return;
                  if (!selectedRoomId || selectedRoomId !== room.id) return;

                  const rowEl = e.currentTarget as unknown as HTMLElement;
                  const idx = getCellIndexFromEvent(e, rowEl);
                  setSelEndIdx(idx);
                }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target?.dataset?.booking === "1") return;
                  if (isDragging) return;

                  const rowEl = e.currentTarget as unknown as HTMLElement;
                  const idx = getCellIndexFromEvent(
                    { clientX: (e as any).clientX } as any,
                    rowEl
                  );

                  if (selectedRoomId !== room.id || selStartIdx === null) {
                    setSelectedRoomId(room.id);
                    setSelStartIdx(idx);
                    setSelEndIdx(idx);
                    return;
                  }
                  setSelEndIdx(idx);
                }}
              >
                {/* Left sticky */}
                <div
                  className="sticky left-0 z-10 bg-white px-5 py-4"
                  style={{ width: leftColW, borderRight: "1px solid rgb(244 244 245)" }}
                >
                  <div className="text-base font-semibold text-zinc-900 leading-6">{room.title}</div>
                  {typeof room.capacity === "number" ? (
                    <div className="mt-1 text-sm text-zinc-500">建議 {room.capacity} 人</div>
                  ) : (
                    <div className="mt-1 text-sm text-zinc-400">&nbsp;</div>
                  )}
                </div>

                {/* Background cells */}
                {slotStarts.map((t, i) => (
                  <div
                    key={t}
                    style={{
                      height: "100%",
                      borderLeft: i === 0 ? "0px" : "1px solid rgba(244,244,245,0.8)",
                    }}
                  />
                ))}

                {/* ✅ 右側 end label 欄位（每列空白，不畫內容） */}
                <div style={{ height: "100%" }} />

                {/* Bars layer（只覆蓋 timeline，不要蓋到右側 17:30 欄） */}
                <div
                  style={{
                    position: "absolute",
                    left: leftColW,
                    top: 0,
                    width: timelineW,
                    height: ROW_H,
                    pointerEvents: "none",
                  }}
                >
                  {roomBookings.map((b, idx) => {
                    const s = new Date(b.startAt);
                    const e = new Date(b.endAt);
                    const sMin = s.getHours() * 60 + s.getMinutes();
                    const eMin = e.getHours() * 60 + e.getMinutes();

                    const startIdx = clamp(Math.floor((sMin - startMinute) / cellMinutes), 0, cellCount);
                    const endIdx = clamp(Math.ceil((eMin - startMinute) / cellMinutes), 0, cellCount);
                    const widthCells = Math.max(1, endIdx - startIdx);

                    const startHm = slotStarts[startIdx] ?? slotStarts[0];
                    const endHm = slotEnds[endIdx - 1] ?? rangeEndLabel;

                    const who =
                      b.organizerName && b.organizerDept
                        ? `${b.organizerName}（${b.organizerDept}）`
                        : b.organizerName
                        ? b.organizerName
                        : "已被預約";

                    const text = `${formatRange(startHm, endHm)}  ${who}`;

                    return (
                      <div
                        key={`${b.roomId}-${idx}-${b.startAt}`}
                        data-booking="1"
                        style={{
                          position: "absolute",
                          left: startIdx * CELL_W + 6,
                          top: 10,
                          width: widthCells * CELL_W - 12,
                          height: ROW_H - 20,
                          borderRadius: 14,
                          background: "rgba(244, 63, 94, 0.08)",
                          border: "1px solid rgba(244, 63, 94, 0.25)",
                          pointerEvents: "auto",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 14px",
                          color: "rgb(190 18 60)",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        onMouseEnter={(ev) => {
                          const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                          setHoverTip({ x: rect.left + rect.width / 2, y: rect.top - 10, text });
                        }}
                        onMouseLeave={() => setHoverTip(null)}
                        onClick={(ev) => {
                          const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                          setHoverTip({ x: rect.left + rect.width / 2, y: rect.top - 10, text });
                        }}
                      >
                        {text}
                      </div>
                    );
                  })}
                </div>

                {/* Selection overlay（同樣只覆蓋 timeline） */}
                {selection && selection.roomId === room.id ? (
                  <div
                    style={{
                      position: "absolute",
                      left: leftColW + selection.a * CELL_W + 6,
                      top: 10,
                      width: (selection.b - selection.a + 1) * CELL_W - 12,
                      height: ROW_H - 20,
                      borderRadius: 14,
                      background: "rgba(24, 24, 27, 0.06)",
                      border: "1px solid rgba(24, 24, 27, 0.18)",
                      pointerEvents: "none",
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white px-5 py-4">
        <div className="text-sm text-zinc-600">
          {selection ? (
            <>
              已選：<span className="font-semibold text-zinc-900">{selection.startHm}–{selection.endHm}</span>
              {isSelectionOverlapping ? (
                <span className="ml-2 text-rose-600 font-semibold">（此區間已被預約）</span>
              ) : null}
            </>
          ) : (
            "拖曳或點選空白格來選取時段"
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            onClick={() => {
              setHoverTip(null);
              clearSelection();
            }}
          >
            清除
          </button>

          <button
            type="button"
            disabled={!selection || isSelectionOverlapping}
            className={[
              "h-10 rounded-xl px-4 text-sm font-semibold",
              !selection || isSelectionOverlapping
                ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                : "bg-black text-white hover:opacity-90",
            ].join(" ")}
            onClick={() => {
              if (!selection) return;
              if (isSelectionOverlapping) return;

              const href =
                `/reservations/new?roomId=${encodeURIComponent(selection.roomId)}` +
                `&date=${encodeURIComponent(dateYmd)}` +
                `&start=${encodeURIComponent(selection.startHm)}` +
                `&end=${encodeURIComponent(selection.endHm)}`;

              router.push(href);
            }}
          >
            預約
          </button>
        </div>
      </div>

      {/* Tooltip */}
      {hoverTip ? (
        <div
          className="fixed z-50"
          style={{
            left: hoverTip.x,
            top: hoverTip.y,
            transform: "translate(-50%, -100%)",
          }}
          onClick={() => setHoverTip(null)}
        >
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-lg">
            {hoverTip.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

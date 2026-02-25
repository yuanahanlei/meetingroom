"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import AttendeePicker, { AttendeeOption } from "@/components/AttendeePicker";
import { createReservationInline } from "@/app/actions/reservations";

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
  dateYmd: string; // YYYY-MM-DD (Asia/Taipei)
  slotStarts: string[]; // 08:30..17:00
  slotEnds: string[]; // 09:00..17:30
  rangeEndLabel?: string; // e.g. "17:30"
  rooms: RoomRow[];
  bookings: Booking[];
  attendeeOptions?: AttendeeOption[]; // optional：有傳就能在 modal 選人
};

const START_HM = "08:30";
const END_HM = "17:30";

// 視覺參數：可微調讓更像 Google Calendar
const COL_MIN_W = 190;
const TIME_COL_W = 110;
const HEADER_H = 72;
const ROW_H = 44; // 每 30 分高度（越大越鬆）
const GRID_BORDER = "border-zinc-100";
const GRID_BG = "bg-white";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return h * 60 + m;
}

function minutesToHm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function snapTo30(min: number) {
  return Math.round(min / 30) * 30;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

function parseISOToLocalMinutes(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export default function OverviewGrid({
  dateYmd,
  slotStarts,
  slotEnds,
  rangeEndLabel = END_HM,
  rooms,
  bookings,
  attendeeOptions = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const startMin = hmToMinutes(START_HM);
  const endMin = hmToMinutes(END_HM);
  const minutesPerPx = 30 / ROW_H;
  const pxPerMinute = ROW_H / 30;

  // bookings -> by room (minutes)
  const byRoom = useMemo(() => {
    const map = new Map<string, { start: number; end: number; who: string }[]>();
    for (const b of bookings) {
      const s = parseISOToLocalMinutes(b.startAt);
      const e = parseISOToLocalMinutes(b.endAt);

      const cs = clamp(s, startMin, endMin);
      const ce = clamp(e, startMin, endMin);
      if (ce <= cs) continue;

      const who =
        b.organizerName && b.organizerDept
          ? `${b.organizerName}（${b.organizerDept}）`
          : b.organizerName
          ? b.organizerName
          : b.organizerDept
          ? `（${b.organizerDept}）`
          : "已預約";

      const arr = map.get(b.roomId) ?? [];
      arr.push({ start: cs, end: ce, who });
      map.set(b.roomId, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.start - b.start);
      map.set(k, arr);
    }
    return map;
  }, [bookings, startMin, endMin]);

  // 固定高度（避免你說的後面空白/消失）
  const totalSlots = slotStarts.length;
  const gridBodyH = totalSlots * ROW_H;

  // selection (drag)
  const [selection, setSelection] = useState<{
    roomId: string;
    start: number;
    end: number;
    valid: boolean;
  } | null>(null);

  const dragRef = useRef<{
    roomId: string;
    anchorMin: number;
    dragging: boolean;
    pointerId: number | null;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [headcount, setHeadcount] = useState<string>("1");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ✅ 讓 modal 可調整開始/結束（避免使用者要重拉）
  const [draftStart, setDraftStart] = useState<number | null>(null);
  const [draftEnd, setDraftEnd] = useState<number | null>(null);

  const selectedRoom = useMemo(() => {
    if (!selection) return null;
    return rooms.find((r) => r.id === selection.roomId) ?? null;
  }, [selection, rooms]);

  function validateRange(roomId: string, s: number, e: number) {
    const ranges = byRoom.get(roomId) ?? [];
    return !ranges.some((r) => overlap(s, e, r.start, r.end));
  }

  useEffect(() => {
    if (!modalOpen) return;
    if (!selection) return;

    // 初次打開 modal：以選取值當 draft
    setDraftStart(selection.start);
    setDraftEnd(selection.end);

    // headcount 初值
    if (selectedRoom?.capacity && Number.isFinite(selectedRoom.capacity)) {
      setHeadcount(String(Math.min(4, selectedRoom.capacity)));
    } else {
      setHeadcount("1");
    }
  }, [modalOpen, selection, selectedRoom]);

  function clearSelection() {
    setSelection(null);
    setModalOpen(false);
    setSubmitError(null);
    setDraftStart(null);
    setDraftEnd(null);
  }

  function startDrag(roomId: string, e: React.PointerEvent<HTMLDivElement>) {
    if (isPending) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const rawMin = startMin + y * minutesPerPx;
    const snapped = clamp(snapTo30(rawMin), startMin, endMin - 30);

    dragRef.current = {
      roomId,
      anchorMin: snapped,
      dragging: true,
      pointerId: e.pointerId,
    };

    try {
      el.setPointerCapture(e.pointerId);
    } catch {}

    const valid = validateRange(roomId, snapped, snapped + 30);
    setSelection({ roomId, start: snapped, end: snapped + 30, valid });
  }

  function moveDrag(roomId: string, e: React.PointerEvent<HTMLDivElement>) {
    const st = dragRef.current;
    if (!st?.dragging) return;
    if (st.roomId !== roomId) return;

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const rawMin = startMin + y * minutesPerPx;
    const snapped = clamp(snapTo30(rawMin), startMin, endMin);

    let a = st.anchorMin;
    let b = snapped;
    if (b === a) b = a + 30;

    let s = Math.min(a, b);
    let en = Math.max(a, b);

    s = clamp(s, startMin, endMin - 30);
    en = clamp(en, s + 30, endMin);

    const valid = validateRange(roomId, s, en);
    setSelection({ roomId, start: s, end: en, valid });
  }

  function endDrag(roomId: string) {
    const st = dragRef.current;
    if (!st?.dragging) return;
    if (st.roomId !== roomId) return;

    dragRef.current = { ...st, dragging: false };

    const cur = selection;
    if (!cur) return;

    if (!cur.valid) {
      setToast("選取範圍包含已預約時段，請改選空白時段。");
      return;
    }
  }

  function onClickBook() {
    if (!selection) {
      setToast("請先在空白處拖曳選取一段時間。");
      return;
    }
    if (!selection.valid) {
      setToast("目前選取範圍包含已預約時段，請改選空白時段。");
      return;
    }
    setSubmitError(null);
    setModalOpen(true);
  }

  // 下拉選單選項（同一天的 30 分 slot）
  const modalStartOptions = useMemo(() => slotStarts, [slotStarts]);
  const modalEndOptions = useMemo(() => slotEnds, [slotEnds]);

  const modalValid = useMemo(() => {
    if (!selection || draftStart == null || draftEnd == null) return false;
    if (draftEnd <= draftStart) return false;
    return validateRange(selection.roomId, draftStart, draftEnd);
  }, [selection, draftStart, draftEnd, byRoom]);

  function submitBooking(formEl: HTMLFormElement) {
    if (!selection || !selectedRoom) return;
    if (draftStart == null || draftEnd == null) return;

    setSubmitError(null);

    startTransition(async () => {
      try {
        const fd = new FormData(formEl);
        fd.set("roomId", selection.roomId);

        const startHm = minutesToHm(draftStart);
        const endHm = minutesToHm(draftEnd);

        fd.set("startAt", `${dateYmd}T${startHm}:00`);
        fd.set("endAt", `${dateYmd}T${endHm}:00`);

        await createReservationInline(fd);

        setModalOpen(false);
        setSelection(null);
        setDraftStart(null);
        setDraftEnd(null);

        router.refresh();
        setToast("✅ 已完成預約");
      } catch (e: any) {
        setSubmitError(e?.message ? String(e.message) : "預約失敗，請稍後再試");
      }
    });
  }

  const roomCols = useMemo(() => rooms, [rooms]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">時間軸（類 Google 日曆）</div>
          <div className="mt-1 text-xs text-zinc-500">在空白處拖曳選取一段時間 → 按「預約」</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClickBook}
            disabled={isPending || !selection || !selection.valid}
            className={[
              "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
              selection && selection.valid && !isPending
                ? "bg-black text-white hover:opacity-90"
                : "bg-zinc-100 text-zinc-400",
            ].join(" ")}
          >
            預約
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            清除
          </button>
        </div>
      </div>

      {/* toast */}
      {toast ? (
        <div className="px-5 pt-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
            {toast}
          </div>
        </div>
      ) : null}

      {/* scroll area */}
      <div className="relative overflow-auto" style={{ maxHeight: "72vh" }}>
        <div className="min-w-full" style={{ minWidth: TIME_COL_W + roomCols.length * COL_MIN_W }}>
          {/* sticky header row */}
          <div className="sticky top-0 z-20">
            <div className={`flex ${GRID_BG} border-b ${GRID_BORDER}`}>
              <div
                className={`shrink-0 border-r ${GRID_BORDER} px-4`}
                style={{ width: TIME_COL_W, height: HEADER_H }}
              >
                <div className="flex h-full items-center">
                  <div className="text-sm font-semibold text-zinc-700">時間</div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex">
                  {roomCols.map((r) => (
                    <div
                      key={r.id}
                      className={`shrink-0 border-r ${GRID_BORDER} px-4`}
                      style={{ width: COL_MIN_W, height: HEADER_H }}
                    >
                      <div className="flex h-full flex-col justify-center">
                        <div className="truncate text-sm font-semibold text-zinc-900">{r.title}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          建議 {typeof r.capacity === "number" ? r.capacity : "—"} 人
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* body */}
          <div className="flex">
            {/* time column */}
            <div className={`shrink-0 border-r ${GRID_BORDER}`} style={{ width: TIME_COL_W }}>
              <div style={{ height: gridBodyH }} className="relative">
                {slotStarts.map((hm, idx) => {
                  const isHour = hm.endsWith(":00");
                  return (
                    <div
                      key={hm}
                      className={`flex items-start px-4 ${idx === 0 ? "" : `border-t ${GRID_BORDER}`}`}
                      style={{ height: ROW_H }}
                    >
                      <div className={["mt-1", isHour ? "text-base font-semibold text-zinc-900" : "text-sm text-zinc-400"].join(" ")}>
                        {hm}
                      </div>
                    </div>
                  );
                })}
                <div className={`absolute left-0 right-0 border-t ${GRID_BORDER}`} style={{ top: gridBodyH }}>
                  <div className="px-4 py-2 text-sm font-semibold text-zinc-500">{rangeEndLabel}</div>
                </div>
              </div>
            </div>

            {/* rooms grid */}
            <div className="flex-1">
              <div className="flex">
                {roomCols.map((room) => {
                  const blocks = byRoom.get(room.id) ?? [];
                  return (
                    <div
                      key={room.id}
                      className={`shrink-0 border-r ${GRID_BORDER}`}
                      style={{ width: COL_MIN_W }}
                    >
                      <div className="relative" style={{ height: gridBodyH }}>
                        {slotStarts.map((hm, idx) => (
                          <div
                            key={`${room.id}-${hm}`}
                            className={idx === 0 ? "" : `border-t ${GRID_BORDER}`}
                            style={{ height: ROW_H }}
                          />
                        ))}
                        <div className={`absolute left-0 right-0 border-t ${GRID_BORDER}`} style={{ top: gridBodyH }} />

                        {blocks.map((b, i) => {
                          const top = (b.start - startMin) * pxPerMinute;
                          const height = (b.end - b.start) * pxPerMinute;
                          return (
                            <div
                              key={`${room.id}-${b.start}-${b.end}-${i}`}
                              className="absolute left-2 right-2 rounded-xl border border-zinc-200 bg-zinc-100/70 px-3 py-2 text-xs text-zinc-800"
                              style={{ top, height: Math.max(22, height), overflow: "hidden" }}
                              title={b.who}
                            >
                              <div className="font-semibold text-zinc-800">已預約</div>
                              <div className="mt-1 truncate text-zinc-600">{b.who}</div>
                            </div>
                          );
                        })}

                        {selection && selection.roomId === room.id ? (
                          <div
                            className={[
                              "absolute left-2 right-2 rounded-xl ring-2",
                              selection.valid ? "bg-black/5 ring-black/30" : "bg-rose-50 ring-rose-300",
                            ].join(" ")}
                            style={{
                              top: (selection.start - startMin) * pxPerMinute,
                              height: (selection.end - selection.start) * pxPerMinute,
                            }}
                          />
                        ) : null}

                        <div
                          className="absolute inset-0"
                          style={{
                            cursor: isPending ? "not-allowed" : "crosshair",
                            background: "transparent",
                          }}
                          onPointerDown={(e) => startDrag(room.id, e)}
                          onPointerMove={(e) => moveDrag(room.id, e)}
                          onPointerUp={() => endDrag(room.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && selection && selectedRoom ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => !isPending && setModalOpen(false)} // ✅ 用 mousedown，避免 click 被子元素奇怪穿透
        >
          <div
            className="w-full max-w-[760px] rounded-2xl max-h-[82vh] bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()} // ✅ 阻止 backdrop 關閉
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">確認預約</div>
                <div className="mt-1 text-sm text-zinc-500">{selectedRoom.title}</div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                onClick={() => setModalOpen(false)}
                disabled={isPending}
              >
                關閉
              </button>
            </div>

            {/* ✅ 日期/時間：顯示日期 + 可調開始/結束 */}
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="text-xs font-semibold text-zinc-600">日期</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">{dateYmd}</div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold text-zinc-600">開始</div>
                <select
                  className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  value={draftStart == null ? "" : minutesToHm(draftStart)}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = hmToMinutes(v);
                    setDraftStart(next);
                    // 保證 end > start
                    if (draftEnd != null && draftEnd <= next) setDraftEnd(next + 30);
                  }}
                  disabled={isPending}
                >
                  {modalStartOptions.map((hm) => (
                    <option key={hm} value={hm}>
                      {hm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold text-zinc-600">結束</div>
                <select
                  className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  value={draftEnd == null ? "" : minutesToHm(draftEnd)}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = hmToMinutes(v);
                    setDraftEnd(next);
                    if (draftStart != null && next <= draftStart) setDraftStart(next - 30);
                  }}
                  disabled={isPending}
                >
                  {modalEndOptions.map((hm) => (
                    <option key={hm} value={hm}>
                      {hm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!modalValid ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                目前時間範圍包含已預約時段或不合法，請調整開始/結束。
              </div>
            ) : null}

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!modalValid) return;
                submitBooking(e.currentTarget);
              }}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600">會議主題（可選）</label>
                  <input
                    name="title"
                    className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                    placeholder="例如：產品對齊 / 專案討論"
                    disabled={isPending}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600">人數</label>
                  <input
                    name="headcount"
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    inputMode="numeric"
                    className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                    disabled={isPending}
                  />
                  <div className="mt-1 text-xs text-zinc-500">若有選與會者，系統也會帶入人數（以已選為準）。</div>
                </div>
              </div>

              {/* ✅ 這裡改成符合你貼的 AttendeePicker props */}
              {attendeeOptions.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-semibold text-zinc-600">與會者（可選）</div>
                  <AttendeePicker
                    employees={attendeeOptions}
                    fieldName="attendeeIds"
                    defaultSelectedIds={[]}
                    searchable
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  目前未載入員工名單（attendeeOptions），仍可直接預約。
                </div>
              )}

              {submitError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {submitError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={[
                    "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold",
                    isPending || !modalValid ? "bg-zinc-100 text-zinc-400" : "bg-black text-white hover:opacity-90",
                  ].join(" ")}
                  disabled={isPending || !modalValid}
                >
                  {isPending ? "建立中..." : "確認預約"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

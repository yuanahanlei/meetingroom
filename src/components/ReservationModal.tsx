"use client";

import { useEffect, useMemo, useRef } from "react";
import { createReservation } from "@/app/actions/reservations";

export default function ReservationModal({
  open,
  onClose,
  roomId,
  startAtISO,
  endAtISO,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  startAtISO: string;
  endAtISO: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // v1：部門用 env（你 server action 也會再覆蓋成 env 的 dept）
  const userDept = useMemo(() => {
    if (typeof window === "undefined") return "SCOT 北區";
    return (process.env.NEXT_PUBLIC_APP_DEFAULT_USER_DEPT as string) || "SCOT 北區";
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const canSubmit = Boolean(roomId && startAtISO && endAtISO);

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(560px,calc(100vw-24px))] rounded-2xl border border-zinc-200 p-0 shadow-xl backdrop:bg-black/30"
      onClose={onClose}
    >
      <div className="border-b border-zinc-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">建立預約</div>
            <div className="mt-1 text-sm text-zinc-500">
              時段：{startAtISO ? new Date(startAtISO).toLocaleString() : "-"} ~{" "}
              {endAtISO ? new Date(endAtISO).toLocaleString() : "-"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            關閉
          </button>
        </div>
      </div>

      <div className="bg-white px-5 py-4">
        {!canSubmit ? (
          <div className="text-sm text-zinc-600">缺少必要參數，請重新選取時段。</div>
        ) : (
          <form action={createReservation}>
            <input type="hidden" name="roomId" value={roomId} />
            <input type="hidden" name="startAt" value={startAtISO} />
            <input type="hidden" name="endAt" value={endAtISO} />
            <input type="hidden" name="department" value={userDept} />

            <div className="text-sm font-semibold">部門</div>
            <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              {userDept}
            </div>

            <div className="mt-4 text-sm font-semibold">會議名稱（選填）</div>
            <input
              name="title"
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              placeholder="例如：POA 會議（可留空）"
            />

            <div className="mt-4 text-sm font-semibold">參與人數</div>
            <input
              name="headcount"
              type="number"
              min={1}
              defaultValue={10}
              required
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
            />

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                取消
              </button>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-90"
              >
                確認預約
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

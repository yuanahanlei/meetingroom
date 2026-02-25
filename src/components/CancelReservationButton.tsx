"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelReservation } from "@/app/actions/reservations";

type Props = {
  reservationId: string;
  defaultReason?: string;
};

export default function CancelReservationButton({
  reservationId,
  defaultReason = "使用者取消",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isPending]);

  const onConfirm = () => {
    if (isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("reservationId", reservationId);
        fd.set("reason", defaultReason);

        await cancelReservation(fd);

        // 若 cancelReservation 內部有 redirect，通常不會跑到這裡
        router.refresh();
        setOpen(false);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : "取消失敗，請稍後再試");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={isPending}
        className={[
          "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
          "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
          "disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
      >
        {isPending ? "取消中..." : "取消"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[520px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold text-zinc-900">
              確認取消預約？
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              取消後會立刻生效（頁面會更新），並只保留最近一次取消紀錄。
            </p>

            {error ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                  "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                返回
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold",
                  "bg-rose-600 text-white hover:bg-rose-700",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {isPending ? "取消中..." : "確認取消"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

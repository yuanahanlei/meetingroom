"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reservationId", reservationId);
      fd.set("reason", defaultReason);

      // ✅ 按下「確認」就直接取消（呼叫 Server Action）
      await cancelReservation(fd);

      // 如果你的 cancelReservation 內部 redirect 了，下面其實不會跑到
      // 但保留也沒壞處（避免你之後拿掉 redirect）
      router.refresh();
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        className="btn danger"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "取消中..." : "取消"}
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="card"
            style={{ width: "min(520px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h2">確認取消預約？</div>
            <p className="muted">
              取消後會立刻生效（頁面會更新），並只保留最近一次取消紀錄。
            </p>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                返回
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={onConfirm}
                disabled={isPending}
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

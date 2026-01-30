"use client";

import { useMemo } from "react";
import OverviewGrid from "@/components/OverviewGrid";

type SourceRoom = {
  id: string;
  name?: string | null;
  title?: string | null;
  capacity?: number | null;
};

type Booking = {
  roomId: string;
  startAt: string;
  endAt: string;
  organizerName: string | null;
  organizerDept: string | null;
};

type Props = {
  date: string; // YYYY-MM-DD
  rooms: SourceRoom[];
  bookings: Booking[];
};

function buildSlots() {
  // 08:30–17:30，每 30 分鐘
  const starts: string[] = [];
  const ends: string[] = [];

  let h = 8;
  let m = 30;

  while (h < 17 || (h === 17 && m === 0)) {
    const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    starts.push(start);

    m += 30;
    if (m >= 60) {
      h += 1;
      m -= 60;
    }

    const end = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    ends.push(end);
  }

  return {
    slotStarts: starts,
    slotEnds: ends,
    rangeEndLabel: "17:30",
  };
}

export default function TopTabs({ date, rooms, bookings }: Props) {
  const { slotStarts, slotEnds, rangeEndLabel } = useMemo(buildSlots, []);

  /**
   * 🔑 關鍵修正：
   * 將 DB / API 來的 room 資料
   * 轉成 OverviewGrid 專用的 shape
   */
  const roomsForGrid = useMemo(
    () =>
      rooms.map((r) => ({
        id: r.id,
        title: r.title ?? r.name ?? "未命名會議室",
        capacity: typeof r.capacity === "number" ? r.capacity : null,
      })),
    [rooms]
  );

  return (
    <OverviewGrid
      dateYmd={date}
      slotStarts={slotStarts}
      slotEnds={slotEnds}
      rangeEndLabel={rangeEndLabel}
      rooms={roomsForGrid}
      bookings={bookings}
    />
  );
}

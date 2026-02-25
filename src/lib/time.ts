// src/lib/time.ts
const TZ = "Asia/Taipei";

/**
 * 給 <input type="date"> 使用的 YYYY-MM-DD（以本地時區顯示）
 * 注意：HTML date input 本身沒有時區概念，這裡用本地 Date 的年月日即可。
 */
export function toLocalDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 把 YYYY-MM-DD + HH:mm 組成 Date（本地時間）
 * 你目前專案的 DB 存 DateTime，UI 用 Asia/Taipei 顯示；
 * 這裡用「本地時間」建立 Date，符合你既有用法（new Date(y, m-1, d, hh, mm)）。
 */
export function combineDateTime(dateYmd: string, hm: string) {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * 解析 ISO 字串為 Date
 */
export function parseISODate(iso: string) {
  return new Date(iso);
}

/**
 * 以台北時區格式化 YYYY-MM-DD（給顯示用）
 */
export function formatYMDInTaipei(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * 以台北時區格式化 HH:mm（給顯示用）
 */
export function formatHMInTaipei(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

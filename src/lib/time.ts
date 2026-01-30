import { format, parseISO } from "date-fns";

export function toLocalDateInputValue(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function toLocalTimeInputValue(d: Date) {
  return format(d, "HH:mm");
}

export function formatZh(d: Date) {
  return format(d, "yyyy/MM/dd HH:mm");
}

export function parseISODateTime(s: string) {
  return parseISO(s);
}

export function combineDateTime(date: string, time: string) {
  // date: yyyy-MM-dd, time: HH:mm
  return new Date(`${date}T${time}:00`);
}

export const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

export const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

export function formatTime(date: Date | null | undefined) {
  return date ? KST_FORMATTER.format(date) : "-";
}

export function formatDate(date: Date | null | undefined) {
  return date ? DATE_FORMATTER.format(date) : "-";
}

export function isWithinWindow(now: Date, start: Date, end: Date) {
  return now >= start && now <= end;
}

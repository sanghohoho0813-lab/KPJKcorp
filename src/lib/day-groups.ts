/**
 * 날짜 묶음 — 알림처럼 시간 순 목록을 "오늘 · 어제 · 이번 주 · 이전"으로 나눈다(이 기기 달력 기준).
 * 순서는 받은 그대로 둔다(최신이 위).
 */
export type DayGroupKey = "today" | "yesterday" | "week" | "older";
export const DAY_GROUP_LABEL: Record<DayGroupKey, string> = { today: "오늘", yesterday: "어제", week: "이번 주", older: "이전" };

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayGroupOf(iso: string, now = new Date()): DayGroupKey {
  const diff = Math.round((dayStart(now) - dayStart(new Date(iso))) / 864e5);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "week";
  return "older";
}

export function groupByDay<T>(items: T[], at: (x: T) => string, now = new Date()): { key: DayGroupKey; label: string; items: T[] }[] {
  const out: { key: DayGroupKey; label: string; items: T[] }[] = [];
  for (const x of items) {
    const key = dayGroupOf(at(x), now);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(x);
    else out.push({ key, label: DAY_GROUP_LABEL[key], items: [x] });
  }
  return out;
}

// Dates are created and displayed in the browser's local timezone (KST for KPJK users).
// Seed data uses local setHours(), so formatting must also stay local to keep them consistent.

export function nowIso() {
  return new Date().toISOString();
}

export function addDays(base: Date, days: number, hour?: number, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  if (hour !== undefined) d.setHours(hour, minute, 0, 0);
  return d;
}

export function iso(d: Date) {
  return d.toISOString();
}

export function dateOnly(isoStr: string) {
  return isoStr.slice(0, 10);
}

export function fmtDate(isoStr?: string, opts: { weekday?: boolean; year?: boolean } = {}) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  return new Intl.DateTimeFormat("ko-KR", {
    year: opts.year ? "numeric" : undefined,
    month: "long",
    day: "numeric",
    weekday: opts.weekday ? "short" : undefined,
  }).format(d);
}

export function fmtDateShort(isoStr?: string) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}.${String(day).padStart(2, "0")}`;
}

export function fmtDateTime(isoStr?: string) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtTime(isoStr?: string) {
  if (!isoStr) return "-";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(isoStr));
}

export function fmtFull(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(d);
}

export function fmtClock(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d);
}

export function fmtCompact(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}.${m}.${day} (${w})`;
}

export function fmtMobileDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${m}.${day} ${w}`;
}

export function relativeDay(isoStr: string, now = new Date()) {
  const target = new Date(isoStr);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff > 1) return `${diff}일 후`;
  return `${-diff}일 지남`;
}

export function daysBetween(aIso: string, bIso: string) {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 86400000);
}

export function isSameDay(aIso: string, d: Date) {
  const a = new Date(aIso);
  return a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate();
}

export function isPast(isoStr: string, now = new Date()) {
  return new Date(isoStr).getTime() < now.getTime();
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtRelative(isoStr: string, now = new Date()) {
  const diff = now.getTime() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return fmtDate(isoStr);
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

/** 12,000,000 → "1,200만원". 금액은 항상 만원 단위로 읽는다. */
export function fmtWon(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 100000000) {
    const eok = n / 100000000;
    return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억원`;
  }
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString("ko-KR")}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

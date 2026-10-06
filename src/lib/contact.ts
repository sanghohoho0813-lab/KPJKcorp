import type { Company, Consultation, Inquiry, JournalEntry, Schedule, Task } from "./types";

/**
 * 고객 연락 공백 — "마지막으로 고객과 닿은 날"을 시스템에 이미 있는 기록에서 찾는다. 따로 적게 하지 않는다.
 *  상담 기록 · 문의에 답변 · 지난 고객 미팅/상담/결과보고 일정 · 끝낸 후속연락 업무 · 업무 일기 '통화'
 * 아무 기록이 없으면 최초 상담일을 기준으로 본다(등록하자마자 공백 경고가 뜨지 않게).
 */
export type ContactHow = "상담" | "문의 답변" | "미팅" | "후속 연락" | "통화 기록" | "최초 상담";
export interface LastContact { at: string; how: ContactHow }

export interface ContactSources {
  consultations: Pick<Consultation, "companyId" | "date">[];
  inquiries: Pick<Inquiry, "companyId" | "messages">[];
  schedules: Pick<Schedule, "companyId" | "type" | "start">[];
  tasks: Pick<Task, "companyId" | "type" | "status" | "completedAt">[];
  journal: Pick<JournalEntry, "companyId" | "type" | "entryDate" | "createdAt">[];
}

const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localNoon = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12).toISOString(); };

const MEETING_TYPES = new Set(["consult", "meeting", "report"]);

export function lastContact(company: Pick<Company, "id" | "firstConsultDate">, src: ContactSources, now = new Date()): LastContact | undefined {
  const nowIso = now.toISOString();
  let best: LastContact | undefined;
  const take = (at: string | undefined, how: ContactHow) => {
    if (!at || at > nowIso) return; // 앞으로 있을 일정은 연락이 아니다
    if (!best || at > best.at) best = { at, how };
  };
  for (const c of src.consultations) if (c.companyId === company.id) take(c.date, "상담");
  for (const i of src.inquiries) if (i.companyId === company.id) for (const m of i.messages) if (m.authorRole !== "client") take(m.createdAt, "문의 답변");
  for (const s of src.schedules) if (s.companyId === company.id && MEETING_TYPES.has(s.type)) take(s.start, "미팅");
  for (const t of src.tasks) if (t.companyId === company.id && t.type === "후속연락" && t.status === "done") take(t.completedAt, "후속 연락");
  // 일기는 날짜만 있다 — 적은 날의 일이면 적은 시각, 지난날을 적었으면 그날 정오(현지 시각)로 본다
  for (const j of src.journal) if (j.companyId === company.id && j.type === "call") take(j.entryDate >= localYmd(new Date(j.createdAt)) ? j.createdAt : localNoon(j.entryDate), "통화 기록");
  if (!best && company.firstConsultDate) take(company.firstConsultDate.length === 10 ? localNoon(company.firstConsultDate) : company.firstConsultDate, "최초 상담");
  return best;
}

/** 마지막 연락 뒤 지난 날 (달력 날짜 기준) */
export function daysSince(at: string, now = new Date()): number {
  const d = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((d(now) - d(new Date(at))) / 864e5));
}

/** 앞으로 잡힌 고객 미팅 · 상담 · 결과보고 중 가장 가까운 것 */
export function nextPlanned(company: Pick<Company, "id">, src: Pick<ContactSources, "schedules">, now = new Date()): string | undefined {
  const nowIso = now.toISOString();
  return src.schedules.filter((s) => s.companyId === company.id && MEETING_TYPES.has(s.type) && s.start > nowIso).map((s) => s.start).sort()[0];
}

/** 이 안에 고객 미팅이 잡혀 있으면 연락은 이미 계획된 것으로 본다 */
export const PLANNED_WINDOW_DAYS = 7;

export interface ContactStatus {
  last?: LastContact; days?: number;
  /** 다음 연락까지 남은 날 (음수 = 지남) */ left?: number;
  /** 곧 있을 고객 미팅 (7일 안) — 있으면 공백이어도 '연락 필요'로 보지 않는다 */ planned?: string;
  due: boolean;
}
export function contactStatus(company: Pick<Company, "id" | "firstConsultDate">, src: ContactSources, cycleDays: number, now = new Date()): ContactStatus {
  const last = lastContact(company, src, now);
  if (!last) return { due: false };
  const days = daysSince(last.at, now);
  const next = nextPlanned(company, src, now);
  const planned = next && new Date(next).getTime() - now.getTime() <= PLANNED_WINDOW_DAYS * 864e5 ? next : undefined;
  return { last, days, left: cycleDays - days, planned, due: days >= cycleDays && !planned };
}

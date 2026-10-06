import type { Company, Task } from "./types";

/**
 * 업무 한 줄 입력 — "에이정밀 매출채권 자료 재요청 전화" 처럼 적으면
 * 기업과 업무 유형을 글자에서 찾아 붙인다. 못 찾으면 비워 둔다(짐작해서 엉뚱한 기업에 붙이지 않는다).
 */

/** 기업명에서 법인 표기 · 괄호 덧붙임을 뗀 짧은 이름 — "에이정밀(주)" → "에이정밀", "가나 상사 (본사)" → "가나상사" */
export function shortCompanyName(name: string): string {
  return name.replace(/\([^)]*\)|㈜|주식회사|유한회사|\s+/g, "").trim();
}

/** 중복 등록 검사용 — 법인 표기와 띄어쓰기만 뗀다. "(본사)" · "(지점)" 처럼 구분하는 괄호는 남긴다 */
export function legalBaseName(name: string): string {
  return name.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\s+/g, "").trim();
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 제목에 기업 이름이 들어 있으면 그 기업. 둘 이상 겹치면 더 긴 이름(더 구체적인 것). 두 글자 미만 이름은 보지 않는다. */
export function guessCompany(title: string, companies: Pick<Company, "id" | "name" | "archived">[]): string | undefined {
  const t = norm(title);
  if (!t) return undefined;
  let best: { id: string; len: number } | undefined;
  for (const c of companies) {
    if (c.archived) continue;
    const s = norm(shortCompanyName(c.name));
    if (s.length < 2 || !t.includes(s)) continue;
    if (!best || s.length > best.len) best = { id: c.id, len: s.length };
  }
  return best?.id;
}

// 순서가 곧 우선순위 — "결과보고 일정 전화"는 보고서가 아니라 전화(후속연락)다. 행동 낱말을 먼저 본다.
const TYPE_RULES: [RegExp, Task["type"]][] = [
  [/문의 ?답변|답변|회신 드리/, "문의응대"],
  [/전화|연락|통화|리마인드|재요청|follow/i, "후속연락"],
  [/미팅|회의|방문|사전자료|준비물/, "미팅준비"],
  [/검토|확인해 보|점검/, "자료검토"],
  [/보고서|결과보고|리포트/, "보고서"],
  [/문의/, "문의응대"],
  [/안내/, "후속연락"],
];

/** 제목 낱말로 업무 유형을 고른다. 맞는 낱말이 없으면 "기타" */
export function guessTaskType(title: string): Task["type"] {
  for (const [re, type] of TYPE_RULES) if (re.test(title)) return type;
  return "기타";
}

export type DueQuick = "today" | "tomorrow" | "week";
export const DUE_QUICK: { key: DueQuick; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "tomorrow", label: "내일" },
  { key: "week", label: "1주 뒤" },
];

/** 빠른 기한 → 그날 18:00 (업무 기한의 기본 시각) */
export function dueFromQuick(q: DueQuick, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + (q === "today" ? 0 : q === "tomorrow" ? 1 : 7));
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

/** 업무 목록을 기한으로 묶는 이름 — 기한 초과 · 오늘 · 내일 · 이번 주 · 이후 */
export type DueBucket = "overdue" | "today" | "tomorrow" | "week" | "later";
export const DUE_BUCKET_LABEL: Record<DueBucket, string> = { overdue: "기한 초과", today: "오늘", tomorrow: "내일", week: "7일 안", later: "그 뒤" };
export function dueBucket(dueIso: string, now = new Date()): DueBucket {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(dueIso)) - day(now)) / 864e5);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

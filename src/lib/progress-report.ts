import type { Company, DocumentRequest, Inquiry, Notice, Project, ResultFile, Schedule } from "./types";
import { CUSTOMER_STEPS, stageToCustomerStep } from "./stages";
import { addMonthsYmd, todayYmd } from "./vault";

/**
 * 경과 보고 — 담당자가 고객 대표에게 "그동안 무엇을 했고, 지금 어디이며, 무엇이 필요한지"를 한 번에 보낸다.
 *
 * 고객에게 이미 보이는 기록만 쓴다: 고객에게 보이는 프로젝트의 단계 · 요청자료(받음·검토·남은 것) · 공유한 결과자료 ·
 * 고객에게 보이는 일정 · 답한 문의. 내부 메모·업무·수금·업무 일기는 넣지 않는다. 지어낸 숫자나 문장은 없다 —
 * 줄마다 근거 기록이 있고, 담당자가 빼거나 한마디를 더한 뒤 보낸다. 보낼 때는 고객 공지(기업 한 곳)로 올라간다.
 */

export const REPORT_PREFIX = "경과 보고";

export type ReportSectionKey = "now" | "done" | "ask" | "next";
export interface ReportLine { key: string; text: string }
export interface ReportSection { key: ReportSectionKey; title: string; lines: ReportLine[] }

export interface ReportSource {
  company: Company;
  projects: Project[];
  docRequests: DocumentRequest[];
  results: ResultFile[];
  schedules: Schedule[];
  inquiries: Inquiry[];
}

const pad = (n: number) => String(n).padStart(2, "0");
/** 저장된 값이 날짜만(YYYY-MM-DD)이면 그대로, 시각까지 있으면 이 기기 기준 날짜 */
export const localDay = (v: string) => (v.length <= 10 ? v : todayYmd(new Date(v)));
export const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const plusDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayYmd(d);
};
const within = (v: string | undefined, from: string, to: string) => !!v && localDay(v) >= from && localDay(v) <= to;
/** 이름 몇 개 + 외 N건 */
const names = (xs: string[], max = 3) => xs.slice(0, max).join(", ") + (xs.length > max ? ` 외 ${xs.length - max}건` : "");
const timeOf = (v: string) => {
  if (v.length <= 10) return "";
  const d = new Date(v);
  if (d.getHours() === 0 && d.getMinutes() === 0) return "";
  const h = d.getHours();
  return ` ${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${pad(d.getMinutes())}`;
};

/** 기간 고르기 — 최근 2주 · 최근 한 달 · 지난 보고 이후 */
export type ReportRange = "2w" | "1m" | "since";
export function reportFrom(range: ReportRange, today = todayYmd(), lastAt?: string): string {
  if (range === "since" && lastAt) return localDay(lastAt);
  if (range === "1m") return addMonthsYmd(today, -1) ?? plusDays(today, -30);
  return plusDays(today, -14);
}

export const isReport = (n: Pick<Notice, "title">) => n.title.startsWith(REPORT_PREFIX);

/** 이 기업에 보낸 가장 최근 경과 보고 */
export function lastReportFor(notices: Notice[], companyId: string): Notice | undefined {
  return notices.filter((n) => n.companyId === companyId && isReport(n)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
}

export function reportTitle(from: string, to: string) {
  return `${REPORT_PREFIX} · ${md(from)} ~ ${md(to)}`;
}

/**
 * 기간(from~to, 날짜) 안의 기록으로 줄을 만든다. 비는 묶음은 빠진다.
 * nowIso: "지난 일 / 다가올 일"을 가르는 시각(오늘 오후 미팅은 다가올 일정).
 */
export function buildReport(src: ReportSource, from: string, to: string, nowIso = new Date().toISOString()): ReportSection[] {
  const cid = src.company.id;
  const projects = src.projects
    .filter((p) => p.companyId === cid && p.clientVisible && !p.archived)
    // 진행 중인 것 먼저, 끝난 것은 뒤로
    .sort((a, b) => Number(a.stage === "done" || a.stage === "aftercare") - Number(b.stage === "done" || b.stage === "aftercare") || a.startDate.localeCompare(b.startDate));
  // 요청자료·결과자료는 고객 화면과 같은 기준(기업 단위)으로 본다
  const reqs = src.docRequests.filter((d) => d.companyId === cid && d.status !== "planned");
  const today = localDay(nowIso);

  // 지금 진행 상황 — 진행 중인 프로젝트 + 이 기간에 끝난 프로젝트
  const now: ReportLine[] = [];
  for (const p of projects) {
    const finished = p.stage === "done" || p.stage === "aftercare";
    if (finished && !within(p.stageChangedAt, from, to)) continue;
    const step = finished ? "완료" : CUSTOMER_STEPS[stageToCustomerStep(p.stage)].label;
    const moved = !finished && within(p.stageChangedAt, from, to) ? ` (${md(localDay(p.stageChangedAt))}부터)` : "";
    const ms = !finished && p.nextMilestone?.date && localDay(p.nextMilestone.date) >= today ? ` · 다음: ${p.nextMilestone.label} ${md(localDay(p.nextMilestone.date))}` : "";
    now.push({ key: `now:${p.id}`, text: `${p.name} — ${step}${moved}${ms}` });
  }

  // 이번 기간에 한 일
  const done: ReportLine[] = [];
  const got = reqs.filter((d) => within(d.submittedAt, from, to)).sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  if (got.length) done.push({ key: "done:received", text: `보내 주신 자료 ${got.length}건 받음 — ${names(got.map((d) => d.name))}` });
  const checked = reqs.filter((d) => d.status === "done" && within(d.reviewedAt, from, to));
  if (checked.length) done.push({ key: "done:reviewed", text: `자료 검토 마침 ${checked.length}건 — ${names(checked.map((d) => d.name))}` });
  const shared = src.results
    .filter((r) => r.companyId === cid && within(r.sharedAt, from, to))
    .sort((a, b) => a.sharedAt.localeCompare(b.sharedAt));
  if (shared.length > 3) done.push({ key: "done:results", text: `결과자료 ${shared.length}건 공유 — ${names(shared.map((r) => r.name))}` });
  else for (const r of shared) done.push({ key: `done:result:${r.id}`, text: `결과자료 공유 — ${r.name}` });
  const visible = src.schedules.filter((s) => s.companyId === cid && s.visibleToClient);
  const held = visible
    .filter((s) => (s.type === "consult" || s.type === "meeting" || s.type === "report") && within(s.start, from, to) && s.start <= nowIso)
    .sort((a, b) => a.start.localeCompare(b.start));
  for (const s of held.slice(-4)) done.push({ key: `done:met:${s.id}`, text: `${md(localDay(s.start))} ${s.title}` });
  const answered = src.inquiries.filter((q) => q.companyId === cid && q.messages.some((m) => m.authorRole !== "client" && within(m.createdAt, from, to)));
  if (answered.length) done.push({ key: "done:inquiries", text: `문의 ${answered.length}건 답변 — ${names(answered.map((q) => q.title), 2)}` });

  // 대표님께 부탁드릴 것 — 지금 남아 있는 요청(기간과 무관)
  const ask: ReportLine[] = [];
  const open = reqs
    .filter((d) => d.status === "requested" || d.status === "revision")
    .sort((a, b) => Number(b.status === "revision") - Number(a.status === "revision") || a.dueDate.localeCompare(b.dueDate));
  for (const d of open.slice(0, 5)) {
    const due = localDay(d.dueDate);
    ask.push({ key: `ask:${d.id}`, text: `${d.name}${d.status === "revision" ? " (보완)" : ""} — 기한 ${md(due)}${due < today ? " 지남" : ""}` });
  }
  if (open.length > 5) ask.push({ key: "ask:more", text: `그 밖에 ${open.length - 5}건은 자료제출 화면에서 확인해 주세요` });

  // 다음 일정 — 앞으로 30일, 고객에게 보이는 일정(서류 기한은 위 '부탁드릴 것'에 있다)
  const until = plusDays(today, 30);
  const next: ReportLine[] = visible
    .filter((s) => s.type !== "doc_due" && s.type !== "internal_due" && s.start > nowIso && localDay(s.start) <= until)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4)
    .map((s) => {
      const day = localDay(s.start);
      return { key: `next:${s.id}`, text: `${md(day)}(${WEEK[new Date(`${day}T00:00:00`).getDay()]})${timeOf(s.start)} ${s.title}` };
    });

  return ([
    { key: "now", title: "지금 진행 상황", lines: now },
    { key: "done", title: "이번 기간에 한 일", lines: done },
    { key: "ask", title: "대표님께 부탁드릴 것", lines: ask },
    { key: "next", title: "다음 일정", lines: next },
  ] satisfies ReportSection[]).filter((s) => s.lines.length > 0);
}

/** 보낼 본문 — ■ 묶음 제목 · 줄. 고객 화면은 이 표시를 보고 제목·목록으로 그린다(NoticeBody) */
export function reportBody(opts: { company: Company; from: string; to: string; sections: ReportSection[]; skip?: Set<string>; note?: string; signature?: string }): string {
  const who = opts.company.ceo ? `${opts.company.ceo} 대표님` : "대표님";
  const out: string[] = [`${who}, ${md(opts.from)}~${md(opts.to)} 진행 상황을 정리해 드립니다.`];
  for (const s of opts.sections) {
    const lines = s.lines.filter((l) => !opts.skip?.has(l.key));
    if (!lines.length) continue;
    out.push("", `■ ${s.title}`, ...lines.map((l) => `· ${l.text}`));
  }
  const note = opts.note?.trim();
  if (note) out.push("", "■ 담당자 한마디", note);
  if (opts.signature) out.push("", `— ${opts.signature}`);
  return out.join("\n");
}

/** 본문을 제목 · 목록 · 문단으로 — 경과 보고가 아닌 공지도 "- " 줄은 목록으로 보인다 */
export type NoticeBlock = { kind: "h" | "li" | "p"; text: string };
export function noticeBlocks(body: string): NoticeBlock[] {
  const out: NoticeBlock[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("■ ")) out.push({ kind: "h", text: line.slice(2).trim() });
    else if (/^[·•-]\s/.test(line)) out.push({ kind: "li", text: line.slice(2).trim() });
    else out.push({ kind: "p", text: line });
  }
  return out;
}

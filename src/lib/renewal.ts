import type { Activity, Company, Consultation, Contract, DocumentRequest, Inquiry, Notice, Opportunity, Project, Quote, QuoteItem, ResultFile, Schedule, SelfRun, SupportProgram, Task } from "./types";
import { CUSTOMER_STEPS, stageToCustomerStep } from "./stages";
import { growthBoard } from "./growth";
import { certSuggestions, certView } from "./company-snapshot";
import { isReport, localDay, md } from "./progress-report";
import { APPLIED_OR_LATER } from "./self-run";
import { addMonthsYmd, daysFromTo, todayYmd } from "./vault";

/**
 * 갱신 준비 — 계약 기간에 실제로 함께한 일을 기록에서 모으고, 다음 1년에 검토할 것을 근거와 함께 고른다.
 *
 * 재계약 상담 자리에서 담당자가 "그동안 무엇을 했는지"를 기억이나 카톡을 뒤져 정리하던 일을 한 번에 끝낸다.
 * 경과 보고와 같은 원칙: 고객에게 이미 보이는 기록만 쓰고, 줄마다 근거 기록이 있다. 지어낸 숫자 · 효과 · 금액은 없다.
 *   - 고객에게 숨긴 프로젝트 · 내부 메모 · 업무 · 수금 · 계약 금액은 넣지 않는다(금액은 갱신 견적에서 따로 다룬다).
 *   - "다음 1년" 줄은 성장과제 판 · 인증 유효기간 · 남은 요청 · 진행 중 지원사업에서만 고른다. 될지 안 될지는 말하지 않는다.
 * 고객에게 보낼 때는 고객 공지(기업 한 곳)로 올라간다 — 새 표가 없다.
 */

export const RENEWAL_PREFIX = "함께한 기록";

export interface RenewalLine { key: string; text: string; basis?: string }
export type RenewalSectionKey = "work" | "docs" | "results" | "talk" | "support" | "next";
export interface RenewalSection { key: RenewalSectionKey; title: string; lines: RenewalLine[] }

export interface RenewalSource {
  company: Company;
  contract: Contract;
  projects: Project[];
  docRequests: DocumentRequest[];
  results: ResultFile[];
  schedules: Schedule[];
  inquiries: Inquiry[];
  consultations: Consultation[];
  notices: Notice[];
  activities: Pick<Activity, "type" | "companyId" | "at" | "text" | "meta">[];
  selfRuns: SelfRun[];
  opportunities: Opportunity[];
  quotes: Quote[];
  programs?: SupportProgram[];
}

export interface RenewalRecord {
  /** 함께한 기간의 시작(계약 서명일 → 계약 시작일 → 프로젝트 시작일 → 송부일) */
  from: string;
  /** 기록을 센 마지막 날 — 오늘(종료일이 지났으면 종료일) */
  to: string;
  end?: string;
  /** from 부터 to 까지 날수(첫날 포함) */
  days: number;
  /** 종료일까지 남은 날 — 지났으면 음수 */
  daysLeft?: number;
  sections: RenewalSection[];
  /** 고객 화면 맨 위 숫자 — 0 인 것은 빠진다 */
  counts: { key: string; label: string; n: number }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
/** 2026.09.24 */
export const dotDay = (day: string) => `${day.slice(0, 4)}.${day.slice(5, 7)}.${day.slice(8, 10)}`;
const within = (v: string | undefined, from: string, to: string) => !!v && localDay(v) >= from && localDay(v) <= to;
const names = (xs: string[], max = 3) => xs.slice(0, max).join(", ") + (xs.length > max ? ` 외 ${xs.length - max}건` : "");
const plusDaysYmd = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 함께한 기간의 시작 — 서명일이 가장 확실하다. 없으면 회사의 계약 시작일 · 연결 프로젝트 시작일 · 송부일 순 */
export function contractStart(ct: Contract, company: Pick<Company, "contractStartedAt">, projects: Pick<Project, "id" | "startDate">[]): string | undefined {
  const p = projects.find((x) => x.id === ct.projectId);
  const v = ct.signedAt ?? company.contractStartedAt ?? p?.startDate ?? ct.sentAt;
  return v ? localDay(v) : undefined;
}

/** 이 기업에서 갱신 준비를 열 계약 — 서명된 계약 중 종료일이 가장 가까운 것(지난 것 포함), 없으면 가장 최근 서명 */
export function renewalContract(contracts: Contract[], companyId: string, today = todayYmd()): Contract | undefined {
  const signed = contracts.filter((c) => c.companyId === companyId && c.status === "signed");
  // 가까운 순 — 같은 거리면 아직 안 끝난 것을 먼저(갱신할 수 있는 쪽)
  const dist = (c: Contract) => daysFromTo(today, c.endDate!.slice(0, 10));
  const dated = signed.filter((c) => c.endDate).sort((a, b) => Math.abs(dist(a)) - Math.abs(dist(b)) || dist(b) - dist(a));
  return dated[0] ?? signed.sort((a, b) => (b.signedAt ?? "").localeCompare(a.signedAt ?? ""))[0];
}

/** 이 기업의 첫 서명 계약 시작일 — "첫 계약부터" 보기. 이 계약보다 앞선 계약이 없으면 undefined */
export function relationStart(contracts: Contract[], ct: Contract, company: Pick<Company, "contractStartedAt">, projects: Pick<Project, "id" | "startDate">[]): string | undefined {
  const mine = contractStart(ct, company, projects);
  const starts = contracts.filter((x) => x.companyId === ct.companyId && x.status === "signed" && x.id !== ct.id).map((x) => contractStart(x, {}, projects)).filter((d): d is string => !!d);
  const first = starts.sort()[0];
  return first && mine && first < mine ? first : undefined;
}

/** since 를 주면 그날부터 센다(첫 계약부터 보기). 종료일 · 남은 날은 이 계약 기준 그대로 */
export function buildRenewal(src: RenewalSource, nowIso = new Date().toISOString(), opts: { since?: string } = {}): RenewalRecord | undefined {
  const { company: c, contract: ct } = src;
  const cid = c.id;
  const today = localDay(nowIso);
  const from = opts.since ?? contractStart(ct, c, src.projects);
  if (!from || from > today) return undefined;
  const end = ct.endDate ? ct.endDate.slice(0, 10) : undefined;
  const to = end && end < today ? end : today;
  const days = daysFromTo(from, to) + 1;
  const daysLeft = end ? daysFromTo(today, end) : undefined;

  // 진행한 일 — 고객에게 보이는 프로젝트 중 이 기간에 걸친 것. 끝난 것 먼저(완료일 순), 진행 중은 뒤에
  const projects = src.projects.filter((p) => p.companyId === cid && p.clientVisible && !p.archived);
  const work: RenewalLine[] = [];
  const finished = (p: Project) => p.stage === "done" || p.stage === "aftercare";
  const done = projects.filter((p) => finished(p) && within(p.stageChangedAt, from, to)).sort((a, b) => a.stageChangedAt.localeCompare(b.stageChangedAt));
  for (const p of done) {
    const n = src.results.filter((r) => r.projectId === p.id).length;
    work.push({ key: `work:${p.id}`, text: `${p.name} — 완료 (${md(localDay(p.stageChangedAt))})${n ? ` · 결과자료 ${n}건` : ""}` });
  }
  const ongoing = projects.filter((p) => !finished(p) && localDay(p.startDate) <= to).sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const p of ongoing) work.push({ key: `work:${p.id}`, text: `${p.name} — ${CUSTOMER_STEPS[stageToCustomerStep(p.stage)].label} (${md(localDay(p.startDate))} 시작)` });
  // 고객이 직접 끝낸 성장과제(스스로 준비하기)
  const selfDone = src.selfRuns.filter((r) => r.companyId === cid && r.kind === "growth" && r.status === "done" && within(r.statusAt, from, to));
  if (selfDone.length) work.push({ key: "work:self", text: `직접 진행해 마친 성장과제 ${selfDone.length}건 — ${names(selfDone.map((r) => r.targetTitle))}` });

  // 자료 · 검토
  const reqs = src.docRequests.filter((d) => d.companyId === cid && d.status !== "planned");
  const got = reqs.filter((d) => within(d.submittedAt, from, to));
  const checked = reqs.filter((d) => d.status === "done" && within(d.reviewedAt, from, to));
  const docs: RenewalLine[] = [];
  if (got.length) docs.push({ key: "docs:received", text: `보내 주신 자료 ${got.length}건 받음 — ${names(got.map((d) => d.name))}` });
  if (checked.length) docs.push({ key: "docs:reviewed", text: `자료 검토 마침 ${checked.length}건` });

  // 전달한 결과물 — 이 기간에 공유한 결과자료, 고객이 열어 본 것
  const shared = src.results.filter((r) => r.companyId === cid && within(r.sharedAt, from, to)).sort((a, b) => a.sharedAt.localeCompare(b.sharedAt));
  const opened = shared.filter((r) => src.activities.some((a) => a.type === "result_downloaded" && a.companyId === cid && a.at >= r.sharedAt && a.text.includes(r.name)));
  const results: RenewalLine[] = [];
  if (shared.length) results.push({ key: "results:shared", text: `결과자료 ${shared.length}건 전달 — ${names(shared.map((r) => r.name))}` });
  if (opened.length) results.push({ key: "results:opened", text: `그중 ${opened.length}건 대표님 쪽에서 열어 보심` });

  // 만남 · 소통
  const talk: RenewalLine[] = [];
  const cons = src.consultations.filter((x) => x.companyId === cid && within(x.date, from, to));
  if (cons.length) talk.push({ key: "talk:consult", text: `상담 ${cons.length}회 (${names([...new Set(cons.map((x) => x.type))], 4)})` });
  const meets = src.schedules.filter((s) => s.companyId === cid && s.visibleToClient && (s.type === "meeting" || s.type === "report") && within(s.start, from, to) && s.start <= nowIso);
  if (meets.length) talk.push({ key: "talk:meet", text: `보고 · 회의 ${meets.length}회` });
  const answered = src.inquiries.filter((q) => q.companyId === cid && q.messages.some((m) => m.authorRole !== "client" && within(m.createdAt, from, to)));
  if (answered.length) talk.push({ key: "talk:inquiry", text: `문의 ${answered.length}건 답변` });
  const reports = src.notices.filter((n) => n.companyId === cid && isReport(n) && within(n.publishedAt, from, to));
  const seen = reports.filter((n) => src.activities.some((a) => a.type === "notice_read" && a.meta?.noticeId === n.id));
  if (reports.length) talk.push({ key: "talk:report", text: `경과 보고 ${reports.length}회${seen.length ? ` (대표님 확인 ${seen.length}회)` : ""}` });

  // 지원사업 · 인증
  const support: RenewalLine[] = [];
  const alerts = src.activities.filter((a) => a.type === "program_shared" && a.companyId === cid && within(a.at, from, to));
  if (alerts.length) support.push({ key: "support:alerts", text: `맞는 지원사업 공고 ${alerts.length}건 안내` });
  const runs = src.selfRuns.filter((r) => r.companyId === cid && r.kind === "program" && APPLIED_OR_LATER.includes(r.status) && within(r.statusAt, from, to));
  const selected = runs.filter((r) => r.status === "selected");
  if (runs.length) support.push({ key: "support:applied", text: `지원사업 신청 기록 ${runs.length}건${selected.length ? ` · 선정 ${selected.length}건 (${names(selected.map((r) => r.targetTitle), 2)})` : ""}` });
  for (const x of (c.certifications ?? []).filter((x) => x.name?.trim() && within(x.acquiredAt, from, to)).sort((a, b) => (a.acquiredAt ?? "").localeCompare(b.acquiredAt ?? ""))) {
    support.push({ key: `support:cert:${x.name}`, text: `${x.name} 취득 (${md(localDay(x.acquiredAt!))})` });
  }

  const sections = ([
    { key: "work", title: "함께 진행한 일", lines: work },
    { key: "docs", title: "자료 · 검토", lines: docs },
    { key: "results", title: "전달한 결과물", lines: results },
    { key: "talk", title: "만남 · 소통", lines: talk },
    { key: "support", title: "지원사업 · 인증", lines: support },
    { key: "next", title: "다음 1년에 함께 검토할 것", lines: renewalNext(src, nowIso) },
  ] satisfies RenewalSection[]).filter((s) => s.lines.length > 0);

  const counts = [
    { key: "projects", label: "완료한 일", n: done.length + selfDone.length },
    { key: "docs", label: "받은 자료", n: got.length },
    { key: "results", label: "결과자료", n: shared.length },
    { key: "talk", label: "상담 · 보고", n: cons.length + meets.length + reports.length },
  ].filter((x) => x.n > 0);

  return { from, to, end, days, daysLeft, sections, counts };
}

/**
 * 다음 1년에 함께 검토할 것 — 근거가 있는 것만, 최대 6줄.
 * 순서: 기한이 있는 것(인증 만료 · 남은 요청) → 고객이 요청한 과제 → 담당자 제안 → 규칙이 고른 과제 → 진행 중 지원사업 → 검토해 볼 인증
 */
export function renewalNext(src: RenewalSource, nowIso = new Date().toISOString()): RenewalLine[] {
  const c = src.company;
  const today = localDay(nowIso);
  const out: RenewalLine[] = [];
  for (const v of certView(c, today)) {
    if (v.state !== "expiring" && v.state !== "expired") continue;
    out.push({ key: `next:cert:${v.name}`, text: `${v.name} ${v.state === "expired" ? `유효기간 지남 (${md(v.expiresAt!.slice(0, 10))})` : `유효기간 ${dotDay(v.expiresAt!.slice(0, 10))}까지 (D-${v.daysLeft})`} — 재확인 준비`, basis: "보유 인증 유효기간" });
  }
  const open = src.docRequests.filter((d) => d.companyId === c.id && (d.status === "requested" || d.status === "revision"));
  if (open.length) out.push({ key: "next:docs", text: `아직 남은 요청자료 ${open.length}건 — ${names(open.map((d) => d.name), 2)}`, basis: "요청자료" });
  const board = growthBoard({ company: c, projects: src.projects, opportunities: src.opportunities, docRequests: src.docRequests, quotes: src.quotes, results: src.results, schedules: src.schedules, now: new Date(nowIso), selfRuns: src.selfRuns, programs: src.programs });
  for (const it of board.review) out.push({ key: `next:growth:${it.area}`, text: `${it.area} — 검토를 요청하신 과제`, basis: it.basis ?? "직접 요청" });
  for (const it of board.proposed) out.push({ key: `next:growth:${it.area}`, text: `${it.area} — ${it.reason || "담당자가 제안드린 과제"}`, basis: "담당자 제안" });
  for (const it of board.suggested) out.push({ key: `next:growth:${it.area}`, text: `${it.area} — ${it.reason}`, basis: it.basis });
  const going = src.selfRuns.filter((r) => r.companyId === c.id && r.kind === "program" && ["preparing", "applied", "waiting"].includes(r.status));
  if (going.length) out.push({ key: "next:programs", text: `준비 · 신청 중인 지원사업 ${going.length}건 결과까지 함께 확인`, basis: "지원사업 진행 기록" });
  // 검토해 볼 인증은 기업정보만 보고 고른 것이라 2개까지 — 기록이 있는 줄이 먼저 보이게
  const held = new Set(out.map((l) => l.key));
  for (const s of certSuggestions(c, new Date(nowIso)).slice(0, 2)) {
    const key = `next:certsug:${s.name}`;
    if (!held.has(key)) out.push({ key, text: `${s.name} — ${s.why}`, basis: s.basis });
  }
  return out.slice(0, 6);
}

export function renewalTitle(r: Pick<RenewalRecord, "from" | "to">) {
  return `${RENEWAL_PREFIX} · ${dotDay(r.from)} ~ ${md(r.to)}`;
}

/** 고객 화면에서 '함께한 기록' 공지를 알아본다(홈 맨 위 띠의 이름표) */
export const isRenewalNotice = (n: Pick<Notice, "title">) => n.title.startsWith(RENEWAL_PREFIX);

/** 보낼 본문 — 경과 보고와 같은 ■ 묶음 · 줄 형식(고객 화면 NoticeBody 가 그대로 그린다) */
export function renewalBody(opts: { company: Company; record: RenewalRecord; skip?: Set<string>; note?: string; signature?: string }): string {
  const { record: r } = opts;
  const who = opts.company.ceo ? `${opts.company.ceo} 대표님` : "대표님";
  const out: string[] = [`${who}, ${dotDay(r.from)}부터 함께한 ${r.days}일의 기록을 정리해 드립니다.`];
  const counts = r.counts.map((x) => `${x.label} ${x.n}`).join(" · ");
  if (counts) out.push(counts);
  for (const s of r.sections) {
    const lines = s.lines.filter((l) => !opts.skip?.has(l.key));
    if (!lines.length) continue;
    out.push("", `■ ${s.title}`, ...lines.map((l) => `· ${l.text}`));
  }
  const note = opts.note?.trim();
  if (note) out.push("", "■ 담당자 한마디", note);
  if (opts.signature) out.push("", `— ${opts.signature}`);
  return out.join("\n");
}

/** 같은 계약으로 보낸 '함께한 기록'이 있는가 — 제목의 시작일로 찾는다 */
export function lastRenewalFor(notices: Notice[], companyId: string): Notice | undefined {
  return notices.filter((n) => n.companyId === companyId && isRenewalNotice(n)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
}

/**
 * 갱신 견적 초안 — 지금 계약을 그대로 옮긴다. 견적에서 전환한 계약이면 그 견적의 항목 · 기간을, 직접 등록한 계약이면
 * 계약 금액 한 줄을 쓴다. 할인은 0 — 할인을 넣으면 기존처럼 대표 승인을 거친다. 다음 기간 시작일은 범위 끝에 한 줄로.
 */
export function renewalQuoteDraft(ct: Contract, quotes: Quote[], start?: string): { projectId?: string; title: string; scope: string; period: string; items: QuoteItem[] } {
  const q = quotes.find((x) => x.contractId === ct.id);
  const items: QuoteItem[] = q?.items.length ? q.items.map((i) => ({ ...i })) : ct.amount ? [{ name: ct.title, amount: ct.amount }] : [{ name: ct.title, amount: 0 }];
  const scope = [ct.scope.trim(), start ? `기존 계약 갱신 — ${dotDay(start)}부터` : ""].filter(Boolean).join("\n");
  return { projectId: ct.projectId || undefined, title: `${ct.title.replace(/\s*\(갱신\)$/, "")} (갱신)`, scope, period: q?.period || ct.period || "12개월", items };
}

/** 다음 기간 시작일 — 종료일 다음 날(종료일이 없으면 오늘) */
export const renewalStart = (ct: Pick<Contract, "endDate">, today = todayYmd()) => (ct.endDate ? plusDaysYmd(ct.endDate.slice(0, 10), 1) : today);

/* ------------------------------------------------------------------ 갱신 고리 — 종료일 · 갱신 견적 상태 · 업무 마무리 */

const GAENGSIN = /\(갱신\)\s*$/;
const FROM_SCOPE = /기존 계약 갱신 — (\d{4})\.(\d{2})\.(\d{2})부터/;

/** 갱신 견적 · 갱신 계약의 범위 끝에 적힌 다음 기간 시작일 */
export function renewalStartFromScope(scope: string | undefined): string | undefined {
  const m = FROM_SCOPE.exec(scope ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/**
 * 시작일 + 기간 글자 → 종료일. "6개월" · "10주" · "1년" · "2026.03 ~ 2026.12(.31)" 만 읽는다.
 * 읽지 못하면 undefined — 지어내지 않는다. 6개월(7/1 시작)은 12/31 까지(끝나는 날 포함).
 */
export function periodEnd(start: string, period: string | undefined): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return undefined;
  const p = (period ?? "").replace(/\s+/g, "");
  // 날짜로 적힌 기간: 2026.03~2026.12 · 2026-03-02~2026-12-31
  const range = /[~\-–—]\s*(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?\.?$/.exec((period ?? "").trim());
  if (range && /\d{4}[.\-/]\d{1,2}/.test((period ?? "").split(/[~–—]/)[0] ?? "")) {
    const y = Number(range[1]); const mo = Number(range[2]);
    if (mo < 1 || mo > 12) return undefined;
    const day = range[3] ? Number(range[3]) : new Date(y, mo, 0).getDate();
    const end = `${y}-${pad(mo)}-${pad(day)}`;
    return end >= start ? end : undefined;
  }
  const y = /^(\d{1,2})년/.exec(p); const mo = /^(\d{1,3})개월/.exec(p); const w = /^(\d{1,3})주/.exec(p);
  if (mo || y) {
    const next = addMonthsYmd(start, mo ? Number(mo[1]) : Number(y![1]) * 12);
    return next ? plusDaysYmd(next, -1) : undefined;
  }
  if (w) return plusDaysYmd(start, Number(w[1]) * 7 - 1);
  return undefined;
}

/**
 * 종료일이 비어 있는 계약에 권할 종료일 — 시작(갱신이면 범위에 적힌 다음 기간 시작일, 아니면 서명일) + 기간.
 * 권할 뿐이다: 계약 창에서 대표가 눌러야 들어간다.
 */
export function suggestedEndDate(ct: Pick<Contract, "period" | "scope" | "signedAt">): { end: string; start: string; basis: "renewal" | "signed" } | undefined {
  const fromScope = renewalStartFromScope(ct.scope);
  const start = fromScope ?? (ct.signedAt ? localDay(ct.signedAt) : undefined);
  if (!start) return undefined;
  const end = periodEnd(start, ct.period);
  return end ? { end, start, basis: fromScope ? "renewal" : "signed" } : undefined;
}

/** 서명됐는데 종료일이 없는 계약 — 만료 전 갱신 협의 업무가 만들어지지 않는다 */
export const missingEndContracts = (contracts: Contract[]) => contracts.filter((c) => c.status === "signed" && !c.endDate);

/**
 * 이 계약의 갱신 견적 — 같은 기업 · (계약에 프로젝트가 있으면) 같은 프로젝트 · 제목이 "(갱신)"으로 끝나고 계약 서명 뒤에 만든 것.
 * 여러 개면 살아 있는 것(보류가 아닌 것) → 최근 것.
 */
export function renewalQuoteFor(ct: Contract, quotes: Quote[]): Quote | undefined {
  const base = ct.title.replace(GAENGSIN, "").trim();
  const since = ct.signedAt ?? ct.sentAt ?? "";
  const mine = quotes.filter((q) => q.companyId === ct.companyId && GAENGSIN.test(q.title) && q.createdAt >= since
    && (q.title.replace(GAENGSIN, "").trim() === base || (!!ct.projectId && q.projectId === ct.projectId)));
  return mine.sort((a, b) => Number(a.status === "declined") - Number(b.status === "declined") || b.createdAt.localeCompare(a.createdAt))[0];
}

export type RenewalStage = "none" | "quote_draft" | "quote_sent" | "accepted" | "declined" | "renewed";
export const RENEWAL_STAGE_LABEL: Record<RenewalStage, string> = {
  none: "갱신 준비 전", quote_draft: "갱신 견적 작성 중", quote_sent: "갱신 견적 발송 · 회신 대기", accepted: "고객 수락 · 계약 전환 전", declined: "갱신 견적 보류", renewed: "갱신 계약 진행",
};

/** 계약의 갱신 진행 — 갱신 견적 상태로만 판단한다(견적 없이 구두로 갱신한 것은 알 수 없다) */
export function renewalStage(ct: Contract, quotes: Quote[]): { stage: RenewalStage; quote?: Quote } {
  const q = renewalQuoteFor(ct, quotes);
  if (!q) return { stage: "none" };
  const stage: RenewalStage = q.status === "converted" ? "renewed" : q.status === "accepted" ? "accepted" : q.status === "sent" ? "quote_sent" : q.status === "declined" ? "declined" : "quote_draft";
  return { stage, quote: q };
}

/**
 * 새 계약이 서명되면 끝낼 '갱신 협의' 업무 — 그 계약이 어떤 계약의 갱신인지 확실할 때만.
 *  ① 같은 프로젝트의 앞선 계약에 걸린 갱신 협의 업무
 *  ② 프로젝트가 다르면: 새 계약이 갱신 계약(제목 "(갱신)" · 범위에 다음 기간 시작일)이고 그 기업의 열린 갱신 협의 업무가 하나뿐일 때
 * 애매하면 아무것도 끝내지 않는다 — 담당자가 직접 끝낸다.
 */
export function renewalTasksToClose(signed: Contract, contracts: Contract[], tasks: Pick<Task, "id" | "ruleKey" | "status" | "companyId">[]): string[] {
  const open = tasks.filter((t) => t.companyId === signed.companyId && t.ruleKey?.startsWith("contract_renewal:") && t.status !== "done");
  const oldOf = (t: Pick<Task, "ruleKey">) => contracts.find((c) => c.id === t.ruleKey!.slice("contract_renewal:".length));
  const cands = open.filter((t) => { const old = oldOf(t); return !!old && old.id !== signed.id; });
  const sameProject = cands.filter((t) => !!signed.projectId && oldOf(t)!.projectId === signed.projectId);
  if (sameProject.length) return sameProject.map((t) => t.id);
  const isRenewal = GAENGSIN.test(signed.title) || !!renewalStartFromScope(signed.scope);
  return isRenewal && cands.length === 1 ? [cands[0].id] : [];
}

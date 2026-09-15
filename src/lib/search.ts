import type { Company, Consultation, Contract, DocumentRequest, Inquiry, Project, Quote, Schedule, Task } from "./types";
import { stageLabel } from "./stages";

/**
 * 전역 검색 — 순수 함수. 화면은 결과를 그리기만 한다.
 *
 * 원칙
 * - 보관된 기업·프로젝트와 그 하위 항목은 나오지 않는다. 검색은 "지금 일하는 것"을 찾는 도구다.
 * - 점수는 단순하게: 이름이 검색어로 시작하면 +3, 포함하면 +2, 부가 필드에 포함되면 +1.
 *   똑똑한 순위보다 예측 가능한 순위가 낫다 — 왜 이게 위에 있는지 사용자가 바로 이해해야 한다.
 * - 그룹당 최대 5개. 더 보고 싶으면 해당 화면의 검색창을 쓰라고 안내한다.
 */

export type SearchKind = "company" | "project" | "doc" | "task" | "schedule" | "consultation" | "quote" | "contract" | "inquiry";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** 한 줄 부가정보 — 기업명 · 상태 등 */
  sub: string;
  href: string;
  score: number;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  company: "기업고객",
  project: "프로젝트",
  doc: "자료요청",
  task: "업무",
  schedule: "일정",
  consultation: "상담기록",
  quote: "견적",
  contract: "계약",
  inquiry: "문의",
};

export const KIND_ORDER: SearchKind[] = ["company", "project", "doc", "task", "schedule", "consultation", "quote", "contract", "inquiry"];

export interface SearchInput {
  companies: Company[];
  projects: Project[];
  docRequests: DocumentRequest[];
  tasks: Task[];
  schedules: Schedule[];
  consultations: Consultation[];
  quotes: Quote[];
  contracts: Contract[];
  inquiries: Inquiry[];
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, "");

function scoreOf(q: string, primary: string, extras: (string | undefined)[] = []) {
  const p = norm(primary);
  if (!p) return 0;
  if (p.startsWith(q)) return 3;
  if (p.includes(q)) return 2;
  for (const e of extras) if (norm(e).includes(q)) return 1;
  return 0;
}

export const MAX_PER_KIND = 5;

export function search(input: SearchInput, rawQuery: string): SearchHit[] {
  const q = norm(rawQuery);
  if (q.length < 1) return [];

  const liveCompanies = input.companies.filter((c) => !c.archived);
  const companyOk = new Set(liveCompanies.map((c) => c.id));
  const liveProjects = input.projects.filter((p) => !p.archived && companyOk.has(p.companyId));
  const projectOk = new Set(liveProjects.map((p) => p.id));
  const cname = (id?: string) => liveCompanies.find((c) => c.id === id)?.name ?? "";
  const pname = (id?: string) => liveProjects.find((p) => p.id === id)?.name ?? "";

  const hits: SearchHit[] = [];

  for (const c of liveCompanies) {
    const s = scoreOf(q, c.name, [c.ceo, c.contactName, c.industry, c.bizNo, c.contactPhone, c.corpNo, c.region, c.address]);
    if (s) hits.push({ kind: "company", id: c.id, title: c.name, sub: `${c.industry} · 대표 ${c.ceo} · 담당 ${c.contactName}`, href: `/ax/clients/${c.id}`, score: s });
  }
  for (const p of liveProjects) {
    const s = scoreOf(q, p.name, [p.type, cname(p.companyId)]);
    if (s) hits.push({ kind: "project", id: p.id, title: p.name, sub: `${cname(p.companyId)} · ${stageLabel(p.stage)}`, href: `/ax/projects/${p.id}`, score: s });
  }
  for (const d of input.docRequests) {
    if (!projectOk.has(d.projectId)) continue;
    const s = scoreOf(q, d.name, [cname(d.companyId), d.description]);
    if (s) hits.push({ kind: "doc", id: d.id, title: d.name, sub: `${cname(d.companyId)} · ${pname(d.projectId)}`, href: `/ax/projects/${d.projectId}`, score: s });
  }
  for (const t of input.tasks) {
    if (t.status === "done") continue;
    if (t.companyId && !companyOk.has(t.companyId)) continue;
    const s = scoreOf(q, t.title, [t.type, cname(t.companyId), t.memo]);
    if (s) hits.push({ kind: "task", id: t.id, title: t.title, sub: `${t.type}${t.companyId ? ` · ${cname(t.companyId)}` : ""}`, href: "/ax/tasks?filter=all", score: s });
  }
  for (const sc of input.schedules) {
    if (sc.companyId && !companyOk.has(sc.companyId)) continue;
    const s = scoreOf(q, sc.title, [sc.location, cname(sc.companyId)]);
    if (s) hits.push({ kind: "schedule", id: sc.id, title: sc.title, sub: `${sc.start.slice(0, 10)}${sc.location ? ` · ${sc.location}` : ""}`, href: "/ax/schedule", score: s });
  }
  for (const cs of input.consultations) {
    if (!companyOk.has(cs.companyId)) continue;
    const s = scoreOf(q, cs.summary.nextAction, [cs.notes, ...cs.summary.core, ...cs.summary.requirements, cname(cs.companyId)]);
    if (s) hits.push({ kind: "consultation", id: cs.id, title: `${cname(cs.companyId)} ${cs.type}`, sub: `${cs.date.slice(0, 10)} · ${cs.summary.nextAction || cs.notes.slice(0, 40)}`, href: "/ax/consultations", score: s });
  }
  for (const qt of input.quotes) {
    if (!companyOk.has(qt.companyId)) continue;
    const s = scoreOf(q, qt.title, [qt.scope, cname(qt.companyId)]);
    if (s) hits.push({ kind: "quote", id: qt.id, title: qt.title, sub: `${cname(qt.companyId)} · ${qt.status}`, href: "/ax/consultations?tab=quote", score: s });
  }
  for (const ct of input.contracts) {
    if (!companyOk.has(ct.companyId)) continue;
    const s = scoreOf(q, ct.title, [ct.scope, cname(ct.companyId)]);
    if (s) hits.push({ kind: "contract", id: ct.id, title: ct.title, sub: `${cname(ct.companyId)} · ${ct.period}`, href: "/ax/consultations?tab=contract", score: s });
  }
  for (const iq of input.inquiries) {
    if (!companyOk.has(iq.companyId)) continue;
    const s = scoreOf(q, iq.title, [iq.category, cname(iq.companyId), iq.messages[0]?.body]);
    if (s) hits.push({ kind: "inquiry", id: iq.id, title: iq.title, sub: `${cname(iq.companyId)} · ${iq.category}`, href: "/ax/tasks?tab=inquiry", score: s });
  }

  // 종류별 상위 N개만, 종류 순서는 고정 (기업 → 프로젝트 → …)
  const out: SearchHit[] = [];
  for (const k of KIND_ORDER) {
    out.push(...hits.filter((h) => h.kind === k).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, MAX_PER_KIND));
  }
  return out;
}

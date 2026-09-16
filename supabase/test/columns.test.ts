/**
 * 매퍼가 만들어내는 컬럼 이름이 실제 표에 있는지 대조한다.
 *
 * 오타 하나(biz_no ↔ bizno)는 타입 검사에도, 빌드에도 안 걸린다.
 * 대표님이 기업 하나를 등록하는 순간에야 터진다. 그 전에 잡는다.
 *
 * 실행: npx tsx supabase/test/columns.test.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as M from "../../src/lib/server/rows";

const sql = readFileSync(join(import.meta.dirname, "../setup.sql"), "utf8");

/** create table public.X ( ... ) 에서 컬럼 이름을 뽑는다 */
function columnsOf(table: string): Set<string> {
  const re = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i");
  const m = re.exec(sql);
  if (!m) throw new Error(`표를 찾지 못함: ${table}`);
  const cols = new Set<string>();
  for (const raw of m[1].split("\n")) {
    const line = raw.replace(/--.*$/, "").trim();
    if (!line) continue;
    if (/^(primary|foreign|unique|check|constraint)\b/i.test(line)) continue;
    const name = /^([a-z_][a-z0-9_]*)\s/.exec(line)?.[1];
    if (name) cols.add(name);
  }
  return cols;
}

/** 모든 선택 항목이 채워진 표본 — toRow 가 최대한 많은 키를 내놓게 한다 */
const full = {
  company: {
    id: "co_1", code: "A", name: "n", ceo: "c", industry: "i", bizNo: "1", contactName: "c",
    contactTitle: "t", contactPhone: "p", contactEmail: "e", address: "a", employees: 1,
    revenue: "r", firstConsultDate: "2026-01-01T00:00:00Z", consultantId: "u1", memo: "m",
    archived: true, archivedAt: "2026-01-01T00:00:00Z", entityType: "corporation" as const,
    corpNo: "1", establishedAt: "2020-01-01", bizCategory: "b", bizItem: "b", ceoBirth: "1980-01-01",
    capital: 1, region: "서울", employeeBand: "1-4", revenueBand: "<10", companyPhone: "p",
    website: "w", interests: ["a"], leadSource: "l", docs: {}, sample: true,
  },
  project: {
    id: "pj_1", companyId: "co_1", name: "n", type: "t", consultantId: "u1",
    startDate: "x", dueDate: "x", stage: "consult" as const, description: "d",
    stageChangedAt: "x", clientVisible: true, archived: true, archivedAt: "x",
    nextMilestone: { label: "l", date: "d" },
  },
  consultation: {
    id: "cs_1", companyId: "co_1", projectId: "pj_1", date: "x", consultantId: "u1",
    type: "초기상담" as const, channel: "방문" as const, notes: "n",
    summary: { core: [], requirements: [], promises: [], documents: [], nextAction: "" },
  },
  contract: {
    id: "ct_1", companyId: "co_1", projectId: "pj_1", title: "t", status: "draft" as const,
    sentAt: "x", signedAt: "x", period: "p", scope: "s", endDate: "x", amount: 1, source: "manual" as const,
  },
  docRequest: {
    id: "dr_1", projectId: "pj_1", companyId: "co_1", name: "n", description: "d",
    requestedAt: "x", dueDate: "x", status: "planned" as const, assigneeId: "u1",
    submittedAt: "x", reviewedAt: "x", reviewNote: "r", memo: "m", files: [],
  },
  schedule: {
    id: "sc_1", companyId: "co_1", projectId: "pj_1", title: "t", type: "meeting" as const,
    start: "x", end: "x", location: "l", assigneeId: "u1", visibleToClient: true, memo: "m",
  },
  task: {
    id: "tk_1", companyId: "co_1", projectId: "pj_1", title: "t", type: "기타" as const,
    dueDate: "x", assigneeId: "u1", status: "todo" as const, priority: "normal" as const,
    memo: "m", createdAt: "x", completedAt: "x", source: "manual" as const, ruleKey: "r",
  },
  inquiry: {
    id: "iq_1", companyId: "co_1", projectId: "pj_1", title: "t", category: "기타" as const,
    createdAt: "x", createdBy: "u1", status: "open" as const, assigneeId: "u1", messages: [],
  },
  result: {
    id: "rs_1", projectId: "pj_1", companyId: "co_1", name: "n", kind: "보고서" as const,
    sharedAt: "x", sharedBy: "u1", size: 1, description: "d", storagePath: "p",
  },
  opportunity: {
    id: "op_1", companyId: "co_1", serviceKey: "k", serviceName: "n", source: "internal" as const,
    status: "interest" as const, assigneeId: "u1", createdAt: "x", createdBy: "u1",
    updatedAt: "x", note: "n", reason: "r", history: [],
  },
  quote: {
    id: "qt_1", companyId: "co_1", projectId: "pj_1", opportunityId: "op_1", title: "t",
    scope: "s", period: "p", items: [], discountPct: 0, validUntil: "x", status: "draft" as const,
    createdBy: "u1", createdAt: "x", sentAt: "x", respondedAt: "x", clientNote: "c",
    approvalId: "ap_1", contractId: "ct_1",
  },
  approval: {
    id: "ap_1", kind: "discount" as const, title: "t", summary: "s", companyId: "co_1",
    projectId: "pj_1", opportunityId: "op_1", quoteId: "qt_1", baseAmount: 1, discountPct: 1,
    requestedBy: "u1", requestedAt: "x", status: "pending" as const, decidedBy: "u1",
    decidedAt: "x", decisionNote: "n",
  },
  activity: {
    id: "ac_1", type: "company_created" as const, companyId: "co_1", projectId: "pj_1",
    actorId: "u1", actorRole: "admin" as const, at: "x", text: "t", meta: {},
  },
  notification: {
    id: "nt_1", audience: "client" as const, companyId: "co_1", title: "t", body: "b",
    at: "x", read: false, href: "/",
  },
  survey: {
    id: "sv_1", surveyVersion: "v", stage: "s", userId: "u1", userName: "n",
    role: "admin" as const, answers: {}, freeText: "f", submittedAt: "x", durationSec: 1,
  },
  user: { id: "u1", name: "n", role: "admin" as const, title: "t", email: "E@X.COM", phone: "p", companyId: "co_1", active: true },
};

const CASES: [string, string, Record<string, unknown>][] = [
  ["profiles",          "user",        M.userToRow(full.user)],
  ["companies",         "company",     M.companyToRow(full.company)],
  ["projects",          "project",     M.projectToRow(full.project)],
  ["consultations",     "consultation",M.consultationToRow(full.consultation)],
  ["contracts",         "contract",    M.contractToRow(full.contract)],
  ["document_requests", "docRequest",  M.docRequestToRow(full.docRequest)],
  ["schedules",         "schedule",    M.scheduleToRow(full.schedule)],
  ["tasks",             "task",        M.taskToRow(full.task)],
  ["inquiries",         "inquiry",     M.inquiryToRow(full.inquiry)],
  ["results",           "result",      M.resultToRow(full.result)],
  ["opportunities",     "opportunity", M.opportunityToRow(full.opportunity)],
  ["quotes",            "quote",       M.quoteToRow(full.quote)],
  ["approvals",         "approval",    M.approvalToRow(full.approval)],
  ["activities",        "activity",    M.activityToRow(full.activity)],
  ["notifications",     "notification",M.notificationToRow(full.notification)],
  ["surveys",           "survey",      M.surveyToRow(full.survey)],
];

let fail = 0;
for (const [table, label, row] of CASES) {
  const cols = columnsOf(table);
  const unknown = Object.keys(row).filter((k) => !cols.has(k));
  if (unknown.length) { fail++; console.error(`FAIL ${table} ← ${label}: 표에 없는 컬럼 ${unknown.join(", ")}`); }
  else console.log(`OK   ${table.padEnd(18)} ${String(Object.keys(row).length).padStart(2)}개 컬럼`);
}

// 반대 방향도 본다: 값이 반드시 있어야 하는데(NOT NULL, 기본값 없음) 매퍼가
// 내놓지 않는 컬럼이 있으면 INSERT 자체가 실패한다.
for (const [table, label, row] of CASES) {
  const re = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i");
  const body = re.exec(sql)?.[1] ?? "";
  for (const raw of body.split("\n")) {
    const line = raw.replace(/--.*$/, "").trim();
    const name = /^([a-z_][a-z0-9_]*)\s/.exec(line)?.[1];
    if (!name || !/not null/i.test(line) || /default/i.test(line)) continue;
    if (name === "id" && table === "profiles") continue;      // auth 사용자 id 를 따로 붙인다
    if (!(name in row)) { fail++; console.error(`FAIL ${table} ← ${label}: 필수 컬럼 ${name} 을(를) 안 보냄`); }
  }
}

// 읽기 방향도 확인: 행 → 앱 타입 → 행 이 원래 값과 같은가
const back = M.companyFromRow(M.companyToRow(full.company) as Record<string, unknown>);
for (const k of ["name", "bizNo", "corpNo", "region", "ceoBirth", "capital", "employees"] as const) {
  if (String(back[k]) !== String(full.company[k])) { fail++; console.error(`FAIL 왕복 ${k}: ${full.company[k]} → ${back[k]}`); }
}
if (!fail) console.log("\n왕복 변환도 값이 유지됩니다.");
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);

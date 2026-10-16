// 정책자금 준비 서류 — 담당자 요청 창의 기본 체크, 고객 화면 준비도, 고객 홈 묶음. 기업·서류는 지어낸 것.
import { POLICY_DOCS, isPolicyRequest, policyDocOf, policyDocsFor, policyPlan, policyReadiness, policyRequestText } from "../../src/lib/policy-docs";
import { growthBoard } from "../../src/lib/growth";
import type { CompanyVault, DocumentRequest, Company } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const doc = (label: string) => POLICY_DOCS.find((d) => d.label === label)!;
const req = (name: string, status: DocumentRequest["status"], extra: Partial<DocumentRequest> = {}): DocumentRequest => ({
  id: `dr_${name}_${status}`, projectId: "", companyId: "co_t", name, description: policyRequestText(doc(name)), requestedAt: "2026-10-01T00:00:00Z", dueDate: "2026-11-01T09:00:00Z", status, assigneeId: "u1", files: [], ...extra,
});

// 1) 서류 목록
ok(policyDocOf("표준재무제표증명(최근 3년)")?.key === "finStmt" && !policyDocOf("통장 사본"), "이름으로 찾기 (띄어쓰기 무시)");
ok(policyDocsFor("sole").every((x) => !x.doc.corpOnly) && policyDocsFor("corporation").length === POLICY_DOCS.length, "개인사업자는 법인 서류 빼고, 법인은 전부");
ok(policyDocsFor(undefined).filter((x) => x.unsure).map((x) => x.doc.key).join() === "corpReg,shareholders,articles", "형태를 모르면 법인 서류는 '확인 필요'");
ok(POLICY_DOCS.filter((d) => d.justBefore).every((d) => d.validMonths === 1), "신청 직전 서류(납세증명)는 유효 1개월");

// 2) 담당자 요청 창 — 오늘 2026-10-16
const vault: CompanyVault = { id: "co_t", companyId: "co_t", customSlots: [{ key: "cd_1", label: "주주명부" }], slots: {
  bizReg: { received: true },
  corpReg: { received: true, issuedAt: "2026-06-01" },      // 3개월 지남
  smeCert: { received: true, issuedAt: "2025-10-25" },      // 12개월 — 9일 남음
} };
const reqs: DocumentRequest[] = [
  req("정관", "submitted"),
  { ...req("부가가치세 과세표준증명", "done"), submittedAt: "2026-09-01T00:00:00Z" },
  { ...req("주주명부", "requested"), description: "가업승계 검토용" },   // 다른 일로 요청 — 열려 있으면 다시 요청하지 않는다
];
const plan = policyPlan({ entity: "corporation", companyId: "co_t", vault, files: [], reqs }, "2026-10-16");
const st = (k: string) => plan.find((r) => r.doc.key === k)!;
ok(st("bizReg").state === "usable" && !st("bizReg").defaultOn, "서류함에 있는 사업자등록증 — 체크 안 함");
ok(st("corpReg").state === "expired" && st("corpReg").defaultOn, "3개월 지난 등기부 — 다시 요청(체크)");
ok(st("smeCert").state === "expiring" && st("smeCert").defaultOn && st("smeCert").daysLeft === 9, "기한 임박 중소기업확인서 — 체크 · 9일 남음");
ok(st("articles").state === "open" && st("articles").openStatus === "submitted" && !st("articles").defaultOn, "제출된 정관(요청 중) — 체크 안 함");
ok(st("shareholders").state === "open" && !st("shareholders").defaultOn, "다른 일로 요청 중인 주주명부도 겹쳐 요청하지 않음");
ok(st("vatBase").state === "usable", "검토 완료한 부가세 과세표준증명(유효기간 없음) — 준비됨");
ok(st("finStmt").state === "missing" && st("finStmt").defaultOn, "없는 재무제표 — 체크");
ok(st("taxCert").state === "missing" && !st("taxCert").defaultOn, "납세증명서 — 신청 직전 서류라 기본 꺼짐");
const seen = policyPlan({ entity: "corporation", companyId: "co_t", files: [], reqs: [], seen: { bizReg: "2026-10-10" } }, "2026-10-16");
ok(seen.find((r) => r.doc.key === "bizReg")?.seenAt === "2026-10-10" && seen.find((r) => r.doc.key === "bizReg")?.state === "missing" && !seen.find((r) => r.doc.key === "finStmt")?.seenAt, "기업정보에서 읽은 사업자등록증 — 확인한 날 표시 · 파일은 없음으로 둠");
const sole = policyPlan({ entity: "sole", companyId: "co_t", vault, files: [], reqs: [] }, "2026-10-16");
ok(!sole.some((r) => r.doc.corpOnly), "개인사업자 요청 창에 법인 서류 없음");

// 3) 고객 화면 준비도
const creq: DocumentRequest[] = [
  { ...req("사업자등록증", "done"), submittedAt: "2026-10-02T00:00:00Z" },
  { ...req("납세증명서", "done"), submittedAt: "2026-09-01T00:00:00Z" },       // 30일 넘음 → 다시 발급
  req("표준재무제표증명 (최근 3년)", "requested"),
  { ...req("법인등기부등본", "revision"), reviewNote: "말소사항 포함으로" },
  req("중소기업 확인서", "reviewing"),
  { ...req("정관", "requested"), description: "가업승계 검토용" },               // 묶음이 아님 — 준비도에 넣지 않음
  { ...req("사업자등록증", "planned"), id: "dr_planned" },
];
const rd = policyReadiness(creq, "co_t", "2026-10-16");
ok(rd.rows.map((r) => r.state).join() === "revision,todo,stale,checking,ready", "할 일 먼저: " + rd.rows.map((r) => `${r.doc.key}:${r.state}`).join(" "));
ok(rd.total === 5 && rd.ready === 1 && rd.checking === 1, `준비 ${rd.ready}/${rd.total}`);
ok(!isPolicyRequest({ name: "정관", description: "가업승계 검토용" }) && isPolicyRequest({ name: "정관", description: policyRequestText(doc("정관")) }), "묶음으로 요청한 것만 정책자금 준비 서류");

// 4) 고객 홈: 묶음 서류는 한 줄, 다른 요청은 그대로
const company = { id: "co_t", code: "T", name: "테스트(주)", ceo: "대표", industry: "", bizNo: "", contactName: "", contactTitle: "", contactPhone: "", contactEmail: "", address: "", employees: 0, revenue: "", firstConsultDate: "2026-01-01", consultantId: "u1", memo: "" } as Company;
const board = growthBoard({ company, projects: [], opportunities: [], docRequests: [req("사업자등록증", "requested"), req("주주명부", "requested"), req("정관", "revision"), { ...req("사업자등록증", "requested"), id: "dr_other", name: "매출채권 연령표", description: "검토용" }], quotes: [], results: [], schedules: [], now: new Date("2026-10-16T01:00:00Z") });
const docActs = board.actions.filter((a) => a.kind === "doc");
ok(docActs.length === 2 && docActs[0].title.includes("매출채권") && docActs[1].key === "doc_policy" && docActs[1].title === "정책자금 서류 3개 올리기" && !!docActs[1].urgent && docActs[1].href.endsWith("#policy-docs"), "홈: " + docActs.map((a) => a.title).join(" / "));
const one = growthBoard({ company, projects: [], opportunities: [], docRequests: [req("사업자등록증", "requested")], quotes: [], results: [], schedules: [], now: new Date("2026-10-16T01:00:00Z") });
ok(one.actions[0]?.title === "사업자등록증 올리기", "한 개뿐이면 묶지 않음");

if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");

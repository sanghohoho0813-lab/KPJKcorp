// 성장과제 판(lib/growth) — 규칙이 근거 있는 것만 고르는지, 상태가 기존 데이터에서 맞게 읽히는지
import { growthBoard } from "../../src/lib/growth";
import type { Company, Opportunity, Project } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const now = new Date("2026-10-01T09:00:00Z");
const co = (x: Partial<Company> = {}): Company => ({
  id: "co_t", code: "T", name: "테스트(주)", ceo: "대표", industry: "제조업", bizNo: "", contactName: "", contactTitle: "", contactPhone: "",
  contactEmail: "", address: "", employees: 0, revenue: "", firstConsultDate: now.toISOString(), consultantId: "u1", memo: "", ...x,
} as Company);
const pj = (x: Partial<Project>): Project => ({ id: "pj_" + Math.random().toString(36).slice(2, 7), companyId: "co_t", name: "x", type: "가지급금", consultantId: "u1", startDate: now.toISOString(), dueDate: now.toISOString(), stage: "review", description: "", stageChangedAt: now.toISOString(), clientVisible: true, ...x } as Project);
const op = (x: Partial<Opportunity>): Opportunity => ({ id: "op_" + Math.random().toString(36).slice(2, 7), companyId: "co_t", serviceKey: "kpjk_가업승계", serviceName: "가업승계", source: "proposal", status: "proposed", assigneeId: "u1", createdAt: now.toISOString(), createdBy: "u1", updatedAt: now.toISOString(), history: [], ...x } as Opportunity);
const base = { opportunities: [] as Opportunity[], projects: [] as Project[], docRequests: [], quotes: [], results: [], schedules: [], now };

// 1) 기업정보만 있는 새 고객 — 근거 있는 규칙만
let b = growthBoard({ ...base, company: co({ entityType: "corporation", establishedAt: "2012-03-02", employees: 12 }) });
const areas = b.suggested.map((x) => x.area);
ok(areas.includes("가업승계") && b.suggested.find((x) => x.area === "가업승계")!.basis!.includes("업력 14년"), "업력 10년 이상 법인 → 가업승계 (근거: 업력 14년) " + areas.join(","));
ok(areas.length <= 3, "최대 3개");
ok(b.suggested.every((x) => !!x.reason && !!x.basis), "모든 추천에 이유·근거");
ok(!areas.some((a) => /정책자금|벤처|고용지원금/.test(a)), "정책자금·벤처 등은 추천하지 않는다");
b = growthBoard({ ...base, company: co({ entityType: "sole", industry: "음식점업" }) });
ok(b.suggested[0]?.area === "법인전환", "개인사업자 → 법인전환");
b = growthBoard({ ...base, company: co({ industry: "", entityType: undefined }) });
ok(b.suggested.length === 0, "근거가 없으면 아무것도 권하지 않는다");

// 2) 진행 이력 → 이어지는 과제, 이미 다루는 분야는 다시 권하지 않는다
b = growthBoard({ ...base, company: co({ entityType: "corporation", establishedAt: "2020-01-01" }), projects: [pj({ type: "가지급금", stage: "done" })] });
ok(b.completed.length === 1 && b.completed[0].area === "가지급금", "끝난 프로젝트 → 완료한 과제");
ok(b.suggested[0]?.area === "이익잉여금" && b.suggested[0].basis === "진행이력: 가지급금 완료", "가지급금 완료 → 이익잉여금 이어서");
ok(!b.suggested.some((x) => x.area === "가지급금"), "완료한 분야는 다시 권하지 않는다");

// 3) 관심 분야 · 진행 중 · 요청 · 제안의 우선순위
b = growthBoard({
  ...base, company: co({ interests: ["succession", "policy_fund"] }),
  projects: [pj({ type: "기업부설연구소", stage: "in_progress" })],
  opportunities: [op({ serviceName: "가업승계", serviceKey: "kpjk_가업승계", source: "proposal", reason: "담당자가 쓴 이유" }), op({ serviceName: "가업승계", serviceKey: "kpjk_가업승계", source: "portal_request", status: "contacted" }), op({ serviceName: "인사노무", serviceKey: "kpjk_인사노무", source: "proposal", reason: "권함" })],
});
ok(b.active.length === 1 && b.active[0].progress === 75 && b.active[0].stepLabel === "진행 중", "진행 중 프로젝트 → 진행 중 과제 75%");
ok(b.review.length === 1 && b.review[0].area === "가업승계" && b.review[0].reason === "담당자가 쓴 이유", "요청 + 제안이 같은 분야면 '검토 중' 하나로(제안 이유 유지)");
ok(b.proposed.length === 1 && b.proposed[0].area === "인사노무", "요청 안 한 제안 → 담당자 제안");
ok(b.suggested.some((x) => x.area === "특허자본" && x.basis === "진행이력: 기업부설연구소 진행 중"), "연구소 진행 중 → 특허자본");
ok(!b.suggested.some((x) => x.area === "가업승계"), "이미 검토 중인 분야는 추천에서 빠진다");
ok(!b.suggested.some((x) => /정책자금/.test(x.area)), "관심 분야의 정책자금은 KPJK 분야가 아니라 무시");

// 4) 지금 해야 할 일
b = growthBoard({
  ...base, company: co(),
  docRequests: [{ id: "d1", companyId: "co_t", projectId: "", name: "주주명부", description: "", requestedAt: "", dueDate: "2026-09-20T09:00:00Z", status: "requested", assigneeId: "u1", files: [] }, { id: "d2", companyId: "co_t", projectId: "", name: "정관", description: "", requestedAt: "", dueDate: "2026-10-10T09:00:00Z", status: "revision", assigneeId: "u1", files: [] }] as never,
  quotes: [{ id: "q1", companyId: "co_t", title: "견적", status: "sent" }] as never,
});
ok(b.actions.length === 3 && b.actions[0].title.includes("주주명부") && !!b.actions[0].urgent, "기한 지난 자료가 먼저 · 빨강");
ok(b.actions.some((a) => a.title.includes("정관 보완")), "보완 요청은 '보완해서 다시 올리기'");
ok(b.actions.some((a) => a.kind === "quote"), "회신 기다리는 견적");
console.log(fail ? `\nFAIL ${fail}` : "\n전부 통과");
process.exit(fail ? 1 : 0);

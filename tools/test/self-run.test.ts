// 스스로 준비하기 — 한 건만(id) · 체크 진행 · 다음 행동 · 담당자 후속 · 입력/확인 구분 · 측정(샘플/실제 구분) · 학습 자료 연결 · 주소 검사
import { selfRunId, findRun, checkProgress, nextStep, followUpOf, resultBasis, selfMetrics, canSet, statusLabel, guideOf, PROGRAM_CHECKS, isTestCompany } from "../../src/lib/self-run";
import { learnForProgram, learnForArea, cleanLearnInput, learnCategories, STARTER_LEARN, DEFAULT_LEARN_CATEGORIES } from "../../src/lib/learn";
import { safeHttpsUrl, youtubeId, OFFICIAL_LINKS } from "../../src/lib/official-links";
import type { LearnContent, SelfRun } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const now = new Date(2026, 9, 28, 10, 0);
const iso = (d: number) => new Date(now.getTime() + d * 864e5).toISOString();
const run = (p: Partial<SelfRun>): SelfRun => ({ id: "sr_x", companyId: "co_a", kind: "program", targetKey: "bz_1", targetTitle: "스마트공장 지원", status: "preparing", checks: {}, evidence: [], startedAt: iso(-5), statusAt: iso(-5), createdBy: "c_a", createdAt: iso(-5), updatedAt: iso(-5), ...p });

// 한 건만
ok(selfRunId("co_a", "program", "bz_1") === selfRunId("co_a", "program", "bz_1"), "같은 기업·종류·대상 → 같은 id");
ok(selfRunId("co_a", "program", "bz_1") !== selfRunId("co_b", "program", "bz_1") && selfRunId("co_a", "growth", "bz_1") !== selfRunId("co_a", "program", "bz_1"), "기업·종류가 다르면 다른 id");
ok(selfRunId("co_a", "growth", "기업부설연구소").startsWith("sr_g_co_a_"), "한글 대상도 안전한 id");
ok(findRun([run({}), run({ id: "y", targetKey: "bz_2" })], "co_a", "program", "bz_2")?.id === "y", "기존 기록 찾기");
// 상태
ok(canSet("program", "selected") && !canSet("program", "done") && canSet("growth", "skipped") && !canSet("growth", "waiting"), "종류에 맞는 상태만");
ok(statusLabel("growth", "applied") === "직접 신청" && statusLabel("program", "applied") === "신청 완료", "같은 상태 이름도 종류별 표기");
// 체크 진행
ok(checkProgress(run({ checks: { notice: iso(0), period: iso(0) } })).done === 2 && checkProgress(run({})).total === PROGRAM_CHECKS.length, "체크 진행 2/6");
ok(checkProgress(run({ kind: "growth", targetKey: "기업부설연구소", checks: { req: iso(0) } })).total === 5, "분야 안내가 있는 성장과제는 그 체크리스트");
ok(guideOf("가업승계").expertAdvised !== undefined && guideOf("가업승계").checks.length === 4 && guideOf("가업승계").links.length === 0, "안내 없는 분야: 공통 순서 · 전문가 검토 권고 · 지어낸 링크 없음");
// 다음 행동
const n1 = nextStep(run({ checks: { notice: iso(0) } }), { applyEnd: "2026-11-02" }, now);
ok(!!n1 && n1.title.includes("준비 1/6") && n1.sub === "마감 D-5" && n1.urgent === true, "준비 중 → 남은 항목 · 마감 D-5(급함)");
const all = Object.fromEntries(PROGRAM_CHECKS.map((c) => [c.key, iso(0)]));
ok(nextStep(run({ checks: all }), undefined, now)?.title.includes("공식 사이트에서 신청하기") === true, "모두 체크 → 신청하기");
ok(nextStep(run({ status: "applied" }), undefined, now)?.sub?.includes("접수번호") === true, "신청 완료 → 결과 기록 · 근거 남기기 안내");
ok(nextStep(run({ status: "not_selected" }), undefined, now)?.href === "/portal/programs", "미선정 → 다른 공고 찾기");
ok(nextStep(run({ status: "stopped" }), undefined, now) === undefined && nextStep(run({ kind: "growth", targetKey: "인사노무", status: "skipped" }), undefined, now) === undefined, "중단 · 진행 안 함 → 다음 행동 없음");
ok(nextStep(run({ kind: "growth", targetKey: "인사노무", status: "exploring" }), undefined, now)?.href === "/portal/self/growth/%EC%9D%B8%EC%82%AC%EB%85%B8%EB%AC%B4", "성장과제 다음 행동 주소");
// 담당자 후속
const fSel = followUpOf(run({ id: "sr_9" }), "selected", "에이정밀(주)");
ok(!!fSel?.task && fSel.task.ruleKey === "self_run:sr_9:selected" && fSel.notify.body.includes("고객 입력"), "선정 → 알림 + 업무(같은 근거 한 번) · 고객 입력 표시");
ok(!!followUpOf(run({}), "applied", "A")?.notify && !followUpOf(run({}), "applied", "A")?.task, "신청 완료 → 알림만");
ok(followUpOf(run({}), "preparing", "A") === undefined && followUpOf(run({ kind: "growth", targetKey: "인사노무" }), "exploring", "A") === undefined, "준비 · 알아보기는 담당자에게 보내지 않음");
ok(followUpOf(run({ id: "g1", kind: "growth", targetKey: "기업부설연구소" }), "done", "A")?.task?.ruleKey === "self_run:g1:done", "성장과제 완료 → 확인 · 기업정보 반영 업무");
// 입력 / 확인 구분
ok(resultBasis(run({})).key === "self" && resultBasis(run({ evidence: [{ id: "e", kind: "number", label: "접수번호", value: "1", at: iso(0), by: "c_a" }] })).key === "attached"
  && resultBasis(run({ evidence: [{ id: "e", kind: "number", label: "접수번호", value: "1", at: iso(0), by: "c_a", confirmedBy: "u_park", confirmedAt: iso(0) }] })).key === "confirmed", "고객 입력 / 근거 첨부 / 담당자 확인");
// 측정
const runs = [run({ id: "a" }), run({ id: "b", status: "waiting", startedAt: iso(-10) }), run({ id: "c", companyId: "co_s", kind: "learn", status: "learned" }), run({ id: "d", kind: "growth", targetKey: "인사노무", status: "done", helpRef: "op_1" })];
const acts = [{ type: "self_status", at: iso(-6), meta: { runId: "b", to: "applied" } }, { type: "self_status", at: iso(-2), meta: { runId: "b", to: "waiting" } }];
const m = selfMetrics(runs, acts, (id) => id === "co_s");
ok(m.real.programStarted === 2 && m.real.programApplied === 1 && m.real.daysToApply === 4 && m.real.growthDone === 1 && m.real.helpRequested === 1 && m.real.learned === 0, "실제 기업: 시작 2 · 신청 1 · 신청까지 4일 · 완료 1 · 도움 요청 1");
ok(m.sample.learned === 1 && m.sample.programStarted === 0, "샘플(시연) 기업은 따로 센다");
// 학습 자료
const pub = (x: (typeof STARTER_LEARN)[number], published = true): LearnContent => ({ ...x, published, createdAt: iso(-1), updatedAt: iso(-1) });
const lib = STARTER_LEARN.map((x) => pub(x));
const forFund = learnForProgram(lib, { title: "2026년 중소기업 정책자금 융자 공고", category: "금융", summary: "", tags: [] });
ok(forFund[0].id === "lc_policy_basics" && forFund.some((x) => x.forAllPrograms), "정책자금 공고 → 정책자금 자료 먼저 + 공통 자료");
ok(learnForProgram(lib.map((x) => ({ ...x, published: false })), { title: "정책자금", category: "금융", tags: [] }).length === 0, "비공개 자료는 연결하지 않음");
ok(learnForArea(lib, "기업부설연구소").some((x) => x.id === "lc_cert_rnd"), "성장과제 분야 → 관련 자료");
ok(STARTER_LEARN.every((x) => !x.videoUrl) && STARTER_LEARN.length === DEFAULT_LEARN_CATEGORIES.length, "기본 안내 7개 · 가짜 영상 없음");
ok(STARTER_LEARN.every((x) => x.links.every((l) => OFFICIAL_LINKS.some((o) => o.url === l.url))), "기본 안내 링크는 공식 기관 목록에서만");
ok(STARTER_LEARN.every((x) => !/\d+\s*%|\d+억|\d+만\s*원/.test([x.summary, ...x.body].join(" "))), "기본 안내에 금리 · 금액 숫자 없음");
ok(learnCategories([{ category: "새 분류" }, { category: DEFAULT_LEARN_CATEGORIES[0] }]).at(-1) === "새 분류", "운영자가 적은 새 분류는 뒤에");
const c1 = cleanLearnInput({ title: " ", videoUrl: "https://vimeo.com/1", links: [{ label: "x", url: "javascript:alert(1)" }], category: "" });
ok(c1.problems.length === 4 && c1.value.videoUrl === undefined && c1.value.links?.length === 0, "운영자 입력 검사: 빈 제목 · YouTube 아님 · https 아님 · 빈 분류");
// 주소
ok(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ") === "dQw4w9WgXcQ" && youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3") === "dQw4w9WgXcQ" && youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ") === "dQw4w9WgXcQ", "YouTube 주소 3가지");
ok(youtubeId("https://evil.com/watch?v=dQw4w9WgXcQ") === undefined && youtubeId("http://youtube.com/watch?v=dQw4w9WgXcQ") === undefined && youtubeId("https://youtube.com/watch?v=short") === undefined, "다른 사이트 · http · 잘못된 id 거절");
ok(safeHttpsUrl("https://user:pw@kosmes.or.kr") === undefined && safeHttpsUrl("data:text/html,x") === undefined && safeHttpsUrl("https://www.kosmes.or.kr") === "https://www.kosmes.or.kr/", "외부 주소 검사");
ok(isTestCompany({ name: "[가상] 시연기업" }) && isTestCompany({ name: "(가상)한빛정밀" }) && isTestCompany({ name: "에이정밀(주)", sample: true }) && !isTestCompany({ name: "가상현실(주)" }) && !isTestCompany({ name: "주식회사 한빛" }), "시연 · 시험 기업 구분: 샘플 · [가상] · (가상)만");
console.log(fail ? `\n${fail} FAIL` : "\nALL OK");
process.exit(fail ? 1 : 0);

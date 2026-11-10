// 갱신 준비 — 계약 기간(서명일 ~ 오늘)에 실제로 함께한 일, 고객에게 안 보이는 기록 빼기, 다음 1년 제안(근거 · 6줄),
// 본문(금액 없음 · 뺀 줄 · 한마디 · 서명) · 제목, 갱신 견적 초안, 다음 기간 시작일. 기업 · 기록은 지어낸 것.
import { buildRenewal, contractStart, isRenewalNotice, lastRenewalFor, missingEndContracts, periodEnd, relationStart, renewalQuoteFor, renewalStage, renewalStartFromScope, renewalTasksToClose, suggestedEndDate, renewalBody, renewalContract, renewalNext, renewalQuoteDraft, renewalStart, renewalTitle, RENEWAL_PREFIX } from "../../src/lib/renewal";
import { isReport } from "../../src/lib/progress-report";
import type { Activity, Company, Consultation, Contract, DocumentRequest, Inquiry, Notice, Opportunity, Project, Quote, ResultFile, Schedule, SelfRun } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

const company = {
  id: "co_t", name: "시험정밀(주)", ceo: "홍길동", industry: "정밀부품 제조", entityType: "corporation", establishedAt: "2012-04-01",
  certifications: [
    { name: "메인비즈", acquiredAt: "2026-08-20", expiresAt: "2029-08-19" },        // 기간 안 취득
    { name: "ISO 9001", acquiredAt: "2021-05-10", expiresAt: "2027-01-31" },        // 오늘 기준 D-89 → 재확인 준비
    { name: "옛 인증", acquiredAt: "2019-01-01", expiresAt: "2026-10-01" },          // 이미 지남
  ],
} as Company;

const contract: Contract = { id: "ct_t", companyId: "co_t", projectId: "pj_main", title: "경영진단 컨설팅 계약", status: "signed", sentAt: "2026-06-28T03:00:00Z", signedAt: "2026-07-01T03:00:00Z", period: "6개월", scope: "원가 · 조직 진단", endDate: "2026-12-31", amount: 18_000_000, source: "quote" };
const nowIso = "2026-11-03T02:00:00Z"; // 오늘 2026-11-03 (KST 11:00)

const proj = (id: string, extra: Partial<Project>): Project => ({ id, companyId: "co_t", name: id, type: "경영진단", consultantId: "u1", startDate: "2026-07-01", dueDate: "2026-12-31", stage: "in_progress", description: "", stageChangedAt: "2026-07-01T03:00:00Z", clientVisible: true, ...extra });
const projects: Project[] = [
  proj("pj_main", { name: "경영진단", stage: "done", stageChangedAt: "2026-10-10T03:00:00Z" }),
  proj("pj_cert", { name: "메인비즈 인증 자문", type: "메인비즈", stage: "aftercare", startDate: "2026-07-10", stageChangedAt: "2026-08-25T03:00:00Z" }),
  proj("pj_go", { name: "원가 개선 실행", stage: "review", startDate: "2026-10-15", stageChangedAt: "2026-10-20T03:00:00Z" }),
  proj("pj_old", { name: "작년에 끝난 일", stage: "done", startDate: "2025-03-01", stageChangedAt: "2025-06-01T03:00:00Z" }),
  proj("pj_hidden", { name: "내부 전용 분석", clientVisible: false, stage: "done", stageChangedAt: "2026-09-01T03:00:00Z" }),
  proj("pj_arch", { name: "보관한 일", archived: true }),
  { ...proj("pj_x", { name: "다른 회사 일" }), companyId: "co_x" },
];
const req = (id: string, status: DocumentRequest["status"], extra: Partial<DocumentRequest> = {}): DocumentRequest => ({ id, projectId: "pj_main", companyId: "co_t", name: id, description: "", requestedAt: "2026-07-05T03:00:00Z", dueDate: "2026-07-20", status, assigneeId: "u1", files: [], ...extra });
const docRequests: DocumentRequest[] = [
  req("재무제표", "done", { submittedAt: "2026-07-12T03:00:00Z", reviewedAt: "2026-07-14T03:00:00Z" }),
  req("인건비 내역", "done", { submittedAt: "2026-07-18T03:00:00Z", reviewedAt: "2026-07-20T03:00:00Z" }),
  req("원가 명세", "reviewing", { submittedAt: "2026-10-30T03:00:00Z" }),
  req("작년 자료", "done", { submittedAt: "2025-04-01T03:00:00Z", reviewedAt: "2025-04-02T03:00:00Z" }),
  req("주주명부", "requested", { dueDate: "2026-11-10" }),
  req("계획만", "planned"),
  { ...req("남의 자료", "requested"), companyId: "co_x" },
];
const results: ResultFile[] = [
  { id: "r1", projectId: "pj_main", companyId: "co_t", name: "경영진단 최종 보고서", kind: "보고서", sharedAt: "2026-10-10T05:00:00Z", sharedBy: "u1", size: 1, description: "" },
  { id: "r2", projectId: "pj_main", companyId: "co_t", name: "원가 개선 로드맵", kind: "분석자료", sharedAt: "2026-10-11T05:00:00Z", sharedBy: "u1", size: 1, description: "" },
  { id: "r0", projectId: "pj_old", companyId: "co_t", name: "작년 보고서", kind: "보고서", sharedAt: "2025-06-01T05:00:00Z", sharedBy: "u1", size: 1, description: "" },
];
const sch = (id: string, start: string, extra: Partial<Schedule> = {}): Schedule => ({ id, companyId: "co_t", title: id, type: "meeting", start, assigneeId: "u1", visibleToClient: true, ...extra });
const schedules: Schedule[] = [
  sch("착수 미팅", "2026-07-02T05:00:00Z"),
  sch("중간 보고", "2026-09-01T05:00:00Z", { type: "report" }),
  sch("내부 회의", "2026-09-02T05:00:00Z", { visibleToClient: false }),
  sch("서류 기한", "2026-07-20T00:00:00Z", { type: "doc_due" }),
  sch("다음 주 보고", "2026-11-10T05:00:00Z", { type: "report" }), // 아직 안 함
];
const inquiries: Inquiry[] = [
  { id: "q1", companyId: "co_t", title: "일정 문의", category: "일정", createdAt: "2026-08-11T03:00:00Z", createdBy: "c", status: "answered", assigneeId: "u1",
    messages: [{ id: "m1", authorId: "c", authorRole: "client", body: "?", createdAt: "2026-08-11T03:00:00Z" }, { id: "m2", authorId: "u1", authorRole: "consultant", body: "!", createdAt: "2026-08-11T05:00:00Z" }] },
  { id: "q2", companyId: "co_t", title: "답 안 한 문의", category: "기타", createdAt: "2026-10-12T03:00:00Z", createdBy: "c", status: "open", assigneeId: "u1",
    messages: [{ id: "m3", authorId: "c", authorRole: "client", body: "?", createdAt: "2026-10-12T03:00:00Z" }] },
];
const cs = (id: string, date: string, type: Consultation["type"]): Consultation => ({ id, companyId: "co_t", date, consultantId: "u1", type, channel: "방문", notes: "내부 메모 — 고객에게 안 보임", summary: { core: [], requirements: [], promises: [], documents: [], nextAction: "" } });
const consultations: Consultation[] = [cs("cs1", "2026-07-01T02:00:00Z", "초기상담"), cs("cs2", "2026-08-05T02:00:00Z", "정기미팅"), cs("cs3", "2026-09-05T02:00:00Z", "정기미팅"), cs("cs0", "2025-05-01T02:00:00Z", "초기상담")];
const notices: Notice[] = [
  { id: "nt1", companyId: "co_t", title: "경과 보고 (8/1 ~ 8/14)", body: "…", publishedAt: "2026-08-14T03:00:00Z", authorId: "u1" },
  { id: "nt2", companyId: "co_t", title: "경과 보고 (8/15 ~ 9/30)", body: "…", publishedAt: "2026-09-30T03:00:00Z", authorId: "u1" },
  { id: "nt3", companyId: "co_t", title: "추석 휴무 안내", body: "…", publishedAt: "2026-09-20T03:00:00Z", authorId: "u1" },
];
const act = (type: Activity["type"], at: string, text = "", meta?: Activity["meta"]) => ({ type, companyId: "co_t", at, text, meta });
const activities = [
  act("result_downloaded", "2026-10-12T01:00:00Z", "결과자료 열람: 경영진단 최종 보고서"),
  act("notice_read", "2026-08-14T09:00:00Z", "", { noticeId: "nt1" }),
  act("program_shared", "2026-08-01T01:00:00Z", "지원사업 공고 안내: 스마트공장"),
  act("program_shared", "2026-09-10T01:00:00Z", "지원사업 공고 안내: 수출바우처"),
  act("program_shared", "2025-09-10T01:00:00Z", "지원사업 공고 안내: 작년 공고"),
];
const run = (id: string, kind: SelfRun["kind"], targetKey: string, targetTitle: string, status: SelfRun["status"], statusAt: string): SelfRun => ({ id, companyId: "co_t", kind, targetKey, targetTitle, status, checks: {}, evidence: [], startedAt: statusAt, statusAt, createdBy: "c", createdAt: statusAt, updatedAt: statusAt });
const selfRuns: SelfRun[] = [
  run("sr1", "program", "pg1", "스마트공장 지원", "selected", "2026-09-20T03:00:00Z"),
  run("sr2", "program", "pg2", "수출바우처", "waiting", "2026-10-02T03:00:00Z"),
  run("sr3", "program", "pg3", "작년 공고", "not_selected", "2025-10-02T03:00:00Z"),
  run("sr4", "growth", "인사노무", "인사노무", "done", "2026-09-28T03:00:00Z"),
];
const opportunities: Opportunity[] = [
  { id: "op1", companyId: "co_t", serviceKey: "succession", serviceName: "가업승계", source: "portal_interest", status: "interest", assigneeId: "u1", createdAt: "2026-10-20T03:00:00Z", createdBy: "c", updatedAt: "2026-10-20T03:00:00Z", history: [] } as Opportunity,
];
const quotes: Quote[] = [
  { id: "qt1", companyId: "co_t", projectId: "pj_main", title: "경영진단", scope: "원가 · 조직 진단", period: "6개월", items: [{ name: "현황 진단", amount: 8_000_000 }, { name: "개선 로드맵", amount: 10_000_000 }], discountPct: 0, validUntil: "2026-06-30T14:59:00Z", status: "converted", createdBy: "u1", createdAt: "2026-06-20T03:00:00Z", contractId: "ct_t" },
];
const src = { company, contract, projects, docRequests, results, schedules, inquiries, consultations, notices, activities, selfRuns, opportunities, quotes };

// 1) 기간
ok(contractStart(contract, company, projects) === "2026-07-01", "시작: 서명일");
ok(contractStart({ ...contract, signedAt: undefined }, { contractStartedAt: "2026-06-30" }, projects) === "2026-06-30", "서명일이 없으면 회사의 계약 시작일");
ok(contractStart({ ...contract, signedAt: undefined }, {}, projects) === "2026-07-01", "그다음 연결 프로젝트 시작일");
ok(contractStart({ ...contract, signedAt: undefined, projectId: "" }, {}, projects) === "2026-06-28", "마지막으로 송부일");

const r = buildRenewal(src, nowIso)!;
console.log(JSON.stringify(r.sections.map((s) => [s.title, s.lines.map((l) => l.text)]), null, 1));
ok(!!r && r.from === "2026-07-01" && r.to === "2026-11-03" && r.days === 126, `함께한 날: 7/1 ~ 11/3 = 126일 (${r?.days})`);
ok(r.end === "2026-12-31" && r.daysLeft === 58, `종료일까지 58일 (${r.daysLeft})`);
const ended = buildRenewal({ ...src, contract: { ...contract, endDate: "2026-10-31" } }, nowIso)!;
ok(ended.to === "2026-10-31" && ended.daysLeft === -3, "종료일이 지났으면 종료일까지만 세고 남은 날은 음수");
ok(buildRenewal({ ...src, contract: { ...contract, signedAt: "2026-12-01T00:00:00Z" } }, nowIso) === undefined, "아직 시작 전 계약은 정리하지 않는다");

const sec = (k: string) => r.sections.find((s) => s.key === k);
const texts = (k: string) => sec(k)?.lines.map((l) => l.text) ?? [];

// 2) 함께 진행한 일
const work = texts("work");
ok(work[0] === "메인비즈 인증 자문 — 완료 (8/25)" && work[1] === "경영진단 — 완료 (10/10) · 결과자료 2건", "끝난 일: 완료일 순 · 결과자료 수 (사후관리도 완료)");
ok(work[2] === "원가 개선 실행 — 자료 검토 중 (10/15 시작)", "진행 중: 고객 단계 · 시작일");
ok(work.some((t) => t.startsWith("직접 진행해 마친 성장과제 1건 — 인사노무")), "고객이 직접 마친 성장과제");
ok(!work.some((t) => /작년|내부 전용|보관|다른 회사/.test(t)), "기간 밖 · 고객에게 숨긴 · 보관 · 다른 회사 프로젝트 제외");

// 3) 자료 · 결과물 · 소통 · 지원사업
ok(texts("docs")[0] === "보내 주신 자료 3건 받음 — 재무제표, 인건비 내역, 원가 명세" && texts("docs")[1] === "자료 검토 마침 2건", "자료: 기간 안 받은 3 · 검토 2 (작년 · 계획 · 다른 회사 제외)");
ok(texts("results")[0] === "결과자료 2건 전달 — 경영진단 최종 보고서, 원가 개선 로드맵" && texts("results")[1] === "그중 1건 대표님 쪽에서 열어 보심", "결과물: 기간 안 2건 · 열어 본 1건");
const talk = texts("talk");
ok(talk[0] === "상담 3회 (초기상담, 정기미팅)", "상담 3회 · 유형 (작년 상담 제외)");
ok(talk[1] === "보고 · 회의 2회", "보고 · 회의: 고객에게 보인 · 이미 지난 것만 (내부 · 서류 기한 · 다음 주 제외)");
ok(talk[2] === "문의 1건 답변" && talk[3] === "경과 보고 2회 (대표님 확인 1회)", "문의 답변 · 경과 보고(휴무 공지는 아님) · 대표 확인");
const sup = texts("support");
ok(sup[0] === "맞는 지원사업 공고 2건 안내", "지원사업 공고 안내 2건 (작년 제외)");
ok(sup[1] === "지원사업 신청 기록 2건 · 선정 1건 (스마트공장 지원)", "신청 기록 2 · 선정 1");
ok(sup[2] === "메인비즈 취득 (8/20)" && sup.length === 3, "기간 안 취득한 인증만");

// 4) 다음 1년
const next = sec("next")!.lines;
console.log(next.map((l) => `${l.text}  [${l.basis}]`).join("\n"));
ok(next.length <= 6 && next.every((l) => !!l.basis), "다음 1년: 6줄 이하 · 줄마다 근거");
ok(next[0].text === "옛 인증 유효기간 지남 (10/1) — 재확인 준비" && next[1].text === "ISO 9001 유효기간 2027.01.31까지 (D-89) — 재확인 준비", "기한 있는 인증 먼저 — 이미 지난 것 → 임박한 것");
ok(!next.some((l) => l.text.startsWith("메인비즈 유효기간")), "유효기간이 넉넉한 인증은 넣지 않는다");
ok(next.some((l) => l.text === "아직 남은 요청자료 1건 — 주주명부" && l.basis === "요청자료"), "남은 요청자료");
ok(next.some((l) => l.text === "가업승계 — 검토를 요청하신 과제"), "고객이 요청한 과제");
ok(!next.some((l) => l.text.startsWith("인사노무")), "고객이 이미 직접 마친 분야는 다시 권하지 않는다");
const nextNoCert = renewalNext({ ...src, company: { ...company, certifications: [] } }, nowIso);
ok(nextNoCert.some((l) => l.key === "next:programs" && l.text.includes("1건")), "진행 중 지원사업(결과 대기) 결과 확인");
ok(nextNoCert.filter((l) => l.key.startsWith("next:certsug:")).length <= 2, "기업정보로만 고른 인증 제안은 2개까지");

// 5) 숫자 · 본문 · 제목
ok(JSON.stringify(r.counts.map((x) => [x.label, x.n])) === JSON.stringify([["완료한 일", 3], ["받은 자료", 3], ["결과자료", 2], ["상담 · 보고", 7]]), `맨 위 숫자 ${JSON.stringify(r.counts)}`);
const body = renewalBody({ company, record: r, skip: new Set(["talk:inquiry"]), note: "내년에는 원가 개선 실행을 함께 마무리하겠습니다.", signature: "담당 박담당 이사" });
console.log(body);
ok(body.startsWith("홍길동 대표님, 2026.07.01부터 함께한 126일의 기록을 정리해 드립니다.\n완료한 일 3 · 받은 자료 3 · 결과자료 2 · 상담 · 보고 7"), "본문 첫 줄: 대표님 · 시작일 · 날수 · 숫자");
ok(body.includes("■ 함께 진행한 일\n· 메인비즈 인증 자문") && body.includes("■ 다음 1년에 함께 검토할 것"), "묶음 제목 · 줄 형식(■ · ·)");
ok(!body.includes("문의 1건 답변"), "뺀 줄은 본문에 없다");
ok(body.includes("■ 담당자 한마디\n내년에는") && body.trimEnd().endsWith("— 담당 박담당 이사"), "한마디 · 서명");
ok(!/18,000,000|1,800만|18000000|원\b/.test(body) && !body.includes("내부 메모"), "계약 금액 · 내부 상담 메모는 본문에 없다");
const title = renewalTitle(r);
ok(title === `${RENEWAL_PREFIX} · 2026.07.01 ~ 11/3` && !isReport({ title }) && isRenewalNotice({ title }), `제목 ${title} — 경과 보고로 세지 않는다`);
const sent: Notice[] = [...notices, { id: "nt9", companyId: "co_t", title, body, publishedAt: "2026-11-03T03:00:00Z", authorId: "u1" }];
ok(lastRenewalFor(sent, "co_t")?.id === "nt9" && lastRenewalFor(notices, "co_t") === undefined, "보낸 '함께한 기록' 찾기");

// 6) 계약 고르기 · 갱신 견적 · 다음 기간
const cts: Contract[] = [
  contract,
  { ...contract, id: "ct_far", endDate: "2027-06-30" },
  { ...contract, id: "ct_past", endDate: "2026-10-20" },
  { ...contract, id: "ct_draft", status: "sent", endDate: "2026-11-05" },
];
ok(renewalContract(cts, "co_t", "2026-11-03")?.id === "ct_past", "종료일이 가장 가까운 서명 계약(지난 것 포함) · 서명 전 제외");
ok(renewalContract([{ ...contract, id: "ct_before", endDate: "2026-10-24" }, { ...contract, id: "ct_after", endDate: "2026-11-13" }], "co_t", "2026-11-03")?.id === "ct_after", "같은 거리(10일 전 · 10일 뒤)면 아직 안 끝난 계약");
const older: Contract = { ...contract, id: "ct_old", signedAt: "2026-03-02T03:00:00Z", endDate: "2026-06-30" };
ok(relationStart([older, contract], contract, company, projects) === "2026-03-02" && relationStart([contract], contract, company, projects) === undefined, "첫 계약부터: 앞선 서명 계약의 시작일 · 없으면 없음");
const whole = buildRenewal(src, nowIso, { since: "2026-03-02" })!;
ok(whole.from === "2026-03-02" && whole.days === 247 && whole.daysLeft === 58, `첫 계약부터: 3/2 ~ 11/3 = 247일 · 종료일은 이 계약 그대로 (${whole.days})`);
ok(renewalContract([{ ...contract, endDate: undefined }, { ...contract, id: "ct_new", endDate: undefined, signedAt: "2026-09-01T00:00:00Z" }], "co_t")?.id === "ct_new", "종료일이 없으면 가장 최근 서명");
const qd = renewalQuoteDraft(contract, quotes);
ok(qd.title === "경영진단 컨설팅 계약 (갱신)" && qd.items.length === 2 && qd.items[1].amount === 10_000_000 && qd.period === "6개월" && qd.projectId === "pj_main", "견적에서 온 계약: 그 견적의 항목 · 기간");
const qs = renewalQuoteDraft(contract, quotes, "2027-01-01");
ok(qs.scope === "원가 · 조직 진단\n기존 계약 갱신 — 2027.01.01부터" && qs.period === "6개월", "다음 기간 시작일은 범위 끝에 한 줄(기간은 그대로)");
qd.items[0].amount = 1;
ok(quotes[0].items[0].amount === 8_000_000, "초안을 고쳐도 원래 견적은 그대로(복사)");
const qm = renewalQuoteDraft({ ...contract, id: "ct_m", source: "manual" }, quotes);
ok(qm.items.length === 1 && qm.items[0].name === "경영진단 컨설팅 계약" && qm.items[0].amount === 18_000_000, "직접 등록한 계약: 계약 금액 한 줄");
ok(renewalQuoteDraft({ ...contract, id: "ct_m", title: "연간 자문 (갱신)" }, []).title === "연간 자문 (갱신)", "이미 갱신 계약이면 '(갱신)'을 두 번 붙이지 않는다");
ok(renewalStart(contract) === "2027-01-01" && renewalStart({ endDate: "2026-02-28" }) === "2026-03-01" && renewalStart({}, "2026-11-03") === "2026-11-03", "다음 기간 시작: 종료 다음 날(해 · 달 넘김) · 없으면 오늘");

// 7) 갱신 고리 — 종료일 · 갱신 견적 상태 · 갱신 계약 서명 시 끝낼 업무
ok(periodEnd("2026-07-01", "6개월") === "2026-12-31" && periodEnd("2026-01-31", "1개월") === "2026-02-27" && periodEnd("2026-03-01", "12개월") === "2027-02-28", "N개월: 끝나는 날 포함(7/1 + 6개월 = 12/31) · 말일 넘김");
ok(periodEnd("2026-09-01", "10주") === "2026-11-09" && periodEnd("2026-09-01", "6 주") === "2026-10-12" && periodEnd("2026-01-01", "1년") === "2026-12-31", "N주 · N년");
ok(periodEnd("2026-03-02", "2026.03 ~ 2026.12") === "2026-12-31" && periodEnd("2026-03-02", "2026-03-02 ~ 2026-11-15") === "2026-11-15" && periodEnd("2026-03-02", "2026.3 ~ 2027.2") === "2027-02-28", "날짜로 적힌 기간: 끝 달의 말일 · 끝 날짜 그대로");
ok(periodEnd("2026-07-01", "협의 후 결정") === undefined && periodEnd("2026-07-01", "") === undefined && periodEnd("2026-07-01", "2025.01 ~ 2025.12") === undefined && periodEnd("7월 1일", "6개월") === undefined, "읽지 못하는 기간 · 시작보다 앞선 끝 · 잘못된 시작일은 권하지 않는다");
ok(renewalStartFromScope("원가 진단\n기존 계약 갱신 — 2027.01.01부터") === "2027-01-01" && renewalStartFromScope("원가 진단") === undefined, "범위에 적힌 다음 기간 시작일");
const sg1 = suggestedEndDate({ period: "6개월", scope: "원가 진단", signedAt: "2026-07-01T03:00:00Z" });
ok(sg1?.end === "2026-12-31" && sg1.basis === "signed", "종료일 제안: 서명일 + 기간");
const sg2 = suggestedEndDate({ period: "6개월", scope: "원가 진단\n기존 계약 갱신 — 2027.01.01부터", signedAt: "2026-12-20T03:00:00Z" });
ok(sg2?.end === "2027-06-30" && sg2.start === "2027-01-01" && sg2.basis === "renewal", "갱신 계약: 서명일이 아니라 다음 기간 시작일 + 기간");
ok(suggestedEndDate({ period: "6개월", scope: "", signedAt: undefined }) === undefined && suggestedEndDate({ period: "별도 협의", scope: "", signedAt: "2026-07-01T03:00:00Z" }) === undefined, "서명일이 없거나 기간을 못 읽으면 권하지 않는다");
ok(missingEndContracts([contract, { ...contract, id: "ct_noend", endDate: undefined }, { ...contract, id: "ct_sent", status: "sent", endDate: undefined }]).map((c) => c.id).join() === "ct_noend", "종료일 없는 서명 계약만(서명 전 계약은 아직 아님)");

const rq = (id: string, status: Quote["status"], extra: Partial<Quote> = {}): Quote => ({ id, companyId: "co_t", projectId: "pj_main", title: "경영진단 컨설팅 계약 (갱신)", scope: "", period: "6개월", items: [{ name: "a", amount: 1 }], discountPct: 0, validUntil: "2026-12-30T14:59:00Z", status, createdBy: "u1", createdAt: "2026-11-03T03:00:00Z", ...extra });
ok(renewalStage(contract, quotes).stage === "none", "갱신 견적이 없으면 준비 전(전환된 원래 견적은 갱신 견적이 아님)");
ok(renewalStage(contract, [...quotes, rq("r1", "draft")]).stage === "quote_draft" && renewalStage(contract, [rq("r1", "sent")]).stage === "quote_sent" && renewalStage(contract, [rq("r1", "accepted")]).stage === "accepted" && renewalStage(contract, [rq("r1", "converted")]).stage === "renewed", "갱신 견적 상태 → 작성 중 · 회신 대기 · 수락 · 갱신 계약");
ok(renewalQuoteFor(contract, [rq("old", "declined", { createdAt: "2026-11-01T00:00:00Z" }), rq("new", "draft", { createdAt: "2026-11-02T00:00:00Z" })])?.id === "new" && renewalStage(contract, [rq("old", "declined")]).stage === "declined", "보류된 견적보다 살아 있는 견적 · 보류뿐이면 보류");
ok(renewalQuoteFor(contract, [rq("x", "draft", { companyId: "co_x" }), rq("before", "draft", { createdAt: "2026-06-01T00:00:00Z" }), rq("other", "draft", { projectId: "pj_else", title: "다른 일 (갱신)" })]) === undefined, "다른 기업 · 계약 서명 전에 만든 것 · 다른 프로젝트의 다른 계약은 제외");
ok(renewalQuoteFor({ ...contract, projectId: "" }, [rq("t", "draft", { projectId: undefined })])?.id === "t", "프로젝트 없는 계약은 제목으로 찾는다");

const tk = (id: string, ruleKey: string | undefined, status = "todo", companyId = "co_t") => ({ id, ruleKey, status: status as "todo" | "done", companyId });
const oldA: Contract = { ...contract, id: "ct_a", projectId: "pj_a" };
const oldB: Contract = { ...contract, id: "ct_b", projectId: "pj_b" };
const signedNew: Contract = { ...contract, id: "ct_new", projectId: "pj_a", title: "경영진단 컨설팅 계약 (갱신)", scope: "x\n기존 계약 갱신 — 2027.01.01부터" };
const tasks = [tk("t_a", "contract_renewal:ct_a"), tk("t_b", "contract_renewal:ct_b"), tk("t_x", "contract_renewal:ct_zz", "todo", "co_x"), tk("t_done", "contract_renewal:ct_a", "done"), tk("t_other", "progress_report:co_t"), tk("t_plain", undefined)];
ok(renewalTasksToClose(signedNew, [oldA, oldB, signedNew], tasks).join() === "t_a", "같은 프로젝트의 앞선 계약에 걸린 갱신 협의만 끝낸다(다른 계약 · 끝난 업무 · 다른 규칙 · 다른 기업 제외)");
ok(renewalTasksToClose({ ...signedNew, projectId: "pj_new" }, [oldA, oldB], tasks).length === 0, "프로젝트가 다르고 열린 갱신 협의가 둘이면 애매 — 아무것도 끝내지 않는다");
ok(renewalTasksToClose({ ...signedNew, projectId: "pj_new" }, [oldA], [tk("t_a", "contract_renewal:ct_a")]).join() === "t_a", "프로젝트가 달라도 갱신 계약이고 열린 갱신 협의가 하나뿐이면 끝낸다");
ok(renewalTasksToClose({ ...contract, id: "ct_plain", projectId: "pj_new", title: "새 프로젝트 계약", scope: "별건" }, [oldA], [tk("t_a", "contract_renewal:ct_a")]).length === 0, "갱신 표시가 없는 다른 프로젝트 계약은 갱신으로 보지 않는다");
ok(renewalTasksToClose(oldA, [oldA], [tk("t_a", "contract_renewal:ct_a")]).length === 0, "자기 자신의 갱신 협의는 끝내지 않는다(같은 계약을 고쳐 저장한 경우)");

console.log(fail ? `\n실패 ${fail}` : "\n전부 통과");
process.exit(fail ? 1 : 0);

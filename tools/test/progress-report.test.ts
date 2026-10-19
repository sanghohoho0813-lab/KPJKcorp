// 경과 보고 — 기간 안 기록으로 만든 줄(진행 상황·한 일·부탁·다음 일정), 고객에게 안 보이는 기록 빼기, 본문·제목, 지난 보고, 공지 본문 서식. 기업·기록은 지어낸 것.
import { buildReport, isReport, lastReportFor, noticeBlocks, reportBody, reportFrom, reportSeenAt, reportTitle } from "../../src/lib/progress-report";
import type { Company, DocumentRequest, Inquiry, Notice, Project, ResultFile, Schedule } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

const company = { id: "co_t", name: "시험정밀(주)", ceo: "홍길동" } as Company;
const proj = (id: string, extra: Partial<Project>): Project => ({ id, companyId: "co_t", name: id, type: "경영진단", consultantId: "u1", startDate: "2026-09-01", dueDate: "2026-12-01", stage: "review", description: "", stageChangedAt: "2026-09-20T03:00:00Z", clientVisible: true, ...extra });
const projects: Project[] = [
  proj("경영진단", { stage: "review", stageChangedAt: "2026-10-12T03:00:00Z", nextMilestone: { label: "중간 보고", date: "2026-10-27" } }),
  proj("인증 자문", { stage: "in_progress", startDate: "2026-09-05", nextMilestone: { label: "지난 일", date: "2026-10-01" } }),
  proj("끝난 일", { stage: "done", stageChangedAt: "2026-10-15T03:00:00Z" }),
  proj("예전에 끝남", { stage: "done", stageChangedAt: "2026-08-01T03:00:00Z" }),
  proj("내부 전용", { clientVisible: false }),
  proj("보관됨", { archived: true }),
  { ...proj("다른 회사", {}), companyId: "co_x" },
];
const req = (id: string, status: DocumentRequest["status"], extra: Partial<DocumentRequest> = {}): DocumentRequest => ({ id, projectId: "경영진단", companyId: "co_t", name: id, description: "", requestedAt: "2026-09-25T03:00:00Z", dueDate: "2026-10-25", status, assigneeId: "u1", files: [], ...extra });
const docRequests: DocumentRequest[] = [
  req("재무제표", "done", { submittedAt: "2026-10-08T03:00:00Z", reviewedAt: "2026-10-10T03:00:00Z" }),
  req("인건비 내역", "reviewing", { submittedAt: "2026-10-14T03:00:00Z" }),
  req("옛 자료", "done", { submittedAt: "2026-08-10T03:00:00Z", reviewedAt: "2026-08-12T03:00:00Z" }),
  req("연령표", "revision", { submittedAt: "2026-09-30T03:00:00Z", reviewedAt: "2026-10-16T03:00:00Z", dueDate: "2026-10-21" }),
  req("주주명부", "requested", { dueDate: "2026-10-17" }),
  req("정관", "requested", { dueDate: "2026-10-30" }),
  req("계획만", "planned"),
  { ...req("남의 자료", "requested"), companyId: "co_x" },
];
const results: ResultFile[] = [
  { id: "r1", projectId: "경영진단", companyId: "co_t", name: "중간 진단 보고서", kind: "보고서", sharedAt: "2026-10-18T03:00:00Z", sharedBy: "u1", size: 1, description: "" },
  { id: "r0", projectId: "경영진단", companyId: "co_t", name: "옛 보고서", kind: "보고서", sharedAt: "2026-09-01T03:00:00Z", sharedBy: "u1", size: 1, description: "" },
];
const sch = (id: string, start: string, extra: Partial<Schedule> = {}): Schedule => ({ id, companyId: "co_t", title: id, type: "meeting", start, assigneeId: "u1", visibleToClient: true, ...extra });
const schedules: Schedule[] = [
  sch("착수 미팅", "2026-10-07T05:00:00Z"),
  sch("내부 회의", "2026-10-09T05:00:00Z", { visibleToClient: false }),
  sch("오늘 오후 보고", "2026-10-19T05:00:00Z", { type: "report" }),
  sch("중간 보고 미팅", "2026-10-27T05:00:00Z"),
  sch("서류 기한", "2026-10-25T00:00:00Z", { type: "doc_due" }),
  sch("두 달 뒤", "2026-12-25T05:00:00Z"),
];
const inquiries: Inquiry[] = [
  { id: "q1", companyId: "co_t", title: "일정 문의", category: "일정", createdAt: "2026-10-11T03:00:00Z", createdBy: "c", status: "answered", assigneeId: "u1",
    messages: [{ id: "m1", authorId: "c", authorRole: "client", body: "?", createdAt: "2026-10-11T03:00:00Z" }, { id: "m2", authorId: "u1", authorRole: "consultant", body: "!", createdAt: "2026-10-11T05:00:00Z" }] },
  { id: "q2", companyId: "co_t", title: "답 안 한 문의", category: "기타", createdAt: "2026-10-12T03:00:00Z", createdBy: "c", status: "open", assigneeId: "u1",
    messages: [{ id: "m3", authorId: "c", authorRole: "client", body: "?", createdAt: "2026-10-12T03:00:00Z" }] },
];

const nowIso = "2026-10-19T02:00:00Z";
const from = "2026-10-05", to = "2026-10-19";
const secs = buildReport({ company, projects, docRequests, results, schedules, inquiries }, from, to, nowIso);
const sec = (k: string) => secs.find((s) => s.key === k);
const texts = (k: string) => sec(k)?.lines.map((l) => l.text) ?? [];
console.log(JSON.stringify(secs.map((s) => [s.title, s.lines.map((l) => l.text)]), null, 1));

// 1) 지금 진행 상황
const now = texts("now");
ok(now.length === 3, "진행 상황: 고객에게 보이는 진행 중 2 + 이 기간에 끝난 1 (내부 전용·보관·예전 완료·다른 회사 제외)");
ok(now[0] === "경영진단 — 자료 검토 중 (10/12부터) · 다음: 중간 보고 10/27", "단계 · 이 기간 단계 변경일 · 다음 예정");
ok(now[1] === "인증 자문 — 진행 중", "지난 예정은 넣지 않음 · 기간 전 단계 변경은 표시 안 함");
ok(now[2] === "끝난 일 — 완료", "이 기간에 끝난 프로젝트는 완료로");

// 2) 이번 기간에 한 일
const done = texts("done");
ok(done.includes("보내 주신 자료 2건 받음 — 재무제표, 인건비 내역"), "받은 자료: 기간 안 제출만(옛 자료·보완 전 제출 제외)");
ok(done.includes("자료 검토 마침 1건 — 재무제표"), "검토 마침: 기간 안 완료 검토만");
ok(done.includes("결과자료 공유 — 중간 진단 보고서") && !done.some((t) => t.includes("옛 보고서")), "결과자료: 기간 안 공유만");
ok(done.includes("10/7 착수 미팅") && !done.some((t) => t.includes("내부 회의")), "지난 미팅: 고객에게 보이는 것만");
ok(!done.some((t) => t.includes("오늘 오후 보고")), "오늘 아직 안 한 일정은 한 일에 없음");
ok(done.includes("문의 1건 답변 — 일정 문의"), "문의: 담당자가 답한 것만");

// 3) 부탁드릴 것 — 보완 먼저, 기한 순, 지난 기한 표시, 계획만·다른 회사 제외
const ask = texts("ask");
ok(ask.length === 3, "남은 요청 3건");
ok(ask[0] === "연령표 (보완) — 기한 10/21", "보완이 먼저");
ok(ask[1] === "주주명부 — 기한 10/17 지남", "지난 기한 표시");
ok(ask[2] === "정관 — 기한 10/30", "기한 순");

// 4) 다음 일정 — 앞으로 30일, 서류 기한·내부 일정 제외, 오늘 오후 포함
const next = texts("next");
ok(next.length === 2 && next[0].startsWith("10/19(월)") && next[0].endsWith("오늘 오후 보고"), "오늘 오후 일정은 다음 일정");
ok(next[1].startsWith("10/27(화)") && next[1].endsWith("중간 보고 미팅"), "요일 · 제목");
ok(!next.some((t) => t.includes("서류 기한") || t.includes("두 달 뒤")), "서류 기한·30일 넘는 일정 제외");

// 5) 빈 묶음은 빠짐
const empty = buildReport({ company: { ...company, id: "co_none" } as Company, projects, docRequests, results, schedules, inquiries }, from, to, nowIso);
ok(empty.length === 0, "기록 없는 기업은 묶음 0개");

// 6) 본문 · 제목 · 빼기 · 한마디
const body = reportBody({ company, from, to, sections: secs, skip: new Set(["done:inquiries", ...(sec("next")?.lines.map((l) => l.key) ?? [])]), note: "  이번 주에 초안을 마무리합니다. ", signature: "박담당 이사" });
const lines = body.split("\n");
ok(lines[0] === "홍길동 대표님, 10/5~10/19 진행 상황을 정리해 드립니다.", "인사 줄");
ok(body.includes("■ 지금 진행 상황\n· 경영진단 — 자료 검토 중"), "묶음 제목 · 줄");
ok(!body.includes("문의 1건") && !body.includes("■ 다음 일정"), "뺀 줄 · 다 뺀 묶음은 없음");
ok(body.includes("■ 담당자 한마디\n이번 주에 초안을 마무리합니다.") && body.endsWith("— 박담당 이사"), "한마디 · 서명");
ok(reportTitle(from, to) === "경과 보고 · 10/5 ~ 10/19", "제목");

// 7) 공지 본문 서식
const blocks = noticeBlocks(body);
ok(blocks[0].kind === "p" && blocks[1].kind === "h" && blocks[1].text === "지금 진행 상황" && blocks[2].kind === "li", "■ → 제목, · → 목록");
const plain = noticeBlocks("휴무 안내\n- 10/3 개천절\n-5% 아님\n\n감사합니다");
ok(plain.map((b) => b.kind).join() === "p,li,p,p", "일반 공지: '- ' 만 목록, 빈 줄 건너뜀");

// 8) 기간 · 지난 보고
ok(reportFrom("2w", "2026-10-19") === "2026-10-05", "최근 2주");
ok(reportFrom("1m", "2026-10-19") === "2026-09-19", "최근 한 달");
ok(reportFrom("since", "2026-10-19", "2026-10-02T03:00:00Z") === "2026-10-02", "지난 보고 이후");
const notices: Notice[] = [
  { id: "n1", companyId: "co_t", title: "경과 보고 · 9/1 ~ 9/14", body: "", publishedAt: "2026-09-14T03:00:00Z", authorId: "u1" },
  { id: "n2", companyId: "co_t", title: "경과 보고 · 9/15 ~ 10/2", body: "", publishedAt: "2026-10-02T03:00:00Z", authorId: "u1" },
  { id: "n3", companyId: "co_t", title: "휴무 안내", body: "", publishedAt: "2026-10-10T03:00:00Z", authorId: "u1" },
  { id: "n4", companyId: "co_x", title: "경과 보고 · 10/1 ~ 10/15", body: "", publishedAt: "2026-10-15T03:00:00Z", authorId: "u1" },
];
ok(lastReportFor(notices, "co_t")?.id === "n2", "이 기업의 가장 최근 경과 보고(다른 공지·다른 기업 제외)");
ok(isReport(notices[0]) && !isReport(notices[2]), "경과 보고 가리기");

// 9) 고객 확인 — 이 보고의 가장 이른 notice_read, 다른 보고·다른 기록은 무시
const acts = [
  { type: "notice_read" as const, at: "2026-10-03T05:00:00Z", meta: { noticeId: "n2" } },
  { type: "notice_read" as const, at: "2026-10-02T05:00:00Z", meta: { noticeId: "n2" } },
  { type: "notice_read" as const, at: "2026-10-01T05:00:00Z", meta: { noticeId: "n1" } },
  { type: "result_downloaded" as const, at: "2026-10-01T01:00:00Z", meta: { noticeId: "n2" } },
];
ok(reportSeenAt(acts, "n2") === "2026-10-02T05:00:00Z", "고객 확인: 이 보고의 첫 기록");
ok(reportSeenAt(acts, "n4") === undefined, "고객 확인 전이면 없음");

console.log(fail ? `\n${fail} FAIL` : "\nALL OK");
process.exit(fail ? 1 : 0);

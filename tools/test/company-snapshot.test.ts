// 고객 화면 "우리 회사 한눈에" — 매출 추이 · 일차 · 고객에게 보이는 칸 · 성장 퀘스트. 시험용 값은 지어낸 것.
import { parseMoneyKo, clientFacts, companyQuests, dayNumber, fmtMoneyKo, fmtPct, questLevel, revenueTrend, yoyOf, finSeries } from "../../src/lib/company-snapshot";
import type { Company } from "../../src/lib/types";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const base: Company = { id: "co_t", code: "T", name: "시험(주)", ceo: "홍길동", industry: "제조", bizNo: "000-81-00000", contactName: "김담당", contactTitle: "과장", contactPhone: "010-0000-0000", contactEmail: "t@test.demo", address: "경기 화성시", employees: 12, revenue: "", firstConsultDate: "2026-09-01", consultantId: "u", memo: "내부 메모 — 고객에게 보이면 안 됨", ceoBirth: "1970-01-01", shareholders: "대표 100%", entityType: "corporation", corpNo: "000000-0000000", establishedAt: "2019-03-05" };

// 1) 재무
ok(revenueTrend(base).direction === "unknown" && revenueTrend(base).years === 0, "재무 없음 → 알 수 없음 (지어내지 않음)");
const fin = { ...base, financials: [{ year: 2025, revenue: 1_200_000_000 }, { year: 2023, revenue: 800_000_000 }, { year: 2024, revenue: 1_000_000_000 }] };
const t = revenueTrend(fin);
ok(t.latest?.year === 2025 && t.prev?.year === 2024 && t.yoyPct === 20 && t.direction === "up", `전년 대비 +20% (${t.yoyPct})`);
ok(finSeries(fin).map((f) => f.year).join(",") === "2023,2024,2025", "연도 오름차순 정렬");
ok(yoyOf(finSeries(fin), 1) === 25, "2024 대비 2023 +25%");
const gap = { ...base, financials: [{ year: 2022, revenue: 5e8 }, { year: 2025, revenue: 6e8 }] };
ok(revenueTrend(gap).yoyPct === undefined && revenueTrend(gap).direction === "unknown", "바로 전 해가 없으면 성장률을 만들지 않음");
const down = { ...base, financials: [{ year: 2024, revenue: 1e9 }, { year: 2025, revenue: 9e8 }] };
ok(revenueTrend(down).direction === "down" && revenueTrend(down).yoyPct === -10, "감소 -10%");
ok(fmtMoneyKo(42_000_000_000) === "420억 원" && fmtMoneyKo(320_000_000) === "3억 2,000만 원" && fmtMoneyKo(85_000_000) === "8,500만 원", "금액 표기 " + fmtMoneyKo(320_000_000));
ok(fmtPct(12.34) === "+12.3%" && fmtPct(-4) === "-4.0%", "퍼센트 표기");

// 2) 일차
ok(dayNumber("2026-10-01", "2026-10-01") === 1 && dayNumber("2026-09-02", "2026-10-01") === 30, "시작일 = 1일차");
ok(dayNumber("2026-10-05", "2026-10-01") === undefined && dayNumber(undefined) === undefined, "미래·없음은 표시 안 함");

// 3) 고객에게 보이는 칸
const facts = clientFacts(base, "2026-10-03");
const keys = facts.map((r) => r.key);
ok(!keys.includes("ceoBirth") && !keys.includes("shareholders") && !keys.includes("ceoGender") && !keys.includes("jointCert"), "생년월일·주주·성별·인증서 제외");
ok(!facts.some((r) => r.value.includes("내부 메모") || r.value.includes("1970")), "메모·생년월일 값이 어디에도 없음");
ok(facts.find((r) => r.key === "ceo")?.value === "홍길동", "대표자는 이름만");
ok(facts.find((r) => r.key === "establishedAt")?.value.includes("8년차") === true, "업력 표시 " + facts.find((r) => r.key === "establishedAt")?.value);
ok(facts.every((r) => r.edit === "none"), "고객 화면에서는 고칠 수 없음");

// 4) 퀘스트
const ctx = { docRequests: [], schedules: [], opportunities: [], activeCount: 0, completedCount: 0, programCount: 0, now: new Date("2026-10-03T00:00:00Z") };
const q0 = companyQuests({ company: base, ...ctx });
ok(q0.find((q) => q.key === "basics")?.done === true, "기본 정보 다 있음 → 완료");
ok(q0.find((q) => q.key === "growth")?.locked === true && !q0.find((q) => q.key === "growth")?.done, "매출 2개년 없으면 성장 퀘스트 잠김");
ok(q0.find((q) => q.key === "financials")?.progress === "0/3", "재무 0/3");
const q1 = companyQuests({ company: fin, ...ctx, docRequests: [{ id: "d1", companyId: "co_t", status: "requested" }, { id: "d2", companyId: "co_t", status: "done" }, { id: "d3", companyId: "co_t", status: "planned" }] as never });
ok(q1.find((q) => q.key === "growth")?.done === true && q1.find((q) => q.key === "growth")?.progress?.startsWith("+20.0%") === true, "성장 퀘스트 완료 +20%");
ok(q1.find((q) => q.key === "financials")?.done === true, "3개년 → 재무 완료");
ok(q1.find((q) => q.key === "requests")?.progress === "1/2" && !q1.find((q) => q.key === "requests")?.done, "요청 자료 1/2 (보내기 전 요청은 빼고)");
const noBasics = companyQuests({ company: { ...base, bizNo: "", establishedAt: undefined }, ...ctx });
ok(/사업자등록번호/.test(noBasics[0].why) && noBasics[0].progress === "4/6", "빈 칸 이름을 알려 줌 " + noBasics[0].progress);
const lv = questLevel(q1);
ok(lv.done >= 1 && lv.level >= 1 && lv.level <= 5 && lv.next !== undefined && !lv.next.done, `레벨 ${lv.level} ${lv.name} · ${lv.done}/${lv.total} · 다음 ${lv.next?.title}`);
ok(questLevel(q1.map((q) => ({ ...q, done: true }))).level === 5, "전부 완료 → 최고 레벨");

// 5) 금액 읽기
ok(parseMoneyKo("420억") === 42_000_000_000 && parseMoneyKo("12억 3,000만") === 1_230_000_000 && parseMoneyKo("8500만원") === 85_000_000, "억·만 읽기");
ok(parseMoneyKo("3억 2천만") === 320_000_000 && parseMoneyKo("1,234,567,890") === 1_234_567_890 && parseMoneyKo("-3억") === -300_000_000, "천만·쉼표·음수");
ok(parseMoneyKo("") === undefined && parseMoneyKo("모름") === undefined && parseMoneyKo("12억쯤") === undefined, "못 읽는 값은 비움(짐작하지 않음)");

if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");

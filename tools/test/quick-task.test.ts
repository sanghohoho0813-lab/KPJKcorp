// 업무 한 줄 등록 — 기업·유형 자동 인식, 기한 묶음. 시험용 기업명은 지어낸 것.
import { legalBaseName, dueBucket, dueFromQuick, guessCompany, guessTaskType, shortCompanyName } from "../../src/lib/quick-task";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const cos = [
  { id: "a", name: "에이정밀(주)" },
  { id: "a2", name: "주식회사 에이정밀테크" },
  { id: "b", name: "비앤테크(주)" },
  { id: "x", name: "㈜보관기업", archived: true },
  { id: "y", name: "가" },
];
ok(shortCompanyName("주식회사 에이정밀테크") === "에이정밀테크" && shortCompanyName("㈜ 비 앤") === "비앤" && shortCompanyName("가나 상사 (본사)") === "가나상사" && shortCompanyName("다라(유)") === "다라", "법인 표기·괄호·띄어쓰기 떼기");
ok(guessCompany("에이정밀 매출채권 재요청 전화", cos) === "a", "짧은 이름으로 찾기");
ok(guessCompany("에이정밀테크 미팅 준비", cos) === "a2", "겹치면 더 긴(구체적) 이름");
ok(guessCompany("비앤 테크 연구소 서류 검토", cos) === "b", "띄어 써도 찾기");
ok(guessCompany("보관기업 연락", cos) === undefined, "보관된 기업은 붙이지 않음");
ok(guessCompany("가나다 내부 회의", cos) === undefined, "한 글자 이름은 보지 않음 (엉뚱한 연결 방지)");
ok(guessCompany("", cos) === undefined && guessCompany("주간 보고서 정리", cos) === undefined, "못 찾으면 비움");
ok(guessTaskType("에이정밀 대표 전화") === "후속연락" && guessTaskType("인건비 내역 검토") === "자료검토" && guessTaskType("중간 보고 미팅 준비") === "미팅준비", "유형: 연락·검토·미팅");
ok(guessTaskType("결과보고서 초안") === "보고서" && guessTaskType("고객 문의 답변") === "문의응대" && guessTaskType("사무실 정리") === "기타", "유형: 보고서·문의·기타");
const now = new Date(2026, 9, 6, 9, 30);
const d = (n: number, h = 18) => new Date(2026, 9, 6 + n, h).toISOString();
ok(new Date(dueFromQuick("today", now)).getHours() === 18 && new Date(dueFromQuick("tomorrow", now)).getDate() === 7 && new Date(dueFromQuick("week", now)).getDate() === 13, "빠른 기한 → 그날 18:00");
ok(dueBucket(d(-1), now) === "overdue" && dueBucket(d(0, 8), now) === "today" && dueBucket(d(1), now) === "tomorrow" && dueBucket(d(7), now) === "week" && dueBucket(d(8), now) === "later", "기한 묶음 (날짜 기준)");
ok(guessTaskType("에이정밀 대표님께 결과보고 일정 전화") === "후속연락" && guessTaskType("결과보고 미팅 준비") === "미팅준비" && guessTaskType("결과보고서 검토") === "자료검토", "행동 낱말 우선 (전화·미팅·검토 > 보고)");
ok(legalBaseName("주식회사 에이정밀") === legalBaseName("에이정밀(주)") && legalBaseName("에이정밀(본사)") !== legalBaseName("에이정밀(지점)"), "중복 검사: 법인 표기만 무시, 구분 괄호는 유지");
if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");

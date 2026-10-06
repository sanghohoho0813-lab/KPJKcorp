// 고객 연락 공백 — 마지막 연락을 이미 있는 기록에서 찾는지. 시험용 값은 지어낸 것.
import { contactStatus, daysSince, lastContact } from "../../src/lib/contact";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const now = new Date(2026, 9, 6, 10, 0);
const at = (dd: number, h = 10) => new Date(2026, 9, 6 + dd, h).toISOString();
const co = { id: "a", firstConsultDate: "2026-08-01" };
const empty = { consultations: [], inquiries: [], schedules: [], tasks: [], journal: [] };
ok(lastContact(co, empty, now)?.how === "최초 상담", "기록이 없으면 최초 상담일");
ok(lastContact({ id: "a", firstConsultDate: "" }, empty, now) === undefined, "최초 상담일도 없으면 알 수 없음 (지어내지 않음)");
const src = {
  consultations: [{ companyId: "a", date: at(-30) }, { companyId: "b", date: at(-1) }],
  inquiries: [{ companyId: "a", messages: [{ id: "m1", authorId: "c", authorRole: "client" as const, body: "", createdAt: at(-2) }, { id: "m2", authorId: "u", authorRole: "consultant" as const, body: "", createdAt: at(-20) }] }],
  schedules: [{ companyId: "a", type: "meeting" as const, start: at(-15) }, { companyId: "a", type: "meeting" as const, start: at(3) }, { companyId: "a", type: "internal_due" as const, start: at(-1) }],
  tasks: [{ companyId: "a", type: "후속연락" as const, status: "done" as const, completedAt: at(-12) }, { companyId: "a", type: "자료검토" as const, status: "done" as const, completedAt: at(-1) }],
  journal: [{ companyId: "a", type: "note" as const, entryDate: "2026-10-05", createdAt: at(-1) }],
};
const l = lastContact(co, src, now);
ok(l?.how === "후속 연락" && daysSince(l.at, now) === 12, `가장 최근 연락 = 끝낸 후속연락 12일 전 (${l?.how})`);
ok(true, "고객이 보낸 문의 · 앞으로의 미팅 · 내부 마감 · 자료검토 · 메모는 연락이 아님 (위 결과로 확인)");
const withCall = { ...src, journal: [{ companyId: "a", type: "call" as const, entryDate: "2026-10-04", createdAt: at(0, 9) }] };
const l2 = lastContact(co, withCall, now);
ok(l2?.how === "통화 기록" && daysSince(l2.at, now) === 2, "지난날을 적은 통화 기록은 그날로");
const today = { ...src, journal: [{ companyId: "a", type: "call" as const, entryDate: "2026-10-06", createdAt: new Date(2026, 9, 6, 1, 30).toISOString() }] };
ok(daysSince(lastContact(co, today, now)!.at, now) === 0, "새벽에 적은 오늘 통화도 오늘 (시간대 경계)");
const s21 = contactStatus(co, src, 21, now);
ok(!s21.due && s21.days === 12 && s21.left === 9, "기준 21일: 12일 → 다음 연락까지 9일");
const s7p = contactStatus(co, src, 7, now);
ok(!s7p.due && !!s7p.planned, "기준 7일: 12일이지만 3일 뒤 미팅이 잡혀 있음 → 연락 예정");
const noFuture = { ...src, schedules: src.schedules.filter((x) => x.start < now.toISOString()) };
const s7 = contactStatus(co, noFuture, 7, now);
ok(s7.due && s7.left === -5, "기준 7일: 12일 · 잡힌 미팅 없음 → 연락 필요");
const planned = { ...src, schedules: [...src.schedules, { companyId: "a", type: "report" as const, start: at(5) }] };
const sp = contactStatus(co, planned, 7, now);
ok(!sp.due && !!sp.planned, "공백이어도 7일 안에 고객 미팅이 잡혀 있으면 연락 필요 아님");
const far = { ...src, schedules: [{ companyId: "a", type: "meeting" as const, start: at(20) }] };
ok(contactStatus(co, far, 7, now).due, "미팅이 7일보다 멀면 연락 필요");
if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");

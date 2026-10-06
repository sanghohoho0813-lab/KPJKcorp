// 상담 기록 → 후속 업무 · 자료 요청 — 무엇을 만들지, 이미 만든 것은 다시 안 만드는지. 시험용 값은 지어낸 것.
import { defaultPicked, followItems, followKey, isConsultTask, textHash } from "../../src/lib/consult-followups";
let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const sum = { nextAction: "제안서 송부 후 전화", promises: ["다음 주 화요일까지 절세 시뮬레이션 전달", "  ", "다음 주 화요일까지 절세 시뮬레이션 전달"], documents: ["최근 3년 재무제표", "주주명부"] };
const ctx = { tasks: [], docRequests: [], companyId: "co_a" };
const a = followItems(sum, undefined, ctx);
ok(a.length === 4, `빈 줄 · 같은 줄은 한 번만 → 4개 (${a.length})`);
ok(a[0].kind === "next" && a[0].type === "후속연락" && a[1].kind === "promise" && a[2].kind === "doc", "순서: 다음 Action → 약속 → 자료, 유형 자동");
ok(a.filter(defaultPicked).map((x) => x.kind).join(",") === "next,promise", "기본: 업무만 켜고 고객에게 가는 자료 요청은 끔");
ok(followItems({ nextAction: "", promises: [], documents: [] }, undefined, ctx).length === 0, "적은 것이 없으면 만들 것도 없음");
ok(textHash("주주 명부") === textHash("주주명부") && textHash("주주명부") !== textHash("주주명부 사본"), "글자 지문: 띄어쓰기만 무시");
// 이미 만든 것
const madeKey = followKey("cs_1", "next", "제안서 송부 후 전화");
const b = followItems(sum, "cs_1", { tasks: [{ ruleKey: madeKey }], docRequests: [{ companyId: "co_a", name: "최근 3년 재무제표", status: "requested" }, { companyId: "co_a", name: "주주명부", status: "done" }, { companyId: "co_b", name: "주주명부", status: "requested" }], companyId: "co_a" });
ok(b[0].done && !b[1].done, "같은 상담 · 같은 다음 Action 업무는 이미 등록됨");
ok(b[2].done && !b[3].done, "같은 이름 자료 요청이 이 기업에 열려 있으면 이미 요청 중 (완료 · 다른 기업은 제외)");
ok(!defaultPicked(b[0]) && !defaultPicked(b[2]), "이미 만든 것은 체크되지 않음");
ok(followItems(sum, "cs_2", { tasks: [{ ruleKey: madeKey }], docRequests: [], companyId: "co_a" })[0].done === false, "다른 상담의 같은 문장은 별개");
ok(isConsultTask({ ruleKey: madeKey }) && !isConsultTask({ ruleKey: "contract_renewal:x" }) && !isConsultTask({}), "상담 후속 업무 구분");
if (fail) { console.log(`\n실패 ${fail}`); process.exit(1); } else console.log("\n전부 통과");

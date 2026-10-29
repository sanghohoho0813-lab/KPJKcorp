/**
 * 기술시험 TEST 05 — 내부 11단계 → 고객 4단계 변환(src/lib/stages.ts)을 단계마다 확인한다.
 * 실행: npx tsx tools/appeal-test/stage-map.test.ts   (하나라도 다르면 종료 코드 1)
 */
import { INTERNAL_STAGES, CUSTOMER_STEPS, stageToCustomerStep, stageProgress, customerStageMessage } from "../../src/lib/stages";

// 기대값 — 고객은 계약을 마친 업체라 문의 · 상담 · 계약은 '자료 요청'으로 접는다
const EXPECT: Record<string, string> = {
  inquiry: "자료 요청", consult: "자료 요청", contract: "자료 요청", doc_request: "자료 요청",
  doc_received: "자료 검토 중", review: "자료 검토 중",
  in_progress: "진행 중", drafting: "진행 중", ceo_meeting: "진행 중",
  done: "완료", aftercare: "완료",
};
let fail = 0;
console.log(`내부 단계 ${INTERNAL_STAGES.length}개 → 고객 단계 ${CUSTOMER_STEPS.length}개`);
for (const s of INTERNAL_STAGES) {
  const step = CUSTOMER_STEPS[stageToCustomerStep(s.key)];
  const ok = step?.label === EXPECT[s.key];
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${s.label.padEnd(5, "　")} (${s.key}) → ${step?.label ?? "없음"} · 진행률 ${stageProgress(s.key)}% · 고객 문구 "${customerStageMessage(s.key)}"`);
}
const used = new Set(INTERNAL_STAGES.map((s) => stageToCustomerStep(s.key)));
const all = used.size === CUSTOMER_STEPS.length;
if (!all) fail++;
console.log(`${all ? "OK  " : "FAIL"} 고객 4단계가 모두 쓰인다 (${[...used].sort().map((i) => CUSTOMER_STEPS[i].label).join(" · ")})`);
const mono = INTERNAL_STAGES.every((s, i, a) => i === 0 || stageToCustomerStep(s.key) >= stageToCustomerStep(a[i - 1].key));
if (!mono) fail++;
console.log(`${mono ? "OK  " : "FAIL"} 내부 단계가 앞으로 가면 고객 단계도 뒤로 가지 않는다`);
console.log(fail ? `실패 ${fail}` : "전부 통과");
process.exit(fail ? 1 : 0);

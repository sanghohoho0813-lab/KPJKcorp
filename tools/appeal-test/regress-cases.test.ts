/**
 * 기술시험 — 과거에 실제로 발견해 고친 결함이 지금 코드에서 다시 생기지 않는지 확인한다.
 *   사례 2 (2026-10-03, b234fe2) 프로젝트 없이 기업에 건 자료 요청에 제출하면 활동 기록이 project_id = '' 로 가서 서버가 거절
 *   사례 3 (2026-10-03, c694cc3) Supabase 는 한 번에 1000줄까지만 준다 — 그냥 읽으면 1000줄을 넘는 표가 말없이 잘림
 * 실행: npx tsx tools/appeal-test/regress-cases.test.ts   (하나라도 다르면 종료 코드 1)
 */
import { activityToRow, docRequestToRow, taskToRow, scheduleToRow, notificationToRow } from "../../src/lib/server/rows";
import { readPaged } from "../../src/lib/server/sync";
import type { Activity } from "../../src/lib/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "OK  " : "FAIL"} ${m}`); if (!c) fail++; };

// ---- 사례 2: 빈 번호('')는 서버로 보낼 때 null — 빈 글자를 보내면 없는 프로젝트를 가리켜 외래키 위반으로 묶음 전체가 거절됐다
const act = activityToRow({ id: "ac_t", type: "document_uploaded", companyId: "co_a", projectId: "", actorId: "", actorRole: "client", at: "2026-10-29T00:00:00Z", message: "제출" } as Activity);
ok(act.project_id === null, `활동 기록: projectId '' → project_id ${JSON.stringify(act.project_id)}`);
ok(docRequestToRow({ id: "dr_t", projectId: "", companyId: "co_a" }).project_id === null, "자료 요청: projectId '' → null");
ok(taskToRow({ id: "tk_t", projectId: "", companyId: "co_a" }).project_id === null, "업무: projectId '' → null");
ok(scheduleToRow({ id: "sc_t", projectId: "", companyId: "co_a" }).project_id === null, "일정: projectId '' → null");
ok(notificationToRow({ id: "nt_t", companyId: "" }).company_id === null, "알림: companyId '' → null");
ok(activityToRow({ id: "ac_u", type: "x", companyId: "co_a", projectId: "pj_a1", actorRole: "client", at: "2026-10-29T00:00:00Z", message: "m" } as Activity).project_id === "pj_a1", "값이 있으면 그대로(pj_a1)");

// ---- 사례 3: PostgREST 처럼 한 번에 최대 1000줄만 주는 가짜 서버로 2,500줄 · 1,429줄 표를 읽는다
const MAX_ROWS = 1000;
function fakeTable(n: number, shiftAfterFirstPage = 0) {
  let rows = Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(5, "0")}` }));
  let calls = 0;
  const make = () => ({
    range: async (from: number, to: number) => {
      calls++;
      const page = rows.slice(from, Math.min(to + 1, from + MAX_ROWS));
      // 첫 쪽을 읽은 사이 새 줄이 앞에 들어오면 다음 쪽이 한 칸씩 밀린다(겹침)
      if (calls === 1 && shiftAfterFirstPage) rows = [...Array.from({ length: shiftAfterFirstPage }, (_, i) => ({ id: `new${i}` })), ...rows];
      return { data: page, error: null };
    },
  });
  return { make, oneShot: () => rows.slice(0, MAX_ROWS), calls: () => calls };
}
async function paged() {
  for (const n of [2500, 1429, 1000, 999]) {
    const t = fakeTable(n);
    const before = t.oneShot().length;               // 고치기 전처럼 한 번에 읽으면
    const r = await readPaged(t.make);
    ok(r.data!.length === n, `${n.toLocaleString()}줄 표 — 한 번에 읽기 ${before.toLocaleString()}줄 → 이어 읽기 ${r.data!.length.toLocaleString()}줄 (요청 ${t.calls()}번)`);
  }
  const s = fakeTable(2500, 3);
  const rs = await readPaged(s.make);
  ok(new Set(rs.data!.map((x) => x.id)).size === rs.data!.length && rs.data!.length === 2500, `읽는 사이 새 줄 3개가 앞에 들어와도 겹침 없이 ${rs.data!.length.toLocaleString()}줄`);
}
paged().then(() => {
  console.log(fail ? `실패 ${fail}` : "전부 통과");
  process.exit(fail ? 1 : 0);
});

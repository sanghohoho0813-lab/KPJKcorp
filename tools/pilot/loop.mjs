// Closed Loop (실제 고객 계정): 고객 제출 → 자동 검토업무 → 컨설턴트 검토 → Portal 반영 → 알림 → Evidence
// 사용: node loop.mjs pc|mobile
import { launch, ctxFor, login, logout, B, ACC, L, ok, sql, body, toasts, summary, FILES } from './lib.mjs';
const kind = process.argv[2] || 'pc';
const CLIENT = kind === 'pc' ? ACC.c1 : ACC.c2;
const REQ = kind === 'pc' ? '파일럿 제출자료 A-1' : '파일럿 제출자료 B-1';
const OTHER = kind === 'pc' ? '파일럿 제출자료 B-1' : '파일럿 제출자료 A-1';
const FILE = kind === 'pc' ? FILES + 'pilot-a1.txt' : FILES + 'pilot-b1.txt';
const T = `[${kind}]`;
const b = await launch();
const { p: con } = await ctxFor(b, kind);   // 컨설턴트 브라우저
const { p: cli } = await ctxFor(b, kind);   // 고객 브라우저 (완전히 별도 세션)

const reqId = sql(`select id from document_requests where name='${REQ}'`);
const coId = sql(`select company_id from document_requests where id='${reqId}'`);
const pjId = sql(`select project_id from document_requests where id='${reqId}'`);
L(`${T} 대상`, `${reqId} / ${coId} / ${pjId} / 현재 ${sql(`select status from document_requests where id='${reqId}'`)}`);
const t0 = sql(`select now()`);

// 1) 컨설턴트 로그인 (먼저 화면을 띄워 둔다 — 새로고침 없이 도착하는지 본다)
await login(con, ACC.con, /\/ax\//);
await con.goto(B + '/ax/documents', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(1500);

// 2) 고객 실제 로그인 → Portal
await login(cli, CLIENT, /\/portal/);
ok(`${T} 고객 로그인 → /portal`, /\/portal/.test(cli.url()), cli.url());
await cli.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500);
let t = await body(cli);
ok(`${T} Portal에 내 요청 노출`, t.includes(REQ));
ok(`${T} 다른 기업 요청 안 보임(격리)`, !t.includes(OTHER));
ok(`${T} Portal DEMO DATA 없음`, !/DEMO DATA/.test(t));

// 3) 제출 (실제 파일)
const row = cli.locator('li,tr,div').filter({ hasText: REQ }).filter({ has: cli.getByRole('button', { name: /업로드|재제출/ }) }).last();
await row.getByRole('button', { name: /업로드|재제출/ }).first().click(); await cli.waitForTimeout(700);
await cli.locator('[role=dialog] input[type=file]:not([capture])').setInputFiles(FILE);
await cli.waitForTimeout(300);
await cli.getByRole('button', { name: '제출하기' }).click();
await cli.waitForTimeout(3500);
L(`${T} 고객 화면 안내`, (await toasts(cli)) || '(없음)');

// 서버 확인
ok(`${T} 서버: 요청 상태 submitted`, sql(`select status from document_requests where id='${reqId}'`) === 'submitted');
const fileRow = sql(`select file_name||'|'||coalesce(storage_path,'') from document_files where request_id='${reqId}' order by uploaded_at desc limit 1`);
ok(`${T} 서버: 제출 파일 기록`, !!fileRow, fileRow);
const objPath = fileRow.split('|')[1];
ok(`${T} 서버: 보관함에 실제 파일`, objPath && sql(`select count(*) from storage.objects where bucket_id='documents' and name='${objPath}'`) === '1');
const task = sql(`select id||'|'||status||'|'||coalesce(assignee_id::text,'-') from tasks where source='auto' and title like '%${REQ} 검토%' order by created_at desc limit 1`);
ok(`${T} 서버: 자동 검토업무 생성`, !!task, task);
ok(`${T} 서버: 고객 접수 알림`, sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and title='자료가 접수되었습니다' and at>='${t0}'`) === '1');
ok(`${T} 서버: 담당자 알림`, sql(`select count(*) from notifications where audience='internal' and company_id='${coId}' and body like '%${REQ}%' and at>='${t0}'`) === '1');
ok(`${T} 서버: 기록 document_uploaded (고객 본인)`, sql(`select count(*) from activities a join profiles p on p.id=a.actor_id where a.type='document_uploaded' and p.email='${CLIENT.id}' and a.at>='${t0}'`) === '1');
ok(`${T} 서버: 기록 task_created (system)`, sql(`select count(*) from activities where type='task_created' and actor_role='system' and company_id='${coId}' and at>='${t0}'`) === '1');
ok(`${T} 서버: 단계 자동 변경 → 자료접수`, sql(`select stage from projects where id='${pjId}'`) === 'doc_received');
ok(`${T} 서버: 기록 portal_login`, Number(sql(`select count(*) from activities a join profiles p on p.id=a.actor_id where a.type='portal_login' and p.email='${CLIENT.id}' and a.at>='${t0}'`)) >= 1);
L(`${T} 고객 화면 오류`, cli.errs.filter((e) => !/ERR_CERT|favicon/.test(e)).join(' || ') || 'OK 0');

// 4) 컨설턴트 화면 — 새로고침 없이 도착하는가 (자동 갱신 ≤ 20초)
const st = (pg, n) => pg.evaluate((n) => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); const s = JSON.parse(localStorage.getItem(k)).state; return { status: s.docRequests.find((d) => d.name === n)?.status, task: s.tasks.some((t) => t.title.includes(n + ' 검토') && t.status !== 'done') }; }, n);
let cs = {}; const w0 = Date.now();
for (let i = 0; i < 30; i++) { await con.waitForTimeout(1000); cs = await st(con, REQ); if (cs.status === 'submitted' && cs.task) break; }
ok(`${T} 컨설턴트 화면에 새로고침 없이 도착(자료+검토업무)`, cs.status === 'submitted' && cs.task, `${Math.round((Date.now() - w0) / 1000)}초`);
ok(`${T} 컨설턴트 자료관리 화면에 '제출' 표시`, (await body(con)).includes(REQ));
await con.goto(B + '/ax/tasks', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2500);
await con.locator('button:visible, [role=tab]:visible').filter({ hasText: /^미완료$/ }).first().click().catch(() => {});
await con.waitForTimeout(800);
ok(`${T} 컨설턴트 업무함(미완료)에 자동 검토업무`, (await body(con)).includes(`${REQ} 검토`));

// 5) 검토 → 보완 요청 → 고객 재제출 → 검토 완료 (실제 현장 흐름 그대로)
async function openReview() {
  await con.goto(B + '/ax/documents', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(1800);
  const it = con.locator(`:text-is("${REQ}"):visible`).first();
  await it.click(); await con.waitForTimeout(900);
}
await openReview();
const [dl] = await Promise.all([
  con.waitForEvent('download', { timeout: 10000 }).catch(() => null),
  con.locator('[role=dialog]').getByRole('button', { name: '열기' }).first().click().catch(() => null),
]);
ok(`${T} 컨설턴트: 제출 파일 내려받기`, !!dl, dl ? dl.suggestedFilename() : '');
await con.locator('[role=dialog] textarea').first().fill('파일럿 검증: 보완 요청 흐름 확인');
await con.getByRole('button', { name: '보완 요청' }).click(); await con.waitForTimeout(3000);
ok(`${T} 서버: 보완 요청 상태`, sql(`select status from document_requests where id='${reqId}'`) === 'revision');
ok(`${T} 서버: 고객 보완 알림`, sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and title like '보완 요청:%' and at>='${t0}'`) === '1');

// 고객 화면에 새로고침 없이 보완 요청이 보이는가
let seen = false;
for (let i = 0; i < 25 && !seen; i++) { await cli.waitForTimeout(1000); seen = (await cli.evaluate((n) => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); const s = JSON.parse(localStorage.getItem(k)).state; return s.docRequests.find((d) => d.name === n)?.status; }, REQ)) === 'revision'; }
ok(`${T} 고객 Portal에 보완 요청 반영(자동 갱신)`, seen);
await cli.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500);
ok(`${T} 고객 Portal 보완 사유 표시`, (await body(cli)).includes('보완'));
const row2 = cli.locator('li,tr,div').filter({ hasText: REQ }).filter({ has: cli.getByRole('button', { name: /재제출/ }) }).last();
await row2.getByRole('button', { name: /재제출/ }).first().click(); await cli.waitForTimeout(700);
await cli.locator('[role=dialog] input[type=file]:not([capture])').setInputFiles(FILE);
await cli.getByRole('button', { name: '제출하기' }).click(); await cli.waitForTimeout(3500);
ok(`${T} 서버: 재제출 v2`, sql(`select count(*) from document_files where request_id='${reqId}'`) === '2' && sql(`select status from document_requests where id='${reqId}'`) === 'submitted');

// 컨설턴트 자동 갱신 대기 후 검토 완료
for (let i = 0; i < 25; i++) { await con.waitForTimeout(1000); if ((await con.evaluate((n) => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); const s = JSON.parse(localStorage.getItem(k)).state; return s.docRequests.find((d) => d.name === n)?.files.length; }, REQ)) === 2) break; }
await openReview();
await con.getByRole('button', { name: '검토 완료' }).click(); await con.waitForTimeout(3000);
L(`${T} 컨설턴트 안내`, (await toasts(con)) || '(없음)');
ok(`${T} 서버: 검토 완료 상태`, sql(`select status from document_requests where id='${reqId}'`) === 'done');
ok(`${T} 서버: 검토업무 자동 완료`, sql(`select count(*) from tasks where source='auto' and title like '%${REQ} 검토%' and status<>'done'`) === '0');
ok(`${T} 서버: 고객 완료 알림`, sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and title='자료 확인이 완료되었습니다' and at>='${t0}'`) === '1');
ok(`${T} 서버: 기록 document_reviewed (컨설턴트 본인)`, sql(`select count(*) from activities a join profiles p on p.id=a.actor_id where a.type='document_reviewed' and p.email='${ACC.con.id}' and a.at>='${t0}'`) === '1');
ok(`${T} 서버: 기록 보완요청`, sql(`select count(*) from activities where type='document_revision_requested' and company_id='${coId}' and at>='${t0}'`) === '1');
L(`${T} 컨설턴트 화면 오류`, con.errs.filter((e) => !/ERR_CERT|favicon/.test(e)).join(' || ') || 'OK 0');

// 6) 고객 Portal — 상태 반영 + 알림 (자동 갱신)
let done = false;
for (let i = 0; i < 25 && !done; i++) { await cli.waitForTimeout(1000); done = (await cli.evaluate((n) => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); const s = JSON.parse(localStorage.getItem(k)).state; return s.docRequests.find((d) => d.name === n)?.status; }, REQ)) === 'done'; }
ok(`${T} 고객 Portal 완료 반영(자동 갱신)`, done);
await cli.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500);
const cst = await cli.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); return JSON.parse(localStorage.getItem(k)).state; });
ok(`${T} 고객 알림 목록: 접수·보완·완료`, ['자료가 접수되었습니다', '자료 확인이 완료되었습니다'].every((x) => cst.notifications.some((n) => n.title === x)) && cst.notifications.some((n) => n.title.startsWith('보완 요청')));
ok(`${T} 고객에게 내부 업무·내부 알림 안 보임`, cst.tasks.length === 0 && !cst.notifications.some((n) => n.audience === 'internal'));
ok(`${T} 고객 화면: 진행 단계 반영`, (await (async () => { await cli.goto(B + '/portal/projects', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500); return body(cli); })()).includes('Pilot 벤처확인 준비'));

// 7) Evidence — 대표 화면
const { p: ceo } = await ctxFor(b, kind);
await login(ceo, ACC.ceo, /\/ax\//);
await ceo.goto(B + '/ax/reports', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
const est = await ceo.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); return JSON.parse(localStorage.getItem(k)).state; });
const types = new Set(est.activities.filter((a) => a.companyId === coId).map((a) => a.type));
ok(`${T} 대표 Evidence: 제출·자동업무·보완·검토 기록`, ['document_uploaded', 'task_created', 'document_revision_requested', 'document_reviewed', 'project_stage_changed'].every((x) => types.has(x)), [...types].join(','));
ok(`${T} 대표 화면 DEMO DATA 없음`, !/DEMO DATA/.test(await body(ceo)));
L(`${T} 대표 화면 오류`, ceo.errs.filter((e) => !/ERR_CERT|favicon/.test(e)).join(' || ') || 'OK 0');
await b.close();
process.exit(summary() ? 1 : 0);

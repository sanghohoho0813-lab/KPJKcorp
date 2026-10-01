// 지속성 + 보조 Loop: 새로고침·로그아웃·재로그인·다른 브라우저 / 문의·답변·상담요청 / 격리
import { launch, ctxFor, login, logout, B, ACC, CO1, L, ok, sql, body, toasts, summary, state } from './lib.mjs';
const b = await launch();
const TAG = 'P' + Date.now().toString().slice(-5);
// --- 고객1: 문의 (PC)
const { p: c1 } = await ctxFor(b, 'pc');
await login(c1, ACC.c1, /\/portal/);
await c1.goto(B + '/portal/inquiries', { waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(1500);
await c1.getByRole('button', { name: '새 문의' }).first().click(); await c1.waitForTimeout(600);
await c1.getByLabel('제목').fill(`파일럿 문의 ${TAG}`);
await c1.getByLabel('내용').fill('파일럿 검증용 문의입니다.');
await c1.getByRole('button', { name: '문의 보내기' }).click(); await c1.waitForTimeout(3000);
ok('문의: 서버 저장', sql(`select status from inquiries where title='파일럿 문의 ${TAG}'`) === 'open');
ok('문의: 첫 메시지 저장', sql(`select count(*) from inquiry_messages m join inquiries i on i.id=m.inquiry_id where i.title='파일럿 문의 ${TAG}'`) === '1');
ok('문의: 자동 답변업무(서버)', sql(`select count(*) from tasks where source='auto' and title like '%문의 답변: 파일럿 문의 ${TAG}' and assignee_id is not null`) === '1');
ok('문의: 담당자 알림', sql(`select count(*) from notifications where audience='internal' and body='파일럿 문의 ${TAG}'`) === '1');
ok('문의: 기록 inquiry_created', sql(`select count(*) from activities where type='inquiry_created' and message like '%${TAG}%'`) === '1');
L('고객1 오류', c1.errs.filter((e) => !/ERR_CERT/.test(e)).join(' || ') || 'OK 0');

// --- 고객1: 상담 요청 (Portal 서비스)
await c1.goto(B + '/portal/services', { waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(1500);
// KPJK 컨설팅 분야 칩 → 내용 확인 → 상담 요청
const chip = c1.locator('#portal-kpjk-areas').getByRole('button', { name: /^재무세무/ });
ok('상담요청: KPJK 분야 칩 노출', (await chip.count()) === 1);
await chip.click(); await c1.waitForTimeout(600);
await c1.locator('[role=dialog]:visible').last().getByRole('button', { name: '상담 요청' }).click(); await c1.waitForTimeout(600);
await c1.locator('[role=dialog]:visible textarea').last().fill(`파일럿 상담요청 ${TAG}`);
await c1.locator('[role=dialog]:visible').last().getByRole('button', { name: '상담 요청' }).click(); await c1.waitForTimeout(3000);
ok('상담요청: 서버 저장', sql(`select count(*) from opportunities where note='파일럿 상담요청 ${TAG}' and source='portal_request'`) === '1');
ok('상담요청: 상담 연락 업무(서버)', sql(`select count(*) from tasks where source='auto' and memo='파일럿 상담요청 ${TAG}'`) === '1');
ok('상담요청: 고객 접수 알림(서버)', Number(sql(`select count(*) from notifications where audience='client' and title='요청이 접수되었습니다'`)) >= 1);
L('고객1 오류(2)', c1.errs.filter((e) => !/ERR_CERT/.test(e)).join(' || ') || 'OK 0');

// --- 컨설턴트(모바일): 답변
const { p: con } = await ctxFor(b, 'mobile');
await login(con, ACC.con, /\/ax\//);
await con.goto(B + '/ax/inquiries', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2000);
await con.locator(`:text("파일럿 문의 ${TAG}"):visible`).first().click(); await con.waitForTimeout(800);
await con.getByPlaceholder(/고객에게 전달할 답변/).fill('파일럿 답변입니다.');
await con.getByRole('button', { name: '답변 등록' }).click(); await con.waitForTimeout(3000);
ok('답변: 서버 상태 answered', sql(`select status from inquiries where title='파일럿 문의 ${TAG}'`) === 'answered');
ok('답변: 메시지 2건', sql(`select count(*) from inquiry_messages m join inquiries i on i.id=m.inquiry_id where i.title='파일럿 문의 ${TAG}'`) === '2');
ok('답변: 답변업무 자동 완료', sql(`select status from tasks where title like '%문의 답변: 파일럿 문의 ${TAG}'`) === 'done');
ok('답변: 고객 알림', Number(sql(`select count(*) from notifications where audience='client' and title='문의 답변이 등록되었습니다'`)) >= 1);
L('컨설턴트 오류', con.errs.filter((e) => !/ERR_CERT/.test(e)).join(' || ') || 'OK 0');

// --- 고객1: 추가 문의 → 서버가 다시 open 으로
let seen = false;
for (let i = 0; i < 25 && !seen; i++) { await c1.waitForTimeout(1000); seen = ((await state(c1)).inquiries.find((x) => x.title === `파일럿 문의 ${TAG}`)?.status) === 'answered'; }
ok('고객 Portal 답변 반영(자동 갱신)', seen);
await c1.goto(B + '/portal/inquiries', { waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(1500);
await c1.locator(`:text("파일럿 문의 ${TAG}"):visible`).first().click(); await c1.waitForTimeout(800);
ok('고객 Portal 답변 내용 표시', (await body(c1)).includes('파일럿 답변입니다.'));
await c1.getByPlaceholder('추가로 궁금한 점을 남겨주세요.').fill('추가 질문입니다.');
await c1.getByRole('button', { name: '보내기', exact: true }).click(); await c1.waitForTimeout(3000);
ok('추가 문의: 서버가 다시 답변 대기(open)', sql(`select status from inquiries where title='파일럿 문의 ${TAG}'`) === 'open');
L('고객1 오류(3)', c1.errs.filter((e) => !/ERR_CERT/.test(e)).join(' || ') || 'OK 0');

// --- 지속성: 새로고침 / 로그아웃 / 재로그인 / 다른 브라우저
await c1.reload({ waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(2500);
ok('새로고침 후 로그인 유지(고객)', /\/portal/.test(c1.url()) && (await body(c1)).includes(`파일럿 문의 ${TAG}`));
await logout(c1);
ok('로그아웃 → 로그인 화면', /\/login/.test(c1.url()));
const left = await state(c1);
ok('로그아웃 후 이 브라우저에 고객 데이터 안 남음', left && left.companies.length === 0 && left.inquiries.length === 0 && !left.session);
await c1.goto(B + '/portal', { waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(2000);
ok('로그아웃 후 /portal 직접 접근 → 로그인으로', /\/login/.test(c1.url()));
await login(c1, ACC.c1, /\/portal/);
await c1.goto(B + '/portal/inquiries', { waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(1500);
ok('재로그인 후 서버 데이터 그대로', (await body(c1)).includes(`파일럿 문의 ${TAG}`));
const { p: other } = await ctxFor(b, 'mobile');
await login(other, ACC.c1, /\/portal/);
await other.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await other.waitForTimeout(1500);
ok('다른 브라우저(모바일)에서 같은 서버 데이터', (await body(other)).includes('파일럿 제출자료 A-1'));
ok('다른 브라우저: 다른 기업 자료 안 보임', !(await body(other)).includes('파일럿 제출자료 B-1'));

// 고객 → 내부 화면 직접 접근 차단
await other.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await other.waitForTimeout(2500);
ok('고객 계정 /ax 접근 → 차단', !/\/ax\//.test(other.url()), other.url());

// 서버에서 직접 바꾼 값이 새로고침으로 보이는가 (브라우저 캐시를 믿지 않는지)
sql(`update inquiries set title='파일럿 문의 ${TAG} (서버수정)' where title='파일럿 문의 ${TAG}'`);
await c1.reload({ waitUntil: 'domcontentloaded' }); await c1.waitForTimeout(3000);
ok('새로고침 시 서버 최신값으로 갱신(캐시 아님)', (await body(c1)).includes(`파일럿 문의 ${TAG} (서버수정)`));

// 대표: 새 브라우저 + 계정 중지 → 즉시 차단
const { p: ceo } = await ctxFor(b, 'pc');
await login(ceo, ACC.ceo, /\/ax\//);
ok('대표 새 브라우저에서도 같은 데이터', (await state(ceo)).inquiries.some((x) => x.title.includes(TAG)));
L('대표 오류', ceo.errs.filter((e) => !/ERR_CERT/.test(e)).join(' || ') || 'OK 0');
await b.close();
process.exit(summary() ? 1 : 0);

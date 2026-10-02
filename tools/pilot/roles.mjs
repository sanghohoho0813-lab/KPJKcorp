// 역할·권한 분리 · 대표 보기 전환 · 고객 대신 접수 · 요청 취소(고객/공고 알림/자료 요청) — 실서버
// setup.mjs 다음에 돌린다(대표·컨설턴트·고객 2 · 기업 A/B 가 있는 상태). 값은 시험용(비식별).
import { launch, ctxFor, login, logout, B, ACC, CO1, ok, sql, body, summary } from './lib.mjs';

const STAFF = { id: 'staff@pilot.test', pw: 'PilotStaff!2026', name: '파일럿 사무직원' };
const TAG = Date.now().toString(36).slice(-4);
const coId = sql(`select id from companies where name='${CO1}'`);
const dlg = (p) => p.locator('[role=dialog]:visible').last();
const state = (p) => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); return JSON.parse(localStorage.getItem(k)).state; });

// 회사 매출 정보(시험용 값) — 계약·수금
sql(`insert into contracts(id, company_id, title, status, amount) values ('ct_${TAG}','${coId}','시험 계약 ${TAG}','signed', 12340000) on conflict do nothing`);
sql(`insert into payments(id, company_id, kind, label, amount, due_date) values ('pm_${TAG}','${coId}','deposit','시험 계약금 ${TAG}', 1234000, current_date + 10) on conflict do nothing`);

const b = await launch();
const { p } = await ctxFor(b, 'pc');
await login(p, ACC.ceo, /\/ax\//);

// 1 사무직원 계정 만들기
await p.goto(B + '/ax/settings', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
await p.getByRole('button', { name: '계정 만들기' }).first().click(); await p.waitForTimeout(600);
let d = dlg(p);
await d.getByLabel(/^역할/).selectOption('staff');
ok('1 역할 고르면 볼 수 있는 범위 안내', (await d.getByTestId('role-hint').innerText()).includes('수금'));
await d.getByLabel(/이름 \*/).fill(STAFF.name);
await d.getByLabel(/직책 \*/).fill('사무직원');
await d.getByLabel(/아이디 \(이메일\) \*/).fill(STAFF.id);
await d.getByLabel(/초기 비밀번호/).fill(STAFF.pw);
await d.getByLabel(/비밀번호 확인/).fill(STAFF.pw);
await d.getByRole('button', { name: '만들기', exact: true }).click(); await p.waitForTimeout(2500);
await dlg(p).getByRole('button', { name: '닫기' }).first().click().catch(() => {});
ok('1 서버: 사무직원 계정(staff)', sql(`select role from profiles where email='${STAFF.id}'`) === 'staff');

// 2 사무직원 화면 — 매출 정보 없음(화면 + 서버)
const { p: s } = await ctxFor(b, 'pc');
await login(s, STAFF, /\/ax\//);
await s.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await s.waitForTimeout(2000);
let nav = await s.locator('aside').innerText();
ok('2 사무직원: 승인·매출기회 메뉴 없음', !nav.includes('승인 · 매출기회'), nav.replace(/\n/g, '·').slice(0, 120));
ok('2 사무직원: 상담 메뉴는 "상담 기록"', nav.includes('상담 기록') && !nav.includes('상담 · 견적 · 계약'));
await s.goto(B + `/ax/clients/${coId}`, { waitUntil: 'domcontentloaded' }); await s.waitForTimeout(2000);
let t = await body(s);
ok('2 사무직원: 기업 상세에 "계약 · 수금" 탭 없음', !t.includes('계약 · 수금'));
await s.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await s.waitForTimeout(1500);
ok('2 사무직원: 현황표에 "못 받은 돈" 없음', !(await body(s)).includes('못 받은 돈'));
let stS = await state(s);
ok('2 사무직원: 서버가 계약·수금·견적·승인을 안 줌', stS.contracts.length === 0 && stS.payments.length === 0 && stS.quotes.length === 0 && stS.approvals.length === 0, `${stS.contracts.length}/${stS.payments.length}/${stS.quotes.length}/${stS.approvals.length}`);
ok('2 사무직원: 기업·요청자료는 받음', stS.companies.length >= 2 && stS.docRequests.length > 0);

// 3 컨설턴트 — 견적은 보고, 계약·수금은 못 봄
const { p: cn } = await ctxFor(b, 'pc');
await login(cn, ACC.con, /\/ax\//);
await cn.goto(B + `/ax/clients/${coId}`, { waitUntil: 'domcontentloaded' }); await cn.waitForTimeout(2000);
ok('3 컨설턴트: "계약 · 수금" 탭 없음', !(await body(cn)).includes('계약 · 수금'));
const stC = await state(cn);
ok('3 컨설턴트: 서버가 계약·수금을 안 줌', stC.contracts.length === 0 && stC.payments.length === 0);
nav = await cn.locator('aside').innerText();
ok('3 컨설턴트: 메뉴 "상담 · 견적"', nav.includes('상담 · 견적') && !nav.includes('상담 · 견적 · 계약'));

// 4 대표 보기 전환
await p.goto(B + `/ax/clients/${coId}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
ok('4 대표: "계약 · 수금" 탭 보임', (await body(p)).includes('계약 · 수금'));
await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
ok('4 계정 메뉴: 보기 전환', await p.getByTestId('view-switch').isVisible());
await p.getByTestId('view-switch').getByRole('menuitemradio', { name: /컨설턴트 화면/ }).click(); await p.waitForTimeout(1500);
ok('4 컨설턴트 화면으로: 배너', await p.getByTestId('view-as-banner').isVisible());
await p.goto(B + `/ax/clients/${coId}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
ok('4 컨설턴트 화면: "계약 · 수금" 탭 없음', !(await body(p)).includes('계약 · 수금'));
await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
await p.getByTestId('view-switch').getByRole('menuitemradio', { name: /사무직원 화면/ }).click(); await p.waitForTimeout(1500);
nav = await p.locator('aside').innerText();
ok('4 사무직원 화면: 승인·매출기회 메뉴 없음', !nav.includes('승인 · 매출기회'));
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
ok('4 새로고침해도 사무직원 화면 유지', (await p.getByTestId('view-as-banner').innerText().catch(() => '')).includes('사무직원'));
await p.getByTestId('view-as-banner').getByRole('button', { name: '대표 화면으로' }).click(); await p.waitForTimeout(1200);
await p.goto(B + `/ax/clients/${coId}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
ok('4 대표로 돌아옴: 배너 없음 · 계약 탭 다시 보임', (await p.getByTestId('view-as-banner').count()) === 0 && (await body(p)).includes('계약 · 수금'));
ok('4 사무직원은 보기 전환이 없다', (await s.getByTestId('account-menu-button').click().then(() => s.getByTestId('view-switch').count()).catch(() => 0)) === 0);

// 5 고객 화면(미리보기)에서 고객 대신 접수 → 담당 컨설턴트 업무
await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
await p.getByTestId('view-switch').getByRole('menuitem', { name: /고객 화면/ }).click(); await p.waitForTimeout(600);
await dlg(p).getByRole('button', { name: new RegExp(CO1.replace(/[()]/g, '.')) }).click(); await p.waitForURL(/\/portal/, { timeout: 10000 }); await p.waitForTimeout(1500);
await p.goto(B + '/portal/services', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
await p.getByRole('button', { name: /^이익소각/ }).first().click(); await p.waitForTimeout(500);
await dlg(p).getByRole('button', { name: '상담 요청' }).click(); await p.waitForTimeout(500);
ok('5 미리보기: "고객 대신 접수" 안내', await dlg(p).getByTestId('on-behalf-note').isVisible());
await dlg(p).getByRole('button', { name: '고객 대신 접수' }).click(); await p.waitForTimeout(3000);
const opp = sql(`select id || '|' || status || '|' || coalesce(note,'') from opportunities where company_id='${coId}' and service_name='이익소각' and source='portal_request' order by created_at desc limit 1`);
ok('5 서버: 상담 요청 생성(대신 접수 표시)', opp.includes('|interest|') && opp.includes('대신 접수'), opp);
const conId = sql(`select id from profiles where email='${ACC.con.id}'`);
ok('5 서버: 담당 컨설턴트에게 업무', sql(`select count(*) from tasks where company_id='${coId}' and title like '%이익소각%' and assignee_id='${conId}' and status='todo'`) === '1');

// 6 고객이 그 요청을 취소
const { p: c } = await ctxFor(b, 'mobile');
await login(c, ACC.c1, /\/portal/);
await c.goto(B + '/portal/services', { waitUntil: 'domcontentloaded' }); await c.waitForTimeout(2500);
const oppId = opp.split('|')[0];
await c.getByTestId(`cancel-request-${oppId}`).click(); await c.waitForTimeout(400);
await dlg(c).getByRole('button', { name: '요청 취소' }).click(); await c.waitForTimeout(3000);
ok('6 고객 취소 → 서버: 종료', sql(`select status from opportunities where id='${oppId}'`) === 'dropped');
ok('6 고객 취소 → 담당자 업무 정리', sql(`select count(*) from tasks where company_id='${coId}' and title like '%이익소각%' and status='todo'`) === '0');
ok('6 고객 취소 → 담당자 알림', sql(`select count(*) from notifications where audience='internal' and company_id='${coId}' and title like '요청 취소%'`) !== '0');
ok('6 고객 화면에서 빠짐', !(await c.locator('body').innerText()).includes(`cancel-request-${oppId}`) && (await c.getByTestId(`cancel-request-${oppId}`).count()) === 0);

// 7 공고 알림 취소
sql(`insert into support_programs(id, title, agency, regions, source, notified, apply_end) values ('mp_${TAG}','시험 공고 ${TAG}','시험부','{}','manual', array['${coId}'], current_date + 20) on conflict do nothing`);
await p.goto(B + '/ax/programs', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
const sentRow = p.locator(`[data-program-sent="mp_${TAG}"]`);
ok('7 공고 카드: 알림 보낸 곳 표시', (await sentRow.innerText().catch(() => '')).includes(CO1));
await sentRow.getByRole('button', { name: /알림 취소/ }).click(); await p.waitForTimeout(2500);
ok('7 알림 취소 → 서버 기록에서 빠짐', sql(`select coalesce(array_length(notified,1),0) from support_programs where id='mp_${TAG}'`) === '0');
await c.goto(B + '/portal/programs', { waitUntil: 'domcontentloaded' }); await c.waitForTimeout(2500);
ok('7 고객 화면 "보낸 공고"에서 빠짐', !(await c.locator('body').innerText()).includes(`시험 공고 ${TAG}`));

// 8 자료 요청 취소 (기업 상세 → 요청자료)
const docId = sql(`select id from document_requests where company_id='${coId}' and status='requested' order by requested_at desc limit 1`);
await p.goto(B + `/ax/clients/${coId}?tab=docs`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
await p.locator(`[data-testid="cancel-doc-${docId}"]:visible`).first().click(); await p.waitForTimeout(400);
await dlg(p).getByRole('button', { name: '요청 취소' }).click(); await p.waitForTimeout(3000);
ok('8 자료 요청 취소 → 서버에서 빠짐', sql(`select count(*) from document_requests where id='${docId}'`) === '0', docId);
ok('8 고객에게 "취소되었습니다" 알림', sql(`select count(*) from notifications where audience='client' and company_id='${coId}' and title='자료 요청이 취소되었습니다'`) !== '0');

// 9 휴대폰 메뉴에도 보기 전환
const { p: m } = await ctxFor(b, 'mobile');
await login(m, ACC.ceo, /\/ax\//);
await m.getByTestId('mobile-menu-button').click(); await m.waitForTimeout(500);
ok('9 휴대폰 메뉴: 보기 전환', await m.getByTestId('mobile-menu').getByTestId('view-switch').isVisible());

const errs = [p, s, cn, c, m].flatMap((x) => x.errs).filter((e) => !/Failed to load resource|favicon|ERR_CERT/.test(e));
ok('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);

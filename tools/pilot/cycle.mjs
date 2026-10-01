// 고객 ↔ KPJK 한 사이클 전체 (실서버 · 대표 PC + 고객 휴대폰, 별도 브라우저)
// 대표 계정만 있는 처음 상태에서: 기업 등록 → 고객 계정(안내 문구) → 프로젝트 → 서류 담아 요청 → 고객 첫 로그인·비밀번호 변경
// → 업로드 → 보완 요청 → 재제출 → 검토 완료 → 단계 메시지 → 일정 → 제안·상담 요청 → 문의·답변 → 견적·수락
// → 완료 + 결과 보고서 → 고객 내려받기 → 실증 기록. 한 단계가 깨져도 다음 단계로 넘어가며 전부 기록한다.
// 사용: tools/pilot/local-supabase.sh reset 후  node cycle.mjs
import { launch, ctxFor, login, logout, B, ACC, L, ok, sql, body, summary, FILES } from './lib.mjs';
const TAG = Date.now().toString().slice(-4);
const CO = `사이클 검증기업 ${TAG} (비식별)`;
const CLIENT = { id: `cycle${TAG}@pilot.test`, pw: 'CycleFirst1', pw2: 'CycleMine22', name: '사이클 담당' };
const b = await launch();
const { ctx: ceoCtx, p: ceo } = await ctxFor(b, 'pc');
const { p: cli } = await ctxFor(b, 'mobile');
await ceoCtx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B }).catch(() => {});
const dlg = (p) => p.locator('[role=dialog]:visible').last();
const waitFor = async (p, fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return Date.now() - t0; await p.waitForTimeout(500); } return -1; };
const popup = (p, re) => waitFor(p, async () => (await p.getByTestId('live-popup').allInnerTexts()).some((t) => re.test(t)), 15000);
const step = async (name, fn) => { try { await fn(); } catch (e) { L(`${name} — 중단`, `FAIL ${String(e).split('\n')[0].slice(0, 200)}`); } };
let coId = '', pjId = '';

await step('1 대표 로그인 · 기업 등록', async () => {
  await login(ceo, ACC.ceo, /\/ax\//);
  await ceo.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.getByRole('button', { name: '기업고객 등록' }).first().click(); await ceo.waitForTimeout(600);
  await dlg(ceo).getByLabel(/^기업명/).first().fill(CO);
  await dlg(ceo).getByLabel(/^대표자/).first().fill('비식별 대표');
  await dlg(ceo).getByRole('button', { name: '대표와 동일' }).click().catch(() => {});
  await dlg(ceo).getByRole('button', { name: '등록', exact: true }).click(); await ceo.waitForTimeout(3000);
  coId = sql(`select id from companies where name='${CO}'`);
  ok('1 기업 서버 저장', !!coId, coId);
  ok('1 등록 후 상세 화면', /\/ax\/clients\/co_/.test(ceo.url()), ceo.url());
});

await step('2 고객 계정 + 안내 문구', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=portal`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.getByRole('button', { name: '계정 만들기' }).first().click(); await ceo.waitForTimeout(600);
  await dlg(ceo).getByLabel(/이름 \*/).fill(CLIENT.name);
  await dlg(ceo).getByLabel(/직책 \*/).fill('경영지원');
  await dlg(ceo).getByLabel(/아이디 \(이메일\) \*/).fill(CLIENT.id);
  await dlg(ceo).getByLabel(/초기 비밀번호/).fill(CLIENT.pw);
  await dlg(ceo).getByLabel(/비밀번호 확인/).fill(CLIENT.pw);
  await dlg(ceo).getByRole('button', { name: '만들기', exact: true }).click(); await ceo.waitForTimeout(3000);
  ok('2 서버 계정·소속', sql(`select role||'|'||company_id from profiles where email='${CLIENT.id}'`) === `client|${coId}`);
  const notice = await ceo.getByTestId('account-notice').inputValue().catch(() => '');
  ok('2 안내 문구(주소·아이디·처음 비밀번호)', notice.includes('/login') && notice.includes(CLIENT.id) && notice.includes(CLIENT.pw), notice.split('\n')[0]);
  await dlg(ceo).getByRole('button', { name: '안내 문구 복사' }).click(); await ceo.waitForTimeout(500);
  const clip = await ceo.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('2 복사됨', clip.includes(CLIENT.id));
  await dlg(ceo).getByRole('button', { name: '닫기' }).first().click(); await ceo.waitForTimeout(800);
  ok('2 Portal 연결 표시', !(await body(ceo)).includes('아직 연결되지 않았습니다'));
});

await step('3 진행 업무 추가 (가지급금)', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=work`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.getByRole('button', { name: /진행 업무 추가/ }).first().click(); await ceo.waitForTimeout(600);
  await dlg(ceo).getByRole('group', { name: '컨설팅 분야' }).getByRole('button', { name: '가지급금', exact: true }).click();
  await dlg(ceo).getByRole('button', { name: '등록', exact: true }).click(); await ceo.waitForTimeout(3000);
  pjId = sql(`select id from projects where company_id='${coId}'`);
  ok('3 프로젝트 서버 저장(고객 공개)', sql(`select type||'|'||client_visible from projects where id='${pjId}'`) === '가지급금|true');
});

await step('4 자료 요청: 서류 담아 한 번에', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=work`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  const st = ceo.locator(`[data-stepper="${pjId}"]`);
  await st.getByRole('radio', { name: '1단계 자료 요청' }).click(); await ceo.waitForTimeout(600);
  await dlg(ceo).getByRole('button', { name: '가지급금 서류 모두 담기' }).click();
  await dlg(ceo).getByLabel('서류 직접 입력').fill('대표이사 대여금 약정서');
  await dlg(ceo).getByRole('button', { name: '추가', exact: true }).click();
  await dlg(ceo).getByRole('button', { name: /자료 6건/ }).click(); await ceo.waitForTimeout(3500);
  ok('4 요청 6건 서버 저장', sql(`select count(*) from document_requests where company_id='${coId}' and status='requested'`) === '6');
  ok('4 고객 알림 1건', sql(`select count(*) from notifications where company_id='${coId}' and audience='client' and title='자료 6건을 요청드립니다'`) === '1');
});

await step('5 고객 첫 로그인 · 비밀번호 변경', async () => {
  await login(cli, { id: CLIENT.id, pw: CLIENT.pw }, /\/portal/);
  ok('5 처음 비밀번호 안내', await cli.getByTestId('password-nudge').isVisible().catch(() => false));
  const t = await body(cli);
  ok('5 홈: 자료 요청 단계', t.includes('자료 요청') && t.includes('25%'));
  await cli.getByTestId('password-nudge').getByRole('link', { name: '지금 바꾸기' }).click(); await cli.waitForTimeout(1500);
  await cli.getByLabel('새 비밀번호', { exact: true }).fill(CLIENT.pw2);
  await cli.getByLabel('새 비밀번호 확인').fill(CLIENT.pw2);
  await cli.getByRole('button', { name: '비밀번호 바꾸기' }).click(); await cli.waitForTimeout(2500);
  ok('5 안내 사라짐', !(await cli.getByTestId('password-nudge').isVisible().catch(() => false)));
  await logout(cli);
  await login(cli, { id: CLIENT.id, pw: CLIENT.pw2 }, /\/portal/);
  ok('5 새 비밀번호로 로그인', /\/portal/.test(cli.url()));
});

const REQ = '계정별원장 (가지급금)';
await step('6 고객 업로드 → 대표 PC 카드', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=docs`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2500);
  await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2000);
  ok('6 고객 요청자료 6건', (await body(cli)).includes('대표이사 대여금 약정서'));
  const row = cli.locator('div').filter({ hasText: REQ }).filter({ has: cli.getByRole('button', { name: '업로드' }) }).last();
  await row.getByRole('button', { name: '업로드' }).click(); await cli.waitForTimeout(600);
  await cli.locator('[role=dialog] input[type=file]:not([capture])').setInputFiles(FILES + 'pilot-a1.txt');
  await cli.getByRole('button', { name: '제출하기' }).click();
  const ms = await popup(ceo, /자료 도착/);
  ok('6 대표 PC 카드', ms >= 0, `${ms}ms`);
  ok('6 서버: 제출 + 검토 업무', sql(`select count(*) from tasks where company_id='${coId}' and title like '%${REQ}%'`) !== '0');
});

await step('7 보완 요청 → 재제출 → 검토 완료', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=docs`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.locator('tr', { hasText: REQ }).first().click(); await ceo.waitForTimeout(800);
  await dlg(ceo).locator('textarea').first().fill('2025년 12월분까지 포함해서 다시 부탁드립니다.');
  await dlg(ceo).getByRole('button', { name: '보완 요청' }).click(); await ceo.waitForTimeout(3000);
  ok('7 서버: 보완 요청', sql(`select status from document_requests where company_id='${coId}' and name='${REQ}'`) === 'revision');
  await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' });
  ok('7 고객: 보완 내용 보임', (await waitFor(cli, async () => (await body(cli)).includes('2025년 12월분까지'))) >= 0);
  const row = cli.locator('div').filter({ hasText: REQ }).filter({ has: cli.getByRole('button', { name: '재제출' }) }).last();
  await row.getByRole('button', { name: '재제출' }).click(); await cli.waitForTimeout(600);
  await cli.locator('[role=dialog] input[type=file]:not([capture])').setInputFiles(FILES + 'pilot-b1.txt');
  await cli.getByRole('button', { name: '제출하기' }).click(); await cli.waitForTimeout(3000);
  ok('7 서버: 재제출', sql(`select status from document_requests where company_id='${coId}' and name='${REQ}'`) === 'submitted');
  await ceo.goto(`${B}/ax/clients/${coId}?tab=docs`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.locator('tr', { hasText: REQ }).first().click(); await ceo.waitForTimeout(800);
  ok('7 대표: 두 번째 파일', (await dlg(ceo).innerText()).includes('pilot-b1.txt'));
  await dlg(ceo).getByRole('button', { name: '검토 완료' }).click(); await ceo.waitForTimeout(3000);
  ok('7 서버: 검토 완료', sql(`select status from document_requests where company_id='${coId}' and name='${REQ}'`) === 'done');
  await cli.goto(`${B}/portal/documents`, { waitUntil: 'domcontentloaded' });
  ok('7 고객: 확인완료', (await waitFor(cli, async () => /확인완료/.test(await body(cli)))) >= 0);
});

await step('8 단계 2 · 3 + 메시지', async () => {
  await cli.goto(`${B}/portal`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2000);
  await ceo.goto(`${B}/ax/clients/${coId}?tab=work`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  const st = ceo.locator(`[data-stepper="${pjId}"]`);
  await st.getByRole('radio', { name: '3단계 진행 중' }).click(); await ceo.waitForTimeout(500);
  await dlg(ceo).getByRole('button', { name: /곧 결과를 정리해/ }).click();
  await dlg(ceo).getByRole('button', { name: '단계 바꾸고 보내기' }).click();
  const ms = await popup(cli, /진행 중/);
  ok('8 고객 폰 카드(진행 중)', ms >= 0, `${ms}ms`);
  ok('8 고객 홈 75%', (await waitFor(cli, async () => (await body(cli)).includes('75%'))) >= 0);
});

await step('9 일정 공개', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=schedule`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.getByRole('button', { name: '일정 등록' }).click(); await ceo.waitForTimeout(500);
  await dlg(ceo).getByLabel('제목').fill('중간 보고 미팅');
  await dlg(ceo).getByRole('button', { name: '등록', exact: true }).click(); await ceo.waitForTimeout(3000);
  await cli.goto(`${B}/portal/schedule`, { waitUntil: 'domcontentloaded' });
  ok('9 고객 일정', (await waitFor(cli, async () => (await body(cli)).includes('중간 보고 미팅'))) >= 0);
});

await step('10 제안 → 고객 상담 요청 → 대표 카드', async () => {
  await ceo.goto(`${B}/ax/clients/${coId}?tab=portal`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.locator('#proposal-panel').getByRole('button', { name: '이익잉여금', exact: true }).click(); await ceo.waitForTimeout(300);
  await dlg(ceo).locator('textarea').fill('가지급금 정리와 함께 잉여금 활용 방향을 보면 순서가 깔끔합니다.');
  await dlg(ceo).getByRole('button', { name: '고객 화면에 올리기' }).click(); await ceo.waitForTimeout(2500);
  await cli.goto(`${B}/portal/services`, { waitUntil: 'domcontentloaded' });
  ok('10 고객: 제안 보임', (await waitFor(cli, async () => (await body(cli)).includes('잉여금 활용 방향'))) >= 0);
  await cli.locator('[data-proposal="이익잉여금"]').getByRole('button', { name: '상담 요청' }).click(); await cli.waitForTimeout(400);
  await dlg(cli).getByRole('button', { name: '상담 요청' }).click();
  const ms = await popup(ceo, /상담 요청/);
  ok('10 대표 PC 카드(상담 요청)', ms >= 0, `${ms}ms`);
  ok('10 서버: 상담 연락 업무', sql(`select count(*) from tasks where company_id='${coId}' and title like '%이익잉여금%'`) !== '0');
});

await step('11 문의 → 답변', async () => {
  await cli.goto(`${B}/portal/inquiries`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500);
  await cli.getByRole('button', { name: '새 문의' }).first().click(); await cli.waitForTimeout(600);
  await cli.getByLabel('제목').fill(`정리 기간 문의 ${TAG}`);
  await cli.getByLabel('내용').fill('가지급금 정리는 보통 얼마나 걸리나요?');
  await cli.getByRole('button', { name: '문의 보내기' }).click();
  const ms = await popup(ceo, /문의/);
  ok('11 대표 PC 카드(문의)', ms >= 0, `${ms}ms`);
  await ceo.goto(`${B}/ax/inquiries`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
  await ceo.locator(`:text("정리 기간 문의 ${TAG}"):visible`).first().click(); await ceo.waitForTimeout(800);
  await ceo.getByPlaceholder(/고객에게 전달할 답변/).fill('자료가 다 모이면 보통 몇 주 안에 방향을 정리해 드립니다.');
  await ceo.getByRole('button', { name: '답변 등록' }).click(); await ceo.waitForTimeout(3000);
  await cli.goto(`${B}/portal/inquiries`, { waitUntil: 'domcontentloaded' });
  ok('11 고객: 답변 보임', (await waitFor(cli, async () => { await cli.locator(`:text("정리 기간 문의 ${TAG}"):visible`).first().click().catch(() => {}); return (await body(cli)).includes('방향을 정리해 드립니다'); })) >= 0);
});

await step('12 견적 발송 → 고객 수락', async () => {
  await ceo.goto(`${B}/ax/consultations?tab=quote`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.getByRole('button', { name: '견적 작성' }).first().click(); await ceo.waitForTimeout(800);
  await dlg(ceo).getByLabel('기업').selectOption({ label: CO }).catch(() => {});
  await dlg(ceo).locator('input[placeholder*="경영진단"]').fill(`가지급금 정리 견적 ${TAG}`);
  await dlg(ceo).locator('input[placeholder="항목명"]').first().fill('가지급금 정리 컨설팅');
  await dlg(ceo).locator('input[placeholder="0"]').first().fill('300');
  await dlg(ceo).getByRole('button', { name: '저장' }).click(); await ceo.waitForTimeout(2500);
  await ceo.locator('div.card', { hasText: `가지급금 정리 견적 ${TAG}` }).first().click(); await ceo.waitForTimeout(800);
  await ceo.getByRole('button', { name: '고객에게 발송' }).click(); await ceo.waitForTimeout(3000);
  ok('12 서버: 견적 발송', sql(`select status from quotes where title='가지급금 정리 견적 ${TAG}'`) === 'sent');
  await cli.goto(`${B}/portal/services`, { waitUntil: 'domcontentloaded' });
  ok('12 고객: 견적 보임', (await waitFor(cli, async () => (await body(cli)).includes(`가지급금 정리 견적 ${TAG}`))) >= 0);
  await cli.getByRole('button', { name: '이대로 진행할게요' }).first().click(); await cli.waitForTimeout(500);
  await dlg(cli).getByRole('button', { name: '회신 보내기' }).click(); await cli.waitForTimeout(3000);
  ok('12 서버: 고객 수락', sql(`select status from quotes where title='가지급금 정리 견적 ${TAG}'`) === 'accepted');
});

await step('13 완료 + 결과 보고서 → 고객 내려받기', async () => {
  await cli.goto(`${B}/portal`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2000);
  await ceo.goto(`${B}/ax/clients/${coId}?tab=work`, { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(1500);
  await ceo.locator(`[data-stepper="${pjId}"]`).getByRole('radio', { name: '4단계 완료' }).click(); await ceo.waitForTimeout(500);
  await dlg(ceo).getByLabel('결과자료 파일').setInputFiles(FILES + 'pilot-a1.txt');
  await dlg(ceo).getByRole('button', { name: /결과 자료는 완료자료/ }).click();
  await dlg(ceo).getByRole('button', { name: '단계 바꾸고 보내기' }).click(); await ceo.waitForTimeout(4000);
  ok('13 서버: 완료 + 결과자료(파일)', sql(`select stage from projects where id='${pjId}'`) === 'done' && sql(`select count(*) from results where company_id='${coId}' and storage_path is not null`) === '1');
  ok('13 고객 홈 100%', (await waitFor(cli, async () => (await body(cli)).includes('100%'))) >= 0);
  await cli.goto(`${B}/portal/results`, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2000);
  const [dl] = await Promise.all([cli.waitForEvent('download', { timeout: 10000 }).catch(() => null), cli.waitForEvent('popup', { timeout: 10000 }).catch(() => null), cli.getByRole('button', { name: '열람 / 다운로드' }).first().click()]);
  await cli.waitForTimeout(2500);
  ok('13 고객 내려받기 기록', sql(`select count(*) from activities where company_id='${coId}' and type='result_downloaded'`) !== '0', dl ? 'download' : '');
});

await step('14 실증 기록 · 내부 정보 차단', async () => {
  const types = sql(`select string_agg(distinct type, ',') from activities where company_id='${coId}'`);
  const need = ['company_created', 'project_created', 'document_requested', 'document_uploaded', 'document_revision_requested', 'document_reviewed', 'project_stage_changed', 'schedule_created', 'opportunity_created', 'inquiry_created', 'inquiry_answered', 'quote_sent', 'quote_responded', 'result_shared', 'result_downloaded'];
  const miss = need.filter((x) => !types.includes(x));
  ok('14 실증 기록에 사이클 전부', miss.length === 0, miss.length ? `빠짐: ${miss.join(',')}` : `${types.split(',').length}종`);
  for (const path of ['/portal', '/portal/projects', '/portal/documents', '/portal/schedule', '/portal/services', '/portal/results', '/portal/notifications', '/portal/me']) {
    await cli.goto(B + path, { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1200);
    const hit = (await body(cli)).match(/(?<![가미])수금|업무 일기|상담 기록|계약금|성공보수|내부 메모|DEMO DATA|undefined|NaN|null/);
    ok(`14 고객 ${path}: 내부·깨진 표시 없음`, !hit, hit?.[0] ?? '');
  }
});

const errs = [...ceo.errs, ...cli.errs].filter((e) => !/ERR_CERT|ERR_NAME|fonts|Failed to load resource|WebSocket/.test(e));
ok('화면 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);

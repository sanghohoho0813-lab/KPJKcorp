// 지원사업 매칭 베타 (실서버): 담당자 공고 추가 → 맞는 고객 알림 → 고객 폰에서 보고 물어보기 → 담당자 카드·기회·업무
// / 가망고객: 로그인 없이 조건 입력 → 맞는 공고 → 상담 남기기(동의) → 담당자 카드·업무 → 연락함 → 기업고객 전환
// 사용: setup.mjs 다음.  공고는 "시험용"이라고 적은 지어낸 값이다(실제 공고 아님).
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary } from './lib.mjs';
const b = await launch();
const { p: ceo } = await ctxFor(b, 'pc');
const { p: cli } = await ctxFor(b, 'mobile');
const dlg = (p) => p.locator('[role=dialog]:visible').last();
const waitFor = async (p, fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return Date.now() - t0; await p.waitForTimeout(400); } return -1; };
const popup = (p, re) => waitFor(p, async () => (await p.getByTestId('live-popup').allInnerTexts()).some((t) => re.test(t)));
const TAG = Date.now().toString().slice(-4);
const TITLE = `시험용 경기 제조기업 스마트공장 지원 ${TAG}`;
const coId = sql(`select id from companies where name='${CO1}'`);
sql(`update companies set region='경기', industry='제조업', biz_category='제조', established_at='2015-03-02', employees=20 where id='${coId}'`);
const ceoId = sql(`select id from profiles where email='${ACC.ceo.id}'`);
const end = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);

await login(ceo, ACC.ceo, /\/ax\//);
await login(cli, ACC.c1, /\/portal/);

// 1) 공고 화면 · 키 없음 안내
await ceo.goto(B + '/ax/programs', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2500);
ok('1 기업마당 키 없으면 연결 안내(지어낸 공고 없음)', await ceo.getByTestId('bizinfo-setup').isVisible());
// 2) 공고 직접 추가
await ceo.getByRole('button', { name: '공고 직접 추가' }).click(); await ceo.waitForTimeout(500);
await dlg(ceo).getByLabel('공고명').fill(TITLE);
await dlg(ceo).getByLabel('기관').fill('시험기관');
await dlg(ceo).getByLabel('분야').selectOption('기술');
await dlg(ceo).getByRole('button', { name: '경기', exact: true }).click();
await dlg(ceo).getByLabel('접수 마감일').fill(end);
await dlg(ceo).getByLabel('공고 주소').fill('https://example.org/test-notice');
await dlg(ceo).getByLabel('지원 대상').fill('경기도 소재 제조 중소기업');
await dlg(ceo).getByRole('button', { name: '추가', exact: true }).click(); await ceo.waitForTimeout(3000);
const pid = sql(`select id from support_programs where title='${TITLE}'`);
ok('2 서버: 공고 저장', !!pid && sql(`select apply_end::text||'|'||array_to_string(regions,',') from support_programs where id='${pid}'`) === `${end}|경기`);
const match = await ceo.locator(`[data-program-match="${pid}"]`).innerText();
ok('2 맞는 고객 표시', match.includes('맞는 고객 1곳') && match.includes(CO1), match.replace(/\n/g, ' '));
// 3) 맞는 고객에게 알림 → 고객 폰 카드
await cli.goto(B + '/portal', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2500);
await ceo.locator(`[data-program="${pid}"]`).getByRole('button', { name: /맞는 고객 1곳에 알림/ }).click();
let ms = await popup(cli, /지원사업 공고/);
ok('3 고객 폰 카드(알림)', ms >= 0, `${ms}ms`);
ok('3 서버: 알림 보낸 기록', sql(`select array_to_string(notified,',') from support_programs where id='${pid}'`) === coId);
ms = await waitFor(cli, async () => await cli.getByTestId('program-teaser').isVisible());
ok('3 고객 홈: 맞는 지원사업 1건', ms >= 0 && (await cli.getByTestId('program-teaser').innerText()).includes('1건'));
// 4) 고객 지원사업 화면 → 물어보기 → 대표 PC 카드
await cli.goto(B + '/portal/programs', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2000);
const card = await cli.locator(`[data-program="${pid}"]`).innerText();
ok('4 고객: 근거(지역·업종·마감)', card.includes('지역 맞음: 경기') && card.includes('업종 맞음: 제조') && card.includes('D-5'));
ok('4 고객: 공고문 링크', (await cli.locator(`[data-program="${pid}"] a`).getAttribute('href')) === 'https://example.org/test-notice');
await cli.locator(`[data-program="${pid}"]`).getByRole('button', { name: '담당 컨설턴트에게 물어보기' }).click(); await cli.waitForTimeout(400);
await dlg(cli).locator('textarea').fill('신청 가능한지 궁금합니다.');
await dlg(cli).getByRole('button', { name: '보내기' }).click();
ms = await popup(ceo, /지원사업 문의/);
ok('4 대표 PC 카드(지원사업 문의)', ms >= 0, `${ms}ms`);
ok('4 서버: 매출기회 · 상담 연락 업무', sql(`select count(*) from opportunities where company_id='${coId}' and service_key='support_program' and source='portal_request'`) === '1' && sql(`select count(*) from tasks where company_id='${coId}' and title like '%지원사업: ${TITLE}%'`) !== '0');
ms = await waitFor(cli, async () => (await cli.locator(`[data-program="${pid}"]`).innerText()).includes('문의함'));
ok('4 고객: 문의함 표시', ms >= 0);
// 5) 고객별 탭
await ceo.goto(B + '/ax/programs?tab=companies', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
ok('5 고객별: 맞는 공고 1건', (await ceo.locator(`[data-company-programs="${CO1}"]`).innerText()).includes('맞는 공고 1건'));

// 6) 가망고객 — 로그인 없이
const { p: pr } = await ctxFor(b, 'mobile');
await pr.goto(`${B}/match?ref=${ceoId}`, { waitUntil: 'domcontentloaded' }); await pr.waitForTimeout(3000);
ok('6 비로그인: 화면 열림(로그인으로 안 튕김)', /\/match/.test(pr.url()));
await pr.getByRole('button', { name: '경기', exact: true }).click();
await pr.getByRole('button', { name: '제조', exact: true }).click();
await pr.getByRole('button', { name: '3~7년', exact: true }).click();
await pr.getByRole('button', { name: '10~29명', exact: true }).click();
await pr.getByRole('button', { name: '맞는 공고 보기' }).click(); await pr.waitForTimeout(1200);
const res = await pr.locator('#match-results').innerText();
ok('6 비로그인: 맞는 공고(근거)', res.includes(TITLE) && res.includes('지역 맞음: 경기'));
await pr.locator(`[data-program="${pid}"]`).getByRole('button', { name: /관심 있어요/ }).click();
await pr.getByLabel('회사명').fill(`가망 시험기업 ${TAG}`);
await pr.getByLabel('담당자 성함').fill('가망 담당');
await pr.getByLabel('연락처').fill('010-0000-0000');
await pr.getByRole('button', { name: '상담 요청 남기기' }).click(); await pr.waitForTimeout(800);
ok('6 동의 없으면 안 보내짐', sql(`select count(*) from leads where company_name='가망 시험기업 ${TAG}'`) === '0' && !(await pr.getByTestId('lead-done').isVisible().catch(() => false)));
await pr.getByLabel('개인정보 수집·이용 동의').check();
await ceo.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2500);
await pr.getByRole('button', { name: '상담 요청 남기기' }).click();
ms = await waitFor(pr, async () => await pr.getByTestId('lead-done').isVisible());
ok('6 접수 완료 화면', ms >= 0);
ok('6 서버: 가망고객(담당자·관심 공고)', sql(`select ref_user::text||'|'||array_to_string(program_ids,',')||'|'||region||'|'||founded_year from leads where company_name='가망 시험기업 ${TAG}'`) === `${ceoId}|${pid}|경기|${new Date().getFullYear() - 5}`);
ms = await popup(ceo, /새 가망고객/);
ok('6 대표 PC 카드(새 가망고객)', ms >= 0, `${ms}ms`);
ok('6 서버: 연락 업무(대표 배정)', sql(`select assignee_id::text from tasks where title like '가망 시험기업 ${TAG} 가망고객 연락%'`) === ceoId);
// 7) 가망고객 탭 → 연락함 → 전환
await ceo.goto(B + '/ax/programs?tab=leads', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2500);
const lead = ceo.locator(`[data-lead="가망 시험기업 ${TAG}"]`);
const lt = await lead.innerText();
ok('7 가망고객 카드: 조건·관심 공고·맞는 공고', lt.includes('010-0000-0000') && lt.includes(TITLE) && lt.includes('지금 맞는 공고 1건'));
await lead.getByRole('button', { name: '연락함' }).click(); await ceo.waitForTimeout(2500);
ok('7 서버: 연락함', sql(`select status from leads where company_name='가망 시험기업 ${TAG}'`) === 'contacted');
await lead.getByRole('button', { name: '기업고객으로 전환' }).click(); await ceo.waitForURL(/\/ax\/clients\/co_/, { timeout: 10000 }).catch(() => {}); await ceo.waitForTimeout(3000);
const newCo = sql(`select company_id from leads where company_name='가망 시험기업 ${TAG}'`);
ok('7 서버: 기업고객 전환(유입 경로·지역)', !!newCo && sql(`select lead_source||'|'||region||'|'||contact_phone from companies where id='${newCo}'`) === '지원사업 매칭|경기|010-0000-0000' && sql(`select status from leads where company_name='가망 시험기업 ${TAG}'`) === 'converted');
ok('7 전환 후 기업 상세로 이동', ceo.url().includes(newCo));
const errs = [...ceo.errs, ...cli.errs, ...pr.errs].filter((e) => !/ERR_CERT|ERR_NAME|fonts|Failed to load resource|WebSocket/.test(e));
ok('화면 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);

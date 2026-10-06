// 매일 쓰는 흐름 — 실제 서버에 저장되는지 (한 줄 업무 등록 · 완료 · 되돌리기 · 보류 · 다시 시작 · 기업 상세 빠른 작업)
//  컨설턴트 PC에서 하고 → DB에 그대로 남는지 → 새로고침 뒤에도 같은지 → 대표 화면에 보이는지
//  node tools/pilot/daily.mjs
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary } from './lib.mjs';

const co = sql(`select id from public.companies where name = '${CO1}' limit 1`);
const tag = Date.now().toString(36).slice(-5);
const T1 = `${CO1.replace(' (비식별)', '')} 대표 ${tag} 일정 전화`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 기한 시각은 브라우저 시간대 기준 18:00 — 시험 브라우저 시간대(UTC)로 비교한다 (한국 브라우저면 18:00 KST)
const row = (title) => sql(`select coalesce(company_id::text,'-') || '|' || type || '|' || status || '|' || extract(epoch from due_date)::bigint from public.tasks where title = '${title.replace(/'/g, "''")}' order by created_at desc limit 1`);
async function until(fn, ms = 12000) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = fn(); if (v) return v; await wait(400); } return v; }

const b = await launch();
const { p: con } = await ctxFor(b, 'pc');
await login(con, ACC.con, /\/ax\//);
await con.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2000);

// 1) 대시보드 한 줄 등록
const card = con.locator('#today-tasks');
ok('1 대시보드 오늘 할 업무', await card.isVisible());
await card.getByLabel('새 업무 제목').fill(T1); await con.waitForTimeout(200);
const guess = await card.getByTestId('quick-task-guess').innerText();
await card.getByLabel('새 업무 제목').press('Enter');
const r1 = await until(() => { const r = row(T1); return r ? r : ''; });
const [c1, ty1, st1, ep1] = r1.split('|');
const hour = ep1 ? await con.evaluate((e) => new Date(Number(e) * 1000).getHours(), ep1) : -1;
ok('1 서버 저장: 기업 자동 연결 · 후속연락 · 할 일 · 18시', c1 === co && ty1 === '후속연락' && st1 === 'todo' && hour === 18, `${c1}|${ty1}|${st1}|${hour}시 (${guess.replace(/\n/g, ' ')})`);

// 2) 완료 → 되돌리기 → 서버
await card.getByRole('button', { name: `${T1} 완료` }).click();
ok('2 완료가 서버에', !!(await until(() => row(T1).split('|')[2] === 'done')));
await con.getByTestId('toast-action').getByRole('button', { name: '되돌리기' }).click();
ok('2 되돌리기도 서버에', !!(await until(() => row(T1).split('|')[2] === 'todo')));

// 3) 업무함: 보류 → 다시 시작, 새로고침 뒤 유지
await con.goto(B + '/ax/tasks', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(1800);
await con.getByLabel('업무 검색').fill(tag); await con.waitForTimeout(300);
await con.locator('[data-group], .divide-y').getByRole('button', { name: '보류' }).first().click();
ok('3 보류가 서버에', !!(await until(() => row(T1).split('|')[2] === 'hold')));
await con.reload({ waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2200);
ok('3 새로고침 뒤 보류 필터에 남음', await con.getByRole('button', { name: /^보류 \d+$/ }).isVisible());
await con.getByRole('button', { name: /^보류 \d+$/ }).click(); await con.waitForTimeout(300);
await con.getByLabel('업무 검색').fill(tag); await con.waitForTimeout(300);
await con.getByRole('button', { name: '다시 시작' }).first().click();
ok('3 다시 시작이 서버에', !!(await until(() => row(T1).split('|')[2] === 'todo')));

// 4) 기업 상세 빠른 작업 → 업무 추가(오늘) → 할 일 목록 · 서버
const T2 = `자료 ${tag} 2차 검토`;
await con.goto(B + `/ax/clients/${co}`, { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2200);
await con.getByTestId('client-quick-actions').getByRole('button', { name: '업무 추가' }).click(); await con.waitForTimeout(400);
const dlg = con.getByRole('dialog');
await dlg.getByPlaceholder(/비앤테크 미제출/).fill(T2);
await dlg.getByRole('button', { name: '오늘', exact: true }).click();
await dlg.getByRole('button', { name: '등록', exact: true }).click();
const r2 = await until(() => row(T2));
ok('4 기업 상세에서 등록 → 이 기업 · 자료검토 · 서버', r2.startsWith(`${co}|자료검토|todo`), r2);
ok('4 지금 할 일에 바로 보임', await con.locator('#client-todo').getByText(`업무: ${T2}`).isVisible());

// 5) 대표 화면 — 다른 사람 화면에도 같은 업무
const { p: ceo } = await ctxFor(b, 'pc');
await login(ceo, ACC.ceo, /\/ax\//);
await ceo.goto(B + '/ax/tasks', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
await ceo.getByRole('button', { name: '전체', exact: true }).click(); await ceo.waitForTimeout(300);
await ceo.getByLabel('업무 검색').fill(tag); await ceo.waitForTimeout(400);
const txt = (await ceo.locator('main').innerText().catch(() => '')) || '';
ok('5 대표 업무함에서도 두 업무가 보임', txt.includes(T1) && txt.includes(T2));

// 7) 상담 기록 → 후속 업무 · 고객 자료 요청 (서버 저장 · 다시 저장해도 중복 없음 · 고객 화면)
const NA = `제안서 ${tag} 송부 후 전화`, PR = `시뮬레이션 ${tag} 전달`, DOC = `주주명부 ${tag}`;
await con.goto(B + `/ax/clients/${co}`, { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2000);
await con.getByTestId('client-quick-actions').getByRole('button', { name: '상담 기록' }).click(); await con.waitForTimeout(400);
const cd = con.getByRole('dialog');
await cd.getByPlaceholder(/김민석 대표와 원가구조/).fill(`[${tag}] 실서버 상담 기록`);
const li = cd.getByPlaceholder('한 줄씩 입력 후 Enter');
await li.nth(2).click(); await con.keyboard.type(PR); await con.keyboard.press('Enter');
await li.nth(3).click(); await con.keyboard.type(DOC); await con.keyboard.press('Enter');
await cd.getByPlaceholder('예: 제안서 송부 및 계약 협의').fill(NA);
await cd.getByTestId('consult-followups').locator('input[data-follow=doc]').check();
await cd.getByRole('button', { name: '저장', exact: true }).click();
const csN = await until(() => sql(`select count(*) from public.tasks where rule_key like 'cs:%' and (title like '%${NA}%' or title like '%약속: ${PR}%')`) === '2' ? '2' : '');
ok('7 서버: 상담 후속 업무 2건 (다음 Action · 약속)', csN === '2');
const drRow = await until(() => sql(`select status from public.document_requests where company_id = '${co}' and name = '${DOC}'`));
ok('7 서버: 고객 자료 요청 저장', drRow === 'requested', drRow);
ok('7 서버: 상담 기록 저장', sql(`select count(*) from public.consultations where notes = '[${tag}] 실서버 상담 기록'`) === '1');
await con.goto(B + '/ax/consultations', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(1800);
await con.getByRole('button', { name: '상담기록 수정' }).first().click(); await con.waitForTimeout(400);
const ed = con.getByRole('dialog');
ok('7 수정 창: 이미 만든 것 잠김', (await ed.getByTestId('consult-followups').locator('input[data-follow]:disabled').count()) === 3);
await ed.getByRole('button', { name: '저장', exact: true }).click(); await con.waitForTimeout(3000);
ok('7 다시 저장해도 서버 중복 없음', sql(`select count(*) from public.tasks where rule_key like 'cs:%' and (title like '%${NA}%' or title like '%${PR}%')`) === '2' && sql(`select count(*) from public.document_requests where name = '${DOC}'`) === '1');
const { p: cli } = await ctxFor(b, 'mobile');
await login(cli, ACC.c1, /\/portal/);
await cli.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2500);
ok('7 고객 휴대폰 요청자료에 보임', await cli.getByText(DOC).first().isVisible());
// 8) 고객 연락 공백 — 40일 연락 없는 기업 → 대표 화면이 열릴 때 규칙 업무 생성 → 컨설턴트 '연락함' → 업무 완료 · 서버 저장
const gapId = `co_gap_${tag}`, gapName = `Pilot 연락공백 ${tag} (비식별)`;
const conUid = sql(`select consultant_id from public.companies where id = '${co}'`);
sql(`insert into public.companies (id, code, name, ceo, consultant_id, first_consult_date) values ('${gapId}', 'G${tag.slice(-2)}', '${gapName}', '시험대표', '${conUid}', now() - interval '40 days')`);
const { p: ceo2 } = await ctxFor(b, 'pc');
await login(ceo2, ACC.ceo, /\/ax\//);
await ceo2.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' });
const gapTask = await until(() => sql(`select rule_key || '|' || type || '|' || assignee_id::text || '|' || status from public.tasks where company_id = '${gapId}' and rule_key like 'no_contact:%'`), 20000);
ok('8 서버: 연락 40일 공백 → 규칙 업무 (담당 컨설턴트 · 후속연락)', !!gapTask && gapTask.includes('|후속연락|' + conUid + '|todo'), gapTask);
await con.goto(B + `/ax/clients/${gapId}`, { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2500);
ok('8 컨설턴트 화면: 연락 공백 표시', /연락 40일 없음/.test(await con.getByTestId('contact-line').first().innerText().catch(() => '')));
await con.getByTestId('client-quick-actions').getByRole('button', { name: '연락함' }).click(); await con.waitForTimeout(300);
const ld = con.getByRole('dialog');
await ld.getByRole('radio', { name: '전화' }).click();
await ld.getByPlaceholder(/중간보고 일정 안내/).fill(`시험 통화 ${tag}`);
await ld.getByRole('button', { name: '기록', exact: true }).click();
ok('8 서버: 통화 기록 저장', !!(await until(() => sql(`select type from public.journal_entries where company_id = '${gapId}' and content = '[전화] 시험 통화 ${tag}'`) === 'call')));
ok('8 서버: 연락 업무 완료로', !!(await until(() => sql(`select status from public.tasks where company_id = '${gapId}' and rule_key like 'no_contact:%'`) === 'done')));
await con.reload({ waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2500);
ok('8 새로고침 뒤 마지막 연락 오늘', /마지막 연락 오늘/.test(await con.getByTestId('contact-line').first().innerText().catch(() => '')));
await ceo2.goto(B + '/ax/clients?filter=contact', { waitUntil: 'domcontentloaded' }); await ceo2.waitForTimeout(2500);
ok('8 대표 화면 연락 필요 목록에서 빠짐', (await ceo2.locator(`a[href="/ax/clients/${gapId}"]`).count()) === 0);
sql(`delete from public.journal_entries where company_id = '${gapId}'`);
sql(`delete from public.tasks where company_id = '${gapId}'`);
sql(`delete from public.companies where id = '${gapId}'`);

ok('6 페이지 오류 없음', [con, ceo].every((p) => p.errs.filter((e) => !/Failed to load resource|ERR_CERT/.test(e)).length === 0), [con, ceo].flatMap((p) => p.errs).slice(0, 2).join(' | '));
// 시험 업무 정리
sql(`delete from public.tasks where title in ('${T1.replace(/'/g, "''")}', '${T2}') or title like '%${tag}%'`);
sql(`delete from public.document_requests where name = '주주명부 ${tag}'`);
await b.close();
process.exit(summary() ? 1 : 0);

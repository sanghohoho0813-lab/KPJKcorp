// 지원사업 공고 매일 자동 갱신 + 고객 화면 + 고객 PC 메뉴 — 실서버(로컬 Supabase) + 가짜 기업마당(fake-bizinfo.mjs)
// 앱은 BIZINFO_API_BASE=http://127.0.0.1:4010/api BIZINFO_API_KEY=test CRON_SECRET=<열쇠> 로 띄우고,
// DB 에는 select public.kpjk_set_program_sync_key('<열쇠>') 를 해 둔다.
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary } from './lib.mjs';
const KEY = process.env.CRON_SECRET || 'local-test-sync-key-123456';
const call = async (auth) => { const t0 = Date.now(); const r = await fetch(B + '/api/programs/sync', { headers: auth ? { Authorization: `Bearer ${auth}` } : {} }); return { status: r.status, j: await r.json(), ms: Date.now() - t0 }; };

// 1 자동 갱신(크론) — 열쇠 확인
const no = await call('');
ok('1 열쇠 없이 부르면 거절', no.status === 401 && no.j.ok === false, JSON.stringify(no.j));
const bad = await call('wrong-key');
ok('1 틀린 열쇠(로그인 토큰 아님) 거절', bad.status === 403 && bad.j.ok === false, `${bad.status}`);
const c1 = await call(KEY);
ok('1 크론: 접수 중 공고만 저장 (마감 225건 제외 → 675건)', c1.j.ok && c1.j.total === 675 && c1.j.added === 675, `${JSON.stringify(c1.j)} ${c1.ms}ms`);
ok('1 서버 표에 675건', sql(`select count(*) from support_programs where id like 'bz_PBLN_FAKE%'`) === '675');
const c2 = await call(KEY);
ok('1 다시 불러도 바뀐 것 없음 (0 · 0)', c2.j.ok && c2.j.added === 0 && c2.j.updated === 0, `${c2.ms}ms`);
ok('1 지역: 화성시 공고 → 경기 / 전국 공고 → 전국 / 경북 TIPS → 경북',
  sql(`select regions from support_programs where id='bz_PBLN_FAKE00000'`) === '{경기}' && sql(`select regions from support_programs where id='bz_PBLN_FAKE00001'`) === '{}' && sql(`select regions from support_programs where id='bz_PBLN_FAKE00002'`) === '{경북}');

// 2 매칭 — 기업 A: 경기 화성시 · 제조 · 2012년 설립
const coId = sql(`select id from companies where name='${CO1}'`);
sql(`update companies set address='경기 화성시 봉담읍', region='경기', industry='정밀부품 제조', established_at='2012-03-02' where id='${coId}'`);
const b = await launch();
const { p } = await ctxFor(b, 'pc');
const syncCalls = [];
p.on('request', (r) => { if (r.url().includes('/api/programs')) syncCalls.push(r.url()); });
await login(p, ACC.ceo, /\/ax\//);
await p.goto(B + '/ax/programs', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
ok('2 화면 열 때 기업마당을 다시 부르지 않음(오늘 이미 받음)', syncCalls.length === 0, syncCalls.join(','));
const m0 = await p.locator('[data-program-match="bz_PBLN_FAKE00000"]').innerText().catch(() => '');
ok('2 화성시 제조 공고 → 기업 A 맞는 고객', m0.includes(CO1), m0.replace(/\n/g, ' ').slice(0, 80));
await p.getByRole('button', { name: '전체', exact: true }).click(); await p.waitForTimeout(800);
const m1 = await p.locator('[data-program-match="bz_PBLN_FAKE00001"]').innerText().catch(() => '');
const m2 = await p.locator('[data-program-match="bz_PBLN_FAKE00002"]').innerText().catch(() => '');
ok('2 전국 수출 공고 → 지역만으로 맞는 고객 아님', !m1.includes(CO1), m1.replace(/\n/g, ' ').slice(0, 60));
ok('2 경북 공고 → 경기 회사 아님', !m2.includes(CO1));

// 3 담당자 버튼 — 서버가 받아 저장(로그인 토큰)
const t0 = Date.now();
await p.getByRole('button', { name: '기업마당에서 불러오기' }).click();
await p.getByText(/접수 중 공고 675건/).first().waitFor({ timeout: 30000 }).catch(() => {});
const btnMs = Date.now() - t0;
ok('3 불러오기 버튼: 서버 경로로 저장 · 결과 안내', (await p.getByText(/접수 중 공고 675건 — 새 공고 0건/).count()) > 0, `${btnMs}ms`);

// 4 알림 → 고객 화면 (규칙에 맞는 공고 + 규칙 밖이지만 담당자가 보낸 공고)
await p.getByRole('button', { name: '고객·가망고객과 맞는 공고' }).click().catch(() => {}); await p.waitForTimeout(500);
const card0 = p.locator('[data-program="bz_PBLN_FAKE00000"]');
await card0.getByRole('button', { name: /맞는 고객 1곳에 알림/ }).click(); await p.waitForTimeout(800);
await p.getByRole('button', { name: /보내기|알림 보내기/ }).last().click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(2500);
ok('4 알림 기록 서버 저장', sql(`select '${coId}' = any(notified) from support_programs where id='bz_PBLN_FAKE00000'`) === 't');
sql(`update support_programs set notified = array_append(notified, '${coId}') where id='bz_PBLN_FAKE00001'`); // 담당자가 판단해 보낸 전국 공고
const { p: c } = await ctxFor(b, 'pc');
await login(c, ACC.c1, /\/portal/);
await c.goto(B + '/portal/programs', { waitUntil: 'domcontentloaded' }); await c.waitForTimeout(3000);
const sentTxt = await c.getByTestId('programs-sent').innerText().catch(() => '');
ok('4 고객: "담당 컨설턴트가 보낸 공고"에 알림 받은 공고', sentTxt.includes('화성시 시험용 제조기업 지원 0'), sentTxt.slice(0, 80));
ok('4 고객: 규칙 밖이라도 담당자가 보낸 공고는 보임(전국 수출)', sentTxt.includes('시험용 전국 수출 지원 1'));
ok('4 고객: "담당 컨설턴트 추천" 근거 표시', sentTxt.includes('담당 컨설턴트 추천'));
await c.goto(B + '/portal', { waitUntil: 'domcontentloaded' }); await c.waitForTimeout(2500);
ok('4 고객 홈: 담당자 추천 표시', (await c.getByTestId('program-teaser').innerText().catch(() => '')).includes('담당자 추천 2건'));

// 5 고객 PC 메뉴 — 잘리지 않음
for (const w of [1280, 1440, 1920]) {
  await c.setViewportSize({ width: w, height: 900 }); await c.waitForTimeout(400);
  const res = await c.evaluate(() => {
    const nav = document.querySelector('[data-testid="portal-nav"]');
    const links = [...nav.querySelectorAll('a')].filter((a) => getComputedStyle(a).display !== 'none');
    const clipped = links.filter((a) => a.scrollWidth > a.clientWidth + 1 || a.getBoundingClientRect().right > window.innerWidth).map((a) => a.textContent);
    return { shown: links.map((a) => a.textContent), clipped, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  const need = w >= 1280 ? ['홈', '내 프로젝트', '요청자료', '일정', '완료자료', '함께 검토', '지원사업', '문의하기'] : [];
  ok(`5 고객 PC ${w}px: 메뉴 ${res.shown.length}개 전부 보임·잘림 없음`, need.every((n) => res.shown.includes(n)) && res.clipped.length === 0 && res.over <= 0, `${res.shown.join('·')} ${res.clipped.join(',')}`);
}
await b.close();
process.exit(summary() ? 1 : 0);

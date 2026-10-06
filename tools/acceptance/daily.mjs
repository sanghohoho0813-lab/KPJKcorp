// 매일 쓰는 흐름 시험 — 컨설턴트가 실제로 하루에 여러 번 하는 일을 순서대로 눌러 본다 (데모 모드)
//  1) 대시보드에서 업무 한 줄 등록(기업·유형 자동 인식) → 체크로 완료 → 되돌리기
//  2) 업무함: 검색 · 기한 묶음 · 보류 → 다시 시작
//  3) 기업 상세: '지금 할 일'이 회사 정보보다 먼저 · 빠른 작업(업무 추가) → 할 일 목록에 바로
//  4) 같은 기업 중복 등록 막기 (이름 표기 차이 · 사업자번호)
//  5) 휴대폰: 기업 상세 첫 화면에 할 일이 보이는지 · 가로 넘침 · 페이지 오류
// 실행: npm run build && npm start (데모 모드) → node tools/acceptance/daily.mjs
import fs from 'fs';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
const B = process.env.APP_URL || 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0, failN = 0;
const ok = (name, cond, info = '') => { console.log(`${name}: ${cond ? 'OK' : 'FAIL'}${info ? ' ' + info : ''}`); cond ? okN++ : failN++; };

const browser = await pw.chromium.launch({ executablePath: CHROME });
async function session(kind) {
  const mobile = kind === 'mobile';
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT/.test(m.text())) page.errs.push(m.text()); });
  await page.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('park@kpjk.co.kr');
  await page.locator('input[type=password]').first().fill('kpjk2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/ax/**'); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  return page;
}
const dump = (page) => page.evaluate(() => window.__kpjkState());
const go = async (page, path) => { await page.goto(B + path, { waitUntil: 'networkidle' }); await sleep(700); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---------- PC ----------
{
  const page = await session('pc');
  await go(page, '/ax/dashboard');
  const card = page.locator('#today-tasks');
  ok('1 대시보드에 오늘 할 업무', await card.isVisible());
  const before = (await dump(page)).tasks.length;
  const input = card.getByLabel('새 업무 제목');
  await input.fill('에이정밀 대표님께 결과보고 일정 전화');
  await sleep(200);
  const guess = await card.getByTestId('quick-task-guess').innerText();
  ok('1 입력 중 기업·유형 미리 보임', /에이정밀\(주\)/.test(guess) && /후속연락/.test(guess), guess.replace(/\n/g, ' '));
  await input.press('Enter'); await sleep(500);
  let st = await dump(page);
  const t = st.tasks.find((x) => x.title === '에이정밀 대표님께 결과보고 일정 전화');
  ok('1 Enter 한 번으로 등록 (기업·유형·담당·기한)', st.tasks.length === before + 1 && t?.companyId === 'co_a' && t?.type === '후속연락' && t?.assigneeId === 'u_park' && new Date(t.dueDate).getHours() === 18, JSON.stringify(t && { c: t.companyId, ty: t.type }));
  ok('1 입력칸 비워지고 계속 입력 가능', (await input.inputValue()) === '' && (await input.evaluate((el) => el === document.activeElement)));
  ok('1 목록에 바로 보임', await card.getByText('에이정밀 대표님께 결과보고 일정 전화').isVisible());
  // 빈 칸 Enter — 아무것도 만들지 않음
  await input.press('Enter'); await sleep(300);
  ok('1 빈 칸 Enter는 등록 안 함', (await dump(page)).tasks.length === before + 1);
  // 완료 → 되돌리기
  await card.getByRole('button', { name: '에이정밀 대표님께 결과보고 일정 전화 완료' }).click(); await sleep(400);
  st = await dump(page);
  ok('1 체크하면 완료', st.tasks.find((x) => x.id === t.id)?.status === 'done' && !(await card.getByText('에이정밀 대표님께 결과보고 일정 전화').isVisible().catch(() => false)));
  await page.getByTestId('toast-action').getByRole('button', { name: '되돌리기' }).click(); await sleep(400);
  st = await dump(page);
  ok('1 되돌리기 → 원래 상태', st.tasks.find((x) => x.id === t.id)?.status === 'todo' && await card.getByText('에이정밀 대표님께 결과보고 일정 전화').isVisible());
  // 기업 연결 빼기
  await input.fill('씨엠푸드 말고 내부 회의 자료 정리'); await sleep(200);
  await card.getByRole('button', { name: '기업 연결 빼기' }).click(); await sleep(150);
  await input.press('Enter'); await sleep(400);
  st = await dump(page);
  ok('1 자동 연결을 빼면 내부 업무로', st.tasks.find((x) => x.title === '씨엠푸드 말고 내부 회의 자료 정리')?.companyId === undefined);

  // ---------- 업무함 ----------
  await go(page, '/ax/tasks');
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await sleep(300);
  const groups = await page.locator('[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
  ok('2 미완료는 기한으로 묶임', groups.length >= 1 && groups[0] !== 'done', groups.join(','));
  await page.getByLabel('업무 검색').fill('씨엠푸드'); await sleep(300);
  const titles = await page.locator('[data-group] .font-semibold').allInnerTexts();
  const rowsText = (await page.locator('[data-group]').allInnerTexts()).join('\n');
  ok('2 검색: 기업명으로 찾기', /씨엠푸드/.test(rowsText) && !/에이정밀 대표님께/.test(rowsText), String(titles.length));
  await page.getByLabel('업무 검색').fill('없는검색어zz'); await sleep(300);
  ok('2 검색 결과 없음 안내', await page.getByText(/‘없는검색어zz’에 맞는 업무가 없습니다/).isVisible());
  await page.getByLabel('업무 검색').fill('에이정밀 대표님께'); await sleep(300);
  await page.locator('[data-group]').getByRole('button', { name: '보류' }).first().click(); await sleep(400);
  ok('2 보류 필터가 생김', await page.getByRole('button', { name: /^보류 \d+$/ }).isVisible());
  await page.getByRole('button', { name: /^보류 \d+$/ }).click(); await sleep(300);
  await page.getByRole('button', { name: '다시 시작' }).first().click(); await sleep(400);
  st = await dump(page);
  ok('2 보류 → 다시 시작', st.tasks.find((x) => x.id === t.id)?.status === 'todo');

  // ---------- 기업 상세 ----------
  await go(page, '/ax/clients/co_a');
  const order = await page.evaluate(() => {
    const a = document.getElementById('client-todo'); const b = document.getElementById('client-profile');
    return a && b ? a.getBoundingClientRect().top < b.getBoundingClientRect().top : null;
  });
  ok('3 지금 할 일이 회사 정보보다 위', order === true);
  const todo = page.locator('#client-todo');
  ok('3 오늘 업무가 할 일에 모임', await todo.getByText('업무: 대표님께 결과보고 일정 전화').isVisible());
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '업무 추가' }).click(); await sleep(400);
  const dlg = page.getByRole('dialog');
  ok('3 업무 추가 창에 기업 선택칸 없음(이 기업으로 고정)', (await dlg.getByText('기업', { exact: true }).count()) === 0);
  await dlg.getByPlaceholder(/비앤테크 미제출/).fill('인건비 상세내역 2차 검토');
  await dlg.getByRole('button', { name: '오늘', exact: true }).click();
  await dlg.getByPlaceholder(/비앤테크 미제출/).press('Enter'); await sleep(500);
  st = await dump(page);
  const t2 = st.tasks.find((x) => x.title === '인건비 상세내역 2차 검토');
  ok('3 빠른 작업 → 이 기업 업무 · 유형 자동(자료검토) · 오늘', t2?.companyId === 'co_a' && t2?.type === '자료검토' && new Date(t2.dueDate).toDateString() === new Date().toDateString());
  ok('3 등록하자마자 할 일 목록에', await todo.getByText('업무: 인건비 상세내역 2차 검토').isVisible());
  for (const name of ['상담 기록', '자료 요청', '일정 등록']) {
    await page.getByTestId('client-quick-actions').getByRole('button', { name }).click(); await sleep(400);
    const open = await page.getByRole('dialog').isVisible();
    // 입력칸이 있는 창은 ESC로 닫히지 않는다(쓰던 내용 보호) — 취소 / X로 닫는다
    const d = page.getByRole('dialog');
    if (await d.getByRole('button', { name: '취소', exact: true }).count()) await d.getByRole('button', { name: '취소', exact: true }).last().click();
    else await d.getByRole('button', { name: /닫기/ }).first().click();
    await sleep(300);
    ok(`3 빠른 작업 '${name}' 창 열림`, open);
  }

  // ---------- 중복 등록 ----------
  await go(page, '/ax/clients');
  await page.getByRole('button', { name: '기업고객 등록' }).first().click(); await sleep(500);
  await page.getByPlaceholder('예: 주식회사 대한정밀').fill('주식회사 에이정밀');
  await page.getByPlaceholder('성명').first().fill('홍길동');
  await page.getByPlaceholder('000-00-00000').fill('0008100002');
  await page.getByRole('dialog').getByRole('button', { name: /^등록/ }).last().click(); await sleep(500);
  const dtext = await page.getByRole('dialog').innerText();
  ok('4 법인 표기만 다른 같은 이름 막음', /같은 이름의 기업이 이미 있습니다 — 에이정밀\(주\)/.test(dtext));
  ok('4 같은 사업자번호 막음', /같은 사업자번호로 이미 등록된 기업이 있습니다 — 비앤테크\(주\)/.test(dtext));
  ok('4 등록되지 않음', (await dump(page)).companies.filter((c) => /에이정밀/.test(c.name)).length === 1);
  await page.getByRole('dialog').getByRole('button', { name: /닫기/ }).first().click().catch(() => {}); await sleep(300);

  for (const p of ['/ax/dashboard', '/ax/tasks', '/ax/clients/co_a', '/ax/documents']) { await go(page, p); ok(`5 PC 가로 넘침 없음 ${p}`, (await overflow(page)) <= 0); }
  ok('5 PC 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 휴대폰 ----------
{
  const page = await session('mobile');
  await go(page, '/ax/clients/co_a');
  const top = await page.locator('#client-todo').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  ok('5 휴대폰: 기업 상세 첫 1.5화면 안에 지금 할 일', top < 844 * 1.5, `${Math.round(top)}px`);
  ok('5 휴대폰: 연락처 줄은 접혀 있음', !(await page.getByTestId('client-contact').isVisible()));
  await page.getByRole('button', { name: /연락처 · 번호 · 주소 보기/ }).click(); await sleep(200);
  ok('5 휴대폰: 펼치면 연락처 보임', await page.getByTestId('client-contact').isVisible());
  ok('5 휴대폰: 전화 바로 걸기', (await page.getByTestId('client-quick-actions').getByRole('link', { name: '전화' }).getAttribute('href'))?.startsWith('tel:010'));
  await go(page, '/ax/dashboard');
  const qt = page.locator('#today-tasks').getByLabel('새 업무 제목');
  await qt.fill('비앤테크 연구소 서류 검토'); await qt.press('Enter'); await sleep(400);
  const st = await dump(page);
  ok('5 휴대폰: 한 줄 등록', st.tasks.some((x) => x.title === '비앤테크 연구소 서류 검토' && x.companyId === 'co_b' && x.type === '자료검토'));
  for (const p of ['/ax/dashboard', '/ax/tasks', '/ax/clients/co_a', '/ax/clients/co_e', '/ax/documents']) { await go(page, p); ok(`5 휴대폰 가로 넘침 없음 ${p}`, (await overflow(page)) <= 0); }
  ok('5 휴대폰 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

await browser.close();
console.log(`\n== OK ${okN} / FAIL ${failN}`);
process.exit(failN ? 1 : 0);

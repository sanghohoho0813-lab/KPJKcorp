// 매일 쓰는 흐름 시험 — 컨설턴트가 실제로 하루에 여러 번 하는 일을 순서대로 눌러 본다 (데모 모드)
//  1) 대시보드에서 업무 한 줄 등록(기업·유형 자동 인식) → 체크로 완료 → 되돌리기
//  2) 업무함: 검색 · 기한 묶음 · 보류 → 다시 시작
//  3) 기업 상세: '지금 할 일'이 회사 정보보다 먼저 · 빠른 작업(업무 추가) → 할 일 목록에 바로
//  4) 같은 기업 중복 등록 막기 (이름 표기 차이 · 사업자번호)
//  5) 휴대폰: 기업 상세 첫 화면에 할 일이 보이는지 · 가로 넘침 · 페이지 오류
//  8) 정책자금 준비 서류: 묶음 요청(알림 한 번) → 고객 홈 한 줄 → 파일 여러 개 제출 → 검토 발급일 → 서류함·고객 준비됨
//  9) 공고 신청 묶음: 서류함 파일 → 신청일 기준 상태 → 공고문 서류 더하기 → zip(번호·서류명 + 서류목록) → 모자란 서류 요청(기한은 신청일 앞)
// 10) 경과 보고: 기업 상세 빠른 작업 → 기간 · 줄 고르기 · 한마디 → 미리 보기 · 카톡용 복사 → 고객에게 보내기(공지 · 홈 맨 위) → 고객 화면
// 11) 앱 안에서 넘어올 때 주소의 탭 · 창 열기(?tab= · ?kit= · ?report=1 · 지원사업 ?tab=leads) — 새로 고침 없이도 맞는 화면
// 실행: npm run build && npm start (데모 모드) → node tools/acceptance/daily.mjs
import fs from 'fs';
import { execFileSync } from 'child_process';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
const B = process.env.APP_URL || 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0, failN = 0;
const ok = (name, cond, info = '') => { console.log(`${name}: ${cond ? 'OK' : 'FAIL'}${info ? ' ' + info : ''}`); cond ? okN++ : failN++; };

// 한글 파일 이름(내려받기·올리기)은 브라우저가 UTF-8 언어 설정일 때만 그대로 나온다 — 아니면 'download'로 바뀐다
const browser = await pw.chromium.launch({ executablePath: CHROME, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
async function session(kind, who = ['park@kpjk.co.kr', 'kpjk2026!']) {
  const mobile = kind === 'mobile';
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kpjk-test', '1'); } catch {} });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT/.test(m.text())) page.errs.push(m.text()); });
  await page.route('**/*', (r) => (r.request().url().startsWith(B) ? r.continue() : r.abort()));
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill(who[0]);
  await page.locator('input[type=password]').first().fill(who[1]);
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
  const kpiToday = Number((await page.locator('#kpi-today').innerText()).match(/\d+/)?.[0]);
  const listToday = Number((await card.innerText()).match(/오늘 할 업무\s*(\d+)건/)?.[1]);
  ok('1 대시보드 첫 칸 "오늘 할 업무" 숫자 = 목록 건수', kpiToday === listToday && kpiToday > 0, `${kpiToday} / ${listToday}`);
  ok('1 오늘 할 업무가 첫 화면(900px) 안', (await card.evaluate((e) => e.getBoundingClientRect().top)) < 900);
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

  // ---------- 상담 기록 → 후속 업무 · 자료 요청 ----------
  await go(page, '/ax/clients/co_a');
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '상담 기록' }).click(); await sleep(400);
  const cd = page.getByRole('dialog');
  await cd.getByPlaceholder(/김민석 대표와 원가구조/).fill('중간보고 뒤 절세 방향 논의');
  const lists = cd.getByPlaceholder('한 줄씩 입력 후 Enter');
  await lists.nth(2).click(); await page.keyboard.type('다음 주 화요일까지 절세 시뮬레이션 전달'); await page.keyboard.press('Enter');
  await lists.nth(3).click(); await page.keyboard.type('주주명부'); await page.keyboard.press('Enter');
  await cd.getByPlaceholder('예: 제안서 송부 및 계약 협의').fill('제안서 송부 후 대표님께 전화');
  await sleep(200);
  const fb = cd.getByTestId('consult-followups');
  const chk = async (k) => fb.locator(`input[data-follow=${k}]`).first().isChecked();
  ok('6 저장 전에 만들 것 미리 보임 (다음 Action · 약속 · 자료)', (await fb.locator('input[data-follow]').count()) === 3, await fb.innerText().then((t) => t.replace(/\n/g, ' ').slice(0, 120)));
  ok('6 기본: 업무 켜짐 · 고객 자료 요청 꺼짐', (await chk('next')) && (await chk('promise')) && !(await chk('doc')));
  await fb.locator('input[data-follow=doc]').check();
  let s0 = await dump(page);
  const tasks0 = s0.tasks.length, docs0 = s0.docRequests.length;
  await cd.getByRole('button', { name: '저장', exact: true }).click(); await sleep(600);
  let s1 = await dump(page);
  const csT = s1.tasks.filter((x) => x.ruleKey?.startsWith('cs:'));
  const nextT = csT.find((x) => x.title.includes('제안서 송부 후 대표님께 전화'));
  const promT = csT.find((x) => x.title.includes('약속: 다음 주 화요일까지 절세 시뮬레이션 전달'));
  ok('6 저장 한 번 → 업무 2건 (다음 Action · 약속)', s1.tasks.length === tasks0 + 2 && !!nextT && !!promT);
  ok('6 업무: 이 기업 · 담당 컨설턴트 · 유형 자동 · 기한 3일 뒤', nextT?.companyId === 'co_a' && nextT?.assigneeId === 'u_park' && nextT?.type === '후속연락' && new Date(nextT.dueDate).toDateString() === new Date(Date.now() + 3 * 864e5).toDateString(), JSON.stringify(nextT && { t: nextT.type, a: nextT.assigneeId }));
  ok('6 업무 메모에 어느 상담에서 나왔는지', /상담에서 정한 다음 Action/.test(nextT?.memo ?? '') && /상담에서 약속한 것/.test(promT?.memo ?? ''));
  const dr = s1.docRequests.find((d) => d.companyId === 'co_a' && d.name === '주주명부');
  ok('6 고객 자료 요청 1건 + 고객 알림', s1.docRequests.length === docs0 + 1 && dr?.status === 'requested' && s1.notifications.some((n) => n.audience === 'client' && n.companyId === 'co_a' && /주주명부/.test(n.body)));
  ok('6 한글 목록 입력이 잘리지 않음', s1.consultations[0]?.summary.promises[0] === '다음 주 화요일까지 절세 시뮬레이션 전달' && s1.consultations[0]?.summary.documents[0] === '주주명부');
  // 수정해서 다시 저장 — 이미 만든 것은 다시 안 만들고, 새로 적은 약속만
  await go(page, '/ax/consultations');
  await page.getByRole('button', { name: '상담기록 수정' }).first().click(); await sleep(400);
  const ed = page.getByRole('dialog');
  ok('6 수정 창이 방금 기록', (await ed.locator('textarea').first().inputValue()) === '중간보고 뒤 절세 방향 논의');
  const efb = ed.getByTestId('consult-followups');
  ok('6 이미 만든 항목은 표시되고 잠김', (await efb.locator('input[data-follow]:disabled').count()) === 3 && /이미 등록됨/.test(await efb.innerText()) && /이미 요청 중/.test(await efb.innerText()));
  await ed.getByPlaceholder('한 줄씩 입력 후 Enter').nth(2).click(); await page.keyboard.type('계약서 초안 공유'); await page.keyboard.press('Enter');
  await ed.getByRole('button', { name: '저장', exact: true }).click(); await sleep(600);
  const s2 = await dump(page);
  ok('6 다시 저장해도 중복 없음 · 새 약속만 1건', s2.tasks.length === s1.tasks.length + 1 && s2.tasks.some((x) => x.title.includes('약속: 계약서 초안 공유')) && s2.docRequests.length === s1.docRequests.length);
  await go(page, '/ax/tasks');
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await page.getByLabel('업무 검색').fill('제안서 송부 후'); await sleep(300);
  ok('6 업무함에 상담 후속 표시', await page.locator('[data-group]').getByText('상담 후속').first().isVisible());

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

// ---------- 고객 연락 공백 (대표 · PC) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  // 샘플 기업은 모두 이미 열린 후속연락 업무가 있어 규칙이 건너뛴다(정상). 에프물류의 열린 업무를 보류해 '연락 공백'을 만든다
  await go(page, '/ax/tasks');
  await page.getByRole('button', { name: '미완료', exact: true }).click();
  await page.getByLabel('업무 검색').fill('에프물류'); await sleep(300);
  for (let i = 0; i < 6; i++) {
    const hold = page.locator('[data-group]').getByRole('button', { name: '보류', exact: true });
    if (!(await hold.count())) break;
    await hold.first().click(); await sleep(250);
  }
  ok('7 준비: 에프물류 열린 업무 없음', !(await dump(page)).tasks.some((t) => t.companyId === 'co_f' && (t.status === 'todo' || t.status === 'doing')));
  await go(page, '/ax/settings');
  const grp = page.getByRole('group', { name: '연락 규칙 기준일' });
  ok('7 설정에 연락 공백 규칙 · 기본 21일', (await grp.getByRole('button', { name: '21일 · 기본' }).getAttribute('aria-pressed')) === 'true');
  await grp.getByRole('button', { name: '7일', exact: true }).click(); await sleep(300);
  await page.getByRole('button', { name: '지금 확인' }).click(); await sleep(500);
  let st = await dump(page);
  const nc = st.tasks.filter((t) => t.ruleKey?.startsWith('no_contact:'));
  ok('7 기준 7일 → 연락 공백 업무 생성', nc.length >= 1, nc.map((t) => t.title).join(' / '));
  ok('7 업무: 담당 컨설턴트 · 후속연락 · 마지막 연락 근거', nc.every((t) => t.type === '후속연락' && t.assigneeId === st.companies.find((c) => c.id === t.companyId)?.consultantId && /마지막 연락: .+\(.+\)/.test(t.memo ?? '')));
  const perCo = new Set(nc.map((t) => t.companyId));
  ok('7 기업마다 한 건 · 이미 후속연락이 잡힌 기업은 건너뜀', perCo.size === nc.length && nc.every((t) => st.tasks.filter((x) => x.companyId === t.companyId && x.type === '후속연락' && (x.status === 'todo' || x.status === 'doing')).length === 1));
  await page.getByRole('button', { name: '지금 확인' }).click(); await sleep(400);
  ok('7 다시 확인해도 중복 없음', (await dump(page)).tasks.filter((t) => t.ruleKey?.startsWith('no_contact:')).length === nc.length);

  await go(page, '/ax/clients');
  const lbl = await page.getByRole('button', { name: /^연락 필요/ }).innerText();
  await page.getByRole('button', { name: /^연락 필요/ }).click(); await sleep(400);
  const cards = page.locator('a[href^="/ax/clients/co_"]');
  const n0 = await cards.count();
  ok('7 기업고객 "연락 필요" 필터', n0 >= 1 && lbl.includes(String(n0)), `${lbl} / ${n0}`);
  await go(page, '/ax/dashboard');
  const kpiContact = Number((await page.locator('#kpi-contact').innerText()).match(/\d+/)?.[0]);
  ok('7 대시보드 "연락 필요" 숫자 = 목록', kpiContact === n0, `${kpiContact} / ${n0}`);
  const target = nc[0].companyId;
  await go(page, `/ax/clients/${target}`);
  ok('7 기업 상세에 연락 공백 표시', /연락 \d+일 없음/.test(await page.getByTestId('contact-line').first().innerText()));
  await page.getByTestId('client-quick-actions').getByRole('button', { name: '연락함' }).click(); await sleep(300);
  const d = page.getByRole('dialog');
  await d.getByRole('radio', { name: '카톡·문자' }).click();
  await d.getByPlaceholder(/중간보고 일정 안내/).fill('진행 상황 공유, 다음 주 통화 약속');
  await d.getByRole('button', { name: '기록', exact: true }).click(); await sleep(500);
  st = await dump(page);
  const j = st.journal.find((x) => x.companyId === target && x.type === 'call');
  ok('7 연락함 → 업무 일기 통화 기록', j?.content === '[카톡·문자] 진행 상황 공유, 다음 주 통화 약속');
  ok('7 열려 있던 연락 업무가 완료로', st.tasks.find((t) => t.id === nc[0].id)?.status === 'done');
  ok('7 마지막 연락이 오늘로', /마지막 연락 오늘/.test(await page.getByTestId('contact-line').first().innerText()));
  await go(page, '/ax/clients?filter=contact');
  ok('7 연락 필요에서 빠짐', (await page.locator(`a[href="/ax/clients/${target}"]`).count()) === 0);
  await go(page, '/ax/settings');
  await page.getByRole('button', { name: '지금 확인' }).click(); await sleep(400);
  ok('7 연락한 기업엔 새 업무 안 생김', (await dump(page)).tasks.filter((t) => t.ruleKey?.startsWith(`no_contact:${target}:`)).length === 1);
  ok('7 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 정책자금 준비 서류 (대표 PC → 고객 → 대표 검토 · 발급일 → 고객 준비됨) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const storeKey = () => page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  const relogin = async (id, pwd, to) => {
    const k = await storeKey();
    await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.session = null; localStorage.setItem(key, JSON.stringify(s)); }, k);
    await page.goto(B + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('아이디 (이메일)').fill(id);
    await page.locator('input[type=password]').first().fill(pwd);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(to); await sleep(1200);
    await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
    await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  };
  const dlg = () => page.locator('[role=dialog]:visible').last();
  await go(page, '/ax/clients/co_a');
  ok('8 기업 상세 빠른 작업에 정책자금 서류', await page.getByTestId('client-quick-actions').getByRole('button', { name: '정책자금 서류' }).isVisible());
  await go(page, '/ax/clients/co_a?tab=vault');
  const badge0 = await page.getByTestId('policy-ready').innerText();
  await page.locator('#vault-tab').getByRole('button', { name: '정책자금 서류', exact: true }).click(); await sleep(400);
  const plan = dlg().getByTestId('policy-plan');
  ok('8 요청 창: 서류 목록', (await plan.locator('[data-policy]').count()) >= 8, badge0);
  ok('8 신청 직전 서류(납세증명)는 기본 꺼짐', !(await plan.locator('[data-policy=taxCert] input').isChecked()));
  const s0 = await dump(page);
  const btn = dlg().getByRole('button', { name: /개 요청$/ });
  const n = Number((await btn.innerText()).match(/(\d+)개/)?.[1] ?? 0);
  await btn.click(); await sleep(600);
  const s1 = await dump(page);
  const added = s1.docRequests.filter((d) => !s0.docRequests.some((x) => x.id === d.id));
  const notes = s1.notifications.filter((x) => !s0.notifications.some((y) => y.id === x.id) && x.audience === 'client');
  ok('8 요청 N건 · 모두 정책자금 준비 표시', n >= 3 && added.length === n && added.every((d) => d.companyId === 'co_a' && d.description.startsWith('정책자금 준비 서류 — ')), `${n}건`);
  ok('8 고객 알림은 한 번', notes.length === 1 && notes[0].title === `정책자금 준비 서류 ${n}개를 요청드렸습니다` && notes[0].href.endsWith('#policy-docs'));
  const vault1 = s1.companyVaults.find((v) => v.companyId === 'co_a');
  ok('8 서류함에 없던 칸은 만듦', added.every((d) => [...['사업자등록증', '법인등기부등본', '대표자 신분증 사본', '공동인증서', '중소기업 확인서', '대표자 건강보험 자격득실확인서'], ...(vault1?.customSlots ?? []).map((c) => c.label)].includes(d.name)));
  await page.locator('#vault-tab').getByRole('button', { name: '정책자금 서류', exact: true }).click(); await sleep(400);
  ok('8 다시 열면 요청한 서류는 잠김', (await dlg().getByTestId('policy-plan').locator('input:disabled').count()) >= n);
  await dlg().getByRole('button', { name: '취소' }).click(); await sleep(300);

  // 고객: 홈에 한 줄 → 자료제출 카드 → 파일 두 개를 한 번에
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await go(page, '/portal');
  const na = await page.getByTestId('now-actions').innerText();
  ok('8 고객 홈: 준비 서류는 한 줄', na.includes(`정책자금 서류 ${n}개 올리기`) && !added.some((d) => na.includes(`${d.name} 올리기`)), na.replace(/\n/g, ' / ').slice(0, 160));
  await page.getByTestId('now-actions').getByText(`정책자금 서류 ${n}개 올리기`).click(); await sleep(1200);
  ok('8 누르면 자료제출의 준비 서류 카드로', /\/portal\/documents#policy-docs/.test(page.url()) && await page.locator('#policy-docs').isVisible());
  ok('8 준비 0/N', (await page.getByTestId('policy-count').innerText()) === `준비 0/${n}`);
  const fin = page.locator('[data-policy-doc=finStmt]');
  ok('8 발급처 안내가 보임', /홈택스 › 민원증명 › 표준재무제표증명/.test(await fin.innerText()));
  await fin.getByRole('button', { name: '올리기' }).click(); await sleep(400);
  await dlg().getByRole('button', { name: '데모용 샘플 파일 사용' }).click();
  await dlg().getByRole('button', { name: '데모용 샘플 파일 사용' }).click(); await sleep(200);
  await dlg().getByRole('button', { name: '2개 제출하기' }).click(); await sleep(700);
  let st = await dump(page);
  const finReq = st.docRequests.find((d) => d.id === added.find((x) => x.name.startsWith('표준재무제표증명'))?.id);
  ok('8 파일 두 개를 한 번에 제출', finReq?.status === 'submitted' && finReq.files.length === 2 && finReq.files.map((f) => f.version).join() === '1,2');
  ok('8 담당자 검토 업무는 한 건', st.tasks.filter((t) => t.title.includes('표준재무제표증명') && t.source === 'auto').length === 1);
  await page.locator('[data-policy-doc=insList]').getByRole('button', { name: '올리기' }).click(); await sleep(400);
  await dlg().getByRole('button', { name: '데모용 샘플 파일 사용' }).click(); await sleep(200);
  await dlg().getByRole('button', { name: '제출하기', exact: true }).click(); await sleep(700);
  ok('8 제출하면 확인 중', (await page.locator('[data-policy-doc=insList]').getAttribute('data-state')) === 'checking');

  // 대표: 검토 — 유효기간 있는 서류는 발급일을 넣는다 → 서류함 칸에 발급일
  await relogin('ceo@kpjk.co.kr', 'kpjk2026!', /\/ax\//);
  await go(page, '/ax/documents');
  const issued = new Date(Date.now() - 6 * 864e5); const ymd = `${issued.getFullYear()}-${String(issued.getMonth() + 1).padStart(2, '0')}-${String(issued.getDate()).padStart(2, '0')}`;
  await page.locator('[data-doc-row]').filter({ hasText: '4대보험 사업장 가입자 명부' }).first().click(); await sleep(400);
  ok('8 유효기간 있는 서류 검토: 발급일 칸', await dlg().getByTestId('review-issued').isVisible());
  await dlg().getByTestId('review-issued').fill(ymd);
  await dlg().getByRole('button', { name: '검토 완료' }).click(); await sleep(500);
  await page.locator('[data-doc-row]').filter({ hasText: '표준재무제표증명' }).first().click(); await sleep(400);
  ok('8 유효기간 없는 서류는 발급일 칸 없음', (await dlg().getByTestId('review-issued').count()) === 0);
  await dlg().getByRole('button', { name: '검토 완료' }).click(); await sleep(500);
  st = await dump(page);
  const v2 = st.companyVaults.find((v) => v.companyId === 'co_a');
  const insSlot = v2.customSlots.find((c) => c.label === '4대보험 사업장 가입자 명부');
  ok('8 서류함: 받음 · 발급일 · 유효 1개월', !!insSlot && v2.slots[insSlot.key]?.received === true && v2.slots[insSlot.key]?.issuedAt === ymd && insSlot.validMonths === 1);
  await go(page, '/ax/clients/co_a?tab=vault');
  const badge1 = await page.getByTestId('policy-ready').innerText();
  ok('8 서류함 정책자금 준비 숫자가 늘어남', Number(badge1.match(/(\d+)\//)[1]) === Number(badge0.match(/(\d+)\//)[1]) + 2, `${badge0} → ${badge1}`);

  // 고객: 준비됨 2 · 휴대폰 가로 넘침 없음
  await relogin('ceo@a-precision.demo', 'client2026!', /\/portal/);
  await go(page, '/portal/documents');
  ok('8 고객 화면 준비 2/N', (await page.getByTestId('policy-count').innerText()) === `준비 2/${n}`);
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  ok('8 휴대폰 자료제출 가로 넘침 없음', (await overflow(page)) <= 0);
  ok('8 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 공고 신청 묶음 (대표 PC: 서류함 파일 → 신청일 기준 점검 → zip → 모자란 서류 요청) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const dlg = () => page.locator('[role=dialog]:visible').last();
  const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const applyOn = ymdOf(new Date(Date.now() + 20 * 864e5));
  await go(page, '/ax/clients/co_a?tab=vault');
  // 서류함 사업자등록증 칸에 파일 하나
  await page.getByRole('button', { name: '사업자등록증 파일 올리기' }).click(); await sleep(400);
  await dlg().getByLabel('서류 파일').setInputFiles({ name: '사업자등록증.txt', mimeType: 'text/plain', buffer: Buffer.from('사업자등록증 시험 파일 KIT-OK') });
  await dlg().getByRole('button', { name: /고른 것 전부 올리기 \(1\)/ }).click({ timeout: 8000 }); await sleep(900);
  let st = await dump(page);
  ok('9 서류함에 파일 올림', st.companyFiles.some((f) => f.companyId === 'co_a' && f.slot === 'bizReg' && f.fileName === '사업자등록증.txt'));

  await page.locator('#vault-tab').getByRole('button', { name: '정책자금 서류', exact: true }).click(); await sleep(400);
  await dlg().getByTestId('policy-mode').getByRole('button', { name: '공고 신청 묶음' }).click(); await sleep(300);
  ok('9 공고 신청 묶음 열림', await dlg().getByTestId('apply-kit').isVisible());
  await dlg().getByLabel('공고', { exact: true }).selectOption('__manual');
  await dlg().getByLabel('공고명').fill('시험용 공고(자동 검수)');
  await dlg().getByLabel('신청 예정일').fill(applyOn); await sleep(300);
  const state = (k) => dlg().locator(`[data-kit="${k}"]`).getAttribute('data-state');
  ok('9 사업자등록증: 파일 있음', (await state('bizReg')) === 'ready');
  ok('9 신청 직전 서류(납세증명): 20일 뒤 신청이면 지금 요청 체크', (await state('taxCert')) === 'justBefore' && await dlg().getByLabel('납세증명서 요청', { exact: true }).isChecked());
  await dlg().getByLabel('더할 서류 이름').fill('수출실적증명서');
  await dlg().getByRole('button', { name: '더하기' }).click(); await sleep(300);
  ok('9 공고문 서류 더하기', (await state('x:수출실적증명서')) === 'missing');
  ok('9 요약판: 파일 준비 1개 이상', /파일 준비/.test(await dlg().getByTestId('kit-summary').innerText()));

  // zip 내려받기 → 열어 본다
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg().getByRole('button', { name: /내려받기$/ }).click()]);
  const zpath = await dl.path();
  const inside = JSON.parse(execFileSync('python3', ['-I', '-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n: z.read(n)[:40].decode("utf-8","replace") for n in z.namelist()}))', zpath]).toString());
  const names = Object.keys(inside);
  ok('9 zip 이름: 기업_공고_날짜', /^에이정밀\(주\)_시험용공고\(자동검수\)_\d{8}\.zip$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('9 zip 안: 서류목록 + 번호·서류명 파일(내용 그대로)', names[0] === '00_서류목록.xlsx' && inside['01_사업자등록증.txt']?.includes('KIT-OK'), names.join(', '));
  st = await dump(page);
  ok('9 내려받은 기록(내부 전용)', st.activities.some((a) => a.type === 'vault_updated' && a.companyId === 'co_a' && a.text.includes('신청 서류 묶음 내려받음: 시험용 공고(자동 검수)')));

  // 모자란 서류 요청 — 기한은 신청일 앞, 알림 한 번(공고명)
  const s0 = st;
  const reqBtn = dlg().getByRole('button', { name: /모자란 서류 \d+개 요청/ });
  const n = Number((await reqBtn.innerText()).match(/(\d+)개/)?.[1] ?? 0);
  await reqBtn.click(); await sleep(600);
  st = await dump(page);
  const added = st.docRequests.filter((d) => !s0.docRequests.some((x) => x.id === d.id));
  const notes = st.notifications.filter((x) => !s0.notifications.some((y) => y.id === x.id) && x.audience === 'client');
  ok('9 요청 N건 · 기한은 모두 신청일 이전', n >= 2 && added.length === n && added.every((d) => d.companyId === 'co_a' && d.dueDate.slice(0, 10) <= applyOn), `${n}건`);
  ok('9 더한 서류 요청 문구에 공고명', added.some((d) => d.name === '수출실적증명서' && d.description.includes('시험용 공고(자동 검수)')));
  ok('9 고객 알림 한 번 · 공고명', notes.length === 1 && notes[0].title.includes('시험용 공고(자동 검수)'), notes[0]?.title);
  ok('9 요청한 서류는 요청 중으로', (await state('x:수출실적증명서')) === 'open');

  // 지원사업 매칭의 '서류 묶음' 링크(?kit=)로 들어오면 바로 신청 묶음이 열린다
  await go(page, '/ax/clients/co_a?tab=vault&kit=none');
  ok('9 ?kit= 로 들어오면 신청 묶음으로 열림', await dlg().getByTestId('apply-kit').isVisible());
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  ok('9 휴대폰 신청 묶음 가로 넘침 없음', (await overflow(page)) <= 0);
  ok('9 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 경과 보고 (대표 PC → 고객 화면) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B });
  const dlg = () => page.locator('[role=dialog]:visible').last();
  await go(page, '/ax/tasks');
  let st = await dump(page);
  const ruleTask = st.tasks.find((t) => t.companyId === 'co_a' && t.ruleKey?.startsWith('progress_report:') && t.status === 'todo');
  ok('10 규칙 업무: 경과 보고 공백 → 보내기 업무가 있음', !!ruleTask && ruleTask.type === '보고서' && ruleTask.source === 'auto', ruleTask?.title);
  await page.getByRole('button', { name: '미완료', exact: true }).click(); await sleep(400);
  const write = page.locator('a[href="/ax/clients/co_a?report=1"]:visible').first();
  ok('10 업무함: 경과 보고 업무에 보고 쓰기', await write.isVisible());
  await write.click(); await page.waitForURL(/\/ax\/clients\/co_a\?report=1/); await sleep(900);
  const qa = page.getByTestId('client-quick-actions').getByRole('button', { name: '경과 보고' });
  ok('10 보고 쓰기 → 그 기업 보고 창이 바로 열림 · 빠른 작업에도 경과 보고', await dlg().getByTestId('report-lines').isVisible() && await qa.isVisible());
  const lines = dlg().getByTestId('report-lines');
  const sections = await lines.locator('[data-report-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-report-section')));
  ok('10 진행 상황 · 한 일 · 부탁드릴 것 묶음이 채워짐', sections.includes('now') && sections.includes('done') && sections.includes('ask'), sections.join(','));
  const openReqs = st.docRequests.filter((d) => d.companyId === 'co_a' && (d.status === 'requested' || d.status === 'revision'));
  const askN = await lines.locator('[data-report-section=ask] [data-line]').count();
  ok('10 부탁드릴 것 = 남은 요청자료', askN === Math.min(openReqs.length, 5) + (openReqs.length > 5 ? 1 : 0), `${askN} / ${openReqs.length}`);
  const first = lines.locator('[data-report-section=done] [data-line]').first();
  const offText = (await first.innerText()).trim();
  await first.locator('input').uncheck();
  await dlg().getByLabel('담당자 한마디').fill('시험용 한마디 REPORT-OK');
  await dlg().getByTestId('report-view').getByRole('button', { name: '고객 화면 미리 보기' }).click(); await sleep(300);
  const pv = await dlg().getByTestId('report-preview').innerText();
  ok('10 미리 보기: 제목 · 한마디 · 뺀 줄 없음', /경과 보고 · \d+\/\d+ ~ \d+\/\d+/.test(pv) && pv.includes('REPORT-OK') && !pv.includes(offText), offText);
  await dlg().getByRole('button', { name: '카톡용 복사' }).click(); await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok('10 카톡용 복사: 제목 · 본문 · 고객 화면 주소', clip.startsWith('경과 보고 ·') && clip.includes('REPORT-OK') && clip.includes('/portal/schedule#notices'));
  const s0 = await dump(page);
  await dlg().getByRole('button', { name: '고객에게 보내기' }).click(); await sleep(600);
  st = await dump(page);
  const sent = st.notices.filter((n) => !s0.notices.some((x) => x.id === n.id));
  const r1 = sent[0];
  ok('10 공지 한 건 · 이 기업 · 홈 고정', sent.length === 1 && r1.companyId === 'co_a' && r1.pinned === true && r1.title.startsWith('경과 보고 ·'));
  ok('10 본문: 묶음 제목 · 한마디 · 서명 · 뺀 줄 없음', r1.body.includes('■ 지금 진행 상황') && r1.body.includes('■ 담당자 한마디\n시험용 한마디 REPORT-OK') && /\n— 담당 /.test(r1.body) && !r1.body.includes(offText));
  const hidden = [
    ...st.schedules.filter((x) => x.companyId === 'co_a' && !x.visibleToClient).map((x) => x.title),
    ...st.tasks.filter((x) => x.companyId === 'co_a').map((x) => x.title),
    ...(st.journal ?? []).filter((x) => x.companyId === 'co_a').map((x) => x.body ?? x.text ?? '').filter((t) => t.length > 8).map((t) => t.slice(0, 30)),
  ];
  ok('10 내부 일정 · 업무 · 업무 일기는 본문에 없음', hidden.length > 0 && hidden.every((t) => !r1.body.includes(t)), `${hidden.length}건 확인`);
  const notes = st.notifications.filter((x) => !s0.notifications.some((y) => y.id === x.id));
  ok('10 고객 알림 한 번', notes.length === 1 && notes[0].audience === 'client' && notes[0].companyId === 'co_a');
  ok('10 보내면 규칙 업무는 끝남', st.tasks.find((t) => t.id === ruleTask?.id)?.status === 'done');
  // 다시 열면 '지난 보고 이후'가 기본 · 두 번째로 보내면 앞 보고 고정은 풀림
  await qa.click(); await sleep(500);
  ok('10 다시 열면 지난 보고 이후', /지난 보고 \d+\/\d+ \(0일 전\)/.test(await dlg().getByTestId('report-range').innerText()));
  await dlg().getByRole('button', { name: '고객에게 보내기' }).click(); await sleep(600);
  st = await dump(page);
  const reports = st.notices.filter((n) => n.companyId === 'co_a' && n.title.startsWith('경과 보고'));
  ok('10 홈 고정은 가장 최근 보고 하나', reports.length === 2 && reports.filter((n) => n.pinned).length === 1 && !st.notices.find((n) => n.id === r1.id).pinned);
  await go(page, '/ax/tasks'); st = await dump(page);
  ok('10 보낸 뒤에는 규칙 업무를 다시 만들지 않음', st.tasks.filter((t) => t.companyId === 'co_a' && t.ruleKey?.startsWith('progress_report:') && t.status !== 'done').length === 0);

  // 고객: 홈 고정 띠 → 일정 · 공지에서 제목 · 목록으로 보임
  const storeKey = await page.evaluate(() => Object.keys(localStorage).find((k) => { try { return !!JSON.parse(localStorage.getItem(k) ?? 'null')?.state; } catch { return false; } }));
  await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.state.session = null; localStorage.setItem(key, JSON.stringify(s)); }, storeKey);
  await page.goto(B + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('아이디 (이메일)').fill('ceo@a-precision.demo');
  await page.locator('input[type=password]').first().fill('client2026!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/portal/); await sleep(1200);
  await page.getByRole('button', { name: /건너뛰기/ }).first().click({ timeout: 800 }).catch(() => {});
  await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 800 }).catch(() => {});
  await go(page, '/portal');
  const strip = page.getByTestId('pinned-strip');
  ok('10 고객 홈 맨 위: 담당자 경과 보고', /담당자 경과 보고/.test(await strip.innerText()) && /경과 보고 ·/.test(await strip.innerText()));
  await strip.click(); await sleep(1200);
  const body = page.locator('#notices [data-notice-body]').filter({ hasText: 'REPORT-OK' }).first();
  ok('10 고객 화면: 첫 보고 본문(한마디 포함)', await body.isVisible());
  const latest = page.locator('#notices [data-notice-body]').first();
  ok('10 고객 화면: 묶음 제목은 굵은 제목 · 줄은 목록', (await latest.locator('div.font-bold').filter({ hasText: '지금 진행 상황' }).count()) === 1 && (await latest.locator('div.flex.gap-2').count()) >= 2);
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(500);
  ok('10 휴대폰 일정 · 공지 가로 넘침 없음', (await overflow(page)) <= 0);
  ok('10 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

// ---------- 앱 안 이동: 주소의 탭 · 창 (새로 고침 없이) ----------
{
  const page = await session('pc', ['ceo@kpjk.co.kr', 'kpjk2026!']);
  const push = async (u) => { await page.evaluate((x) => window.next.router.push(x), u); await sleep(1500); };
  await go(page, '/ax/dashboard');
  await push('/ax/clients/co_a?tab=vault');
  ok('11 ?tab=vault → 서류함 탭', await page.locator('#vault-tab').isVisible());
  await go(page, '/ax/dashboard');
  await push('/ax/clients/co_a?tab=vault&kit=none');
  ok('11 ?kit= → 공고 신청 묶음 창', await page.getByTestId('apply-kit').isVisible());
  await go(page, '/ax/dashboard');
  await push('/ax/programs?tab=leads');
  ok('11 지원사업 ?tab=leads → 가망고객 탭', (await page.getByRole('tab', { name: /가망고객/ }).getAttribute('aria-selected')) === 'true');
  ok('11 페이지 오류 없음', page.errs.length === 0, page.errs.slice(0, 2).join(' | '));
}

await browser.close();
console.log(`\n== OK ${okN} / FAIL ${failN}`);
process.exit(failN ? 1 : 0);

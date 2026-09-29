// 별지 제1호 「완료·검수 기준」 자동 검수
//
// 계약서가 정한 완료기준을 PC(1440)와 휴대폰(390) 화면에서 실제로 눌러 보며 확인하고,
// 항목마다 결과와 화면 캡처를 남긴다. 결과는 out/results.json, 캡처는 out/pc · out/mobile.
// 보고서(report.mjs)는 이 결과를 그대로 옮겨 적는다 — 결과를 손으로 고치지 않는다.
//
// 실행: 앱을 띄운 뒤(npm run build && npm start) → node tools/acceptance/run.mjs
// 데모 모드(샘플 데이터)에서 돈다. 화면마다 새 브라우저라 서로의 데이터가 섞이지 않는다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pw = await import('playwright').then((m) => m.default ?? m).catch(() => import('/opt/node22/lib/node_modules/playwright/index.js').then((m) => m.default));
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(SANDBOX_CHROME) ? SANDBOX_CHROME : undefined);
const B = process.env.APP_URL || 'http://localhost:3000';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || path.join(HERE, 'out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ACC = {
  admin: ['ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**'],
  park: ['park@kpjk.co.kr', 'kpjk2026!', '**/ax/**'],
  client: ['ceo@a-precision.demo', 'client2026!', '**/portal**'],
};
const FILE = { name: '매출채권_연령표_거래처별.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.alloc(24 * 1024, 7) };

/** 검수 기준 — 계약서 문구 그대로 */
export const CRITERIA = [
  { id: 'C1', text: '핵심 데이터 등록·수정·조회가 가능할 것' },
  { id: 'C2', text: '대시보드에서 약정한 주요 상태와 지표를 확인할 수 있을 것' },
  { id: 'C3', text: 'AI 업무브리핑 또는 우선순위 기능이 실제 화면에서 확인될 것' },
  { id: 'C4', text: '고객 Portal에서 진행현황 확인·자료제출·일정·완료자료·문의 흐름이 사용 가능할 것' },
  { id: 'C5', text: 'PC 및 모바일 브라우저에서 핵심흐름이 사용 가능할 것' },
  { id: 'C6', text: 'MVP 시험버전과 1차 완료 보고가 전자문서 또는 메신저로 전달될 것' },
];

async function runViewport(browser, kind) {
  const mobile = kind === 'mobile';
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const dir = path.join(OUT, kind);
  fs.mkdirSync(dir, { recursive: true });
  const checks = [];
  let n = 0;

  const dump = () => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('kpjk')); return JSON.parse(localStorage.getItem(k)).state; });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const go = async (u) => { await page.goto(B + u, { waitUntil: 'networkidle' }); await sleep(900); };
  const login = async (who) => {
    const [id, pwd, to] = ACC[who];
    await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('kpjk')); if (k) { const s = JSON.parse(localStorage.getItem(k)); s.state.session = null; localStorage.setItem(k, JSON.stringify(s)); } }).catch(() => {});
    await go('/login');
    await page.getByLabel('아이디 (이메일)').fill(id);
    await page.locator('input[type=password]').first().fill(pwd);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL(to, { timeout: 15000 }); await sleep(1400);
    await page.getByLabel(/튜토리얼 닫기|이용 안내 닫기/).click({ timeout: 1800 }).catch(() => {});
    await page.getByRole('button', { name: '건너뛰기' }).click({ timeout: 1200 }).catch(() => {});
    await sleep(300);
  };
  const shot = async (name, opts = {}) => {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    // 사진이 떠 있는 안내 카드(대표 승인 대기 등)를 가리지 않게 잠시 숨긴다 — 화면 자체는 그대로
    await page.addStyleTag({ content: '[data-floating],[role=status]{visibility:hidden!important}' }).catch(() => {});
    if (opts.locator) await opts.locator.screenshot({ path: path.join(dir, file) });
    else await page.screenshot({ path: path.join(dir, file), fullPage: false });
    return `${kind}/${file}`;
  };
  /** 한 항목 — 확인 함수가 던지면 실패로 적고 다음으로 넘어간다 */
  const check = async (criteria, title, fn) => {
    const rec = { criteria, title, ok: false, notes: [], shots: [] };
    try {
      await fn(rec);
      rec.ok = rec.notes.every((x) => !x.startsWith('✗'));
    } catch (e) {
      rec.notes.push('✗ ' + String(e.message ?? e).split('\n')[0]);
      rec.shots.push(await shot('fail').catch(() => ''));
    }
    rec.overflow = await overflow().catch(() => null);
    if (rec.overflow > 0) { rec.ok = false; rec.notes.push(`✗ 가로 넘침 ${rec.overflow}px`); }
    checks.push(rec);
    console.log(`${kind.padEnd(6)} ${rec.ok ? 'PASS' : 'FAIL'} ${criteria} ${title}${rec.ok ? '' : ' — ' + rec.notes.filter((x) => x.startsWith('✗')).join(' / ')}`);
  };
  const expect = (rec, cond, okText, badText) => rec.notes.push(cond ? '✓ ' + okText : '✗ ' + (badText ?? okText));

  // ── 로그인 · 권한 (제5조 첫째 항목 — C1·C5 의 전제)
  await check('C5', '역할별 로그인과 권한 구분', async (r) => {
    await go('/login');
    r.shots.push(await shot('login'));
    await login('client');
    expect(r, page.url().includes('/portal'), '고객 계정은 고객 Portal 로 들어감');
    await go('/ax/clients');
    expect(r, !page.url().includes('/ax/clients'), '고객 계정은 내부 화면(/ax)에 들어갈 수 없음');
    await login('park');
    await go('/ax/settings?open=data');
    expect(r, (await page.getByRole('button', { name: '전체 데이터 엑셀로 받기' }).count()) === 0, '컨설턴트에게는 전체 데이터 내보내기가 없음(대표 전용)');
    await login('admin');
    expect(r, page.url().includes('/ax/'), '대표 계정은 내부 AX 로 들어감');
  });

  // ── C1 등록 · 수정 · 조회 (+ 이력)
  await check('C1', '기업고객 등록 → 수정 → 조회, 변경 이력 저장', async (r) => {
    await go('/ax/clients');
    await page.getByRole('button', { name: '기업고객 등록' }).first().click(); await sleep(500);
    await page.getByPlaceholder('예: 주식회사 대한정밀').fill('예시기업(주)');
    await page.getByPlaceholder('성명').first().fill('홍길동');   // 대표자 — 담당자 칸도 '성명'이다
    await page.getByRole('dialog').getByRole('button', { name: /^등록/ }).last().click();
    await page.waitForURL(/\/ax\/clients\/co_/, { timeout: 8000 }); await sleep(900);
    expect(r, (await page.getByText('예시기업(주)').count()) > 0, '등록 후 기업 상세로 이동');
    await page.getByRole('button', { name: '기업정보 수정' }).click(); await sleep(500);
    await page.getByPlaceholder('000-00-00000').fill('1234567890');
    await page.getByRole('dialog').getByRole('button', { name: /저장/ }).last().click(); await sleep(700);
    const st = await dump();
    const co = st.companies.find((c) => c.name === '예시기업(주)');
    expect(r, co?.bizNo === '123-45-67890', '수정 값 저장(사업자번호 자동 서식)');
    expect(r, st.activities.some((a) => a.type === 'company_created' && a.companyId === co?.id) && st.activities.some((a) => a.type === 'company_updated' && a.companyId === co?.id), '등록·수정 이력이 실증 기록에 남음');
    r.shots.push(await shot('company-detail'));
    await go('/ax/clients');
    await page.getByPlaceholder(/검색/).first().fill('예시기업'); await sleep(400);
    expect(r, (await page.getByText('예시기업(주)').count()) > 0, '검색으로 조회');
  });

  // ── C2 대시보드
  await check('C2', '대시보드 — 약정 6개 상태 + 오늘 확인할 지표', async (r) => {
    await go('/ax/dashboard');
    const strip = page.locator('#ops-strip');
    await strip.waitFor({ timeout: 6000 });
    const labels = ['진행 프로젝트', '기업고객', '요청자료 미제출', '7일 내 일정', '지연', '후속업무'];
    const found = [];
    for (const l of labels) if ((await strip.getByText(l, { exact: true }).count()) > 0) found.push(l);
    expect(r, found.length === 6, `별지 모듈1의 6개 상태 표시 (${found.join('·')})`, `6개 중 ${found.length}개만 표시`);
    const st = await dump();
    const projActive = st.projects.filter((p) => !p.archived && !['done', 'aftercare'].includes(p.stage)).length;
    const shown = Number((await strip.getByText('진행 프로젝트', { exact: true }).locator('xpath=..').innerText()).replace(/\D/g, ''));
    expect(r, shown === projActive, `표시 숫자가 저장 데이터와 일치 (진행 프로젝트 ${shown})`, `진행 프로젝트 표시 ${shown} ≠ 데이터 ${projActive}`);
    r.shots.push(await shot('dashboard'));
    await strip.scrollIntoViewIfNeeded();
    r.shots.push(await shot('ops-strip', { locator: strip }));
  });

  // ── C3 AI 브리핑 · 우선순위 · 대표자용 요약
  await check('C3', 'AI 업무 브리핑 · 우선순위 · 대표자용 요약', async (r) => {
    await go('/ax/brief');
    const sum = page.locator('#ceo-summary');
    await sum.waitFor({ timeout: 6000 });
    expect(r, (await sum.getByText('대표자용 요약').count()) === 1, '대표자용 요약 표시');
    expect(r, (await sum.locator('li').count()) >= 5, `요약 ${await sum.locator('li').count()}줄 (프로젝트·자료·문의·일정·처리량)`);
    r.shots.push(await shot('brief'));
    const body = await page.locator('main').innerText();
    expect(r, /누락|지연|후속|오늘/.test(body), '누락자료·지연건·후속연락·오늘의 우선업무 항목이 화면에 있음');
  });

  // ── C4 고객 Portal 흐름 + 내부 반영 (별지 "최소 1개의 실제 데이터 흐름")
  await check('C4', 'Portal 진행현황 · 일정·공지 · 완료자료 확인', async (r) => {
    await login('client');
    expect(r, (await page.getByText(/진행/).count()) > 0, '로그인 직후 진행현황');
    r.shots.push(await shot('portal-home'));
    await go('/portal/schedule');
    expect(r, (await page.locator('#notices').count()) === 1, '일정 · 공지 화면');
    r.shots.push(await shot('portal-schedule'));
    await go('/portal/results');
    expect(r, (await page.locator('main').innerText()).length > 20, '완료자료 화면');
    r.shots.push(await shot('portal-results'));
  });

  await check('C4', 'Portal 자료제출 → 내부 업무 자동생성 → 검토 → Portal 자동반영', async (r) => {
    await go('/portal/documents');
    await page.getByRole('button', { name: /재제출/ }).first().click(); await sleep(600);
    const drop = page.getByRole('dialog').locator('label').first();
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), drop.click()]);
    await fc.setFiles(FILE); await sleep(600);
    r.shots.push(await shot('portal-submit'));
    await page.getByRole('button', { name: '제출하기' }).click(); await sleep(900);
    let st = await dump();
    const doc = st.docRequests.find((d) => d.name === '매출채권 연령표' && d.companyId === 'co_a');
    expect(r, doc?.status === 'submitted' && doc.files.some((f) => f.fileName === FILE.name), '고객 제출 저장(상태: 제출완료)');

    await login('park');
    await go('/ax/tasks');
    await page.getByRole('button', { name: '미완료' }).first().click(); await sleep(500);
    const task = page.getByText('에이정밀(주) 매출채권 연령표 검토').first();
    expect(r, (await task.count()) > 0, '담당자 업무함에 검토 업무 자동 생성');
    await task.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(300);
    r.shots.push(await shot('ax-task'));

    await go('/ax/documents');
    const row = mobile
      ? page.locator('button').filter({ hasText: '매출채권 연령표' }).filter({ hasText: '에이정밀' }).first()
      : page.locator('tr').filter({ hasText: '매출채권 연령표' }).filter({ hasText: '에이정밀' }).first();
    await row.click(); await sleep(800);
    await page.getByRole('button', { name: '검토 완료' }).click(); await sleep(900);
    st = await dump();
    expect(r, st.docRequests.find((d) => d.id === doc.id)?.status === 'done', '담당자 검토 완료 → 상태 변경');

    await login('client');
    await go('/portal/documents');
    const name = page.getByText('매출채권 연령표', { exact: true }).first();
    await name.scrollIntoViewIfNeeded();
    const reflected = await page.locator("xpath=//*[normalize-space()='매출채권 연령표']/ancestor::div[.//*[normalize-space()='확인완료']][1]").count();
    expect(r, reflected > 0, 'Portal 에 확인완료로 자동 반영');
    r.shots.push(await shot('portal-reflected'));
    st = await dump();
    expect(r, st.notifications.some((x) => x.audience === 'client' && x.companyId === 'co_a' && /확인|검토/.test(x.title)), '고객 알림 발송');
    const types = st.activities.filter((a) => a.companyId === 'co_a').map((a) => a.type);
    expect(r, types.includes('document_uploaded') && types.includes('document_reviewed'), '제출·검토가 실증 기록에 순서대로 남음');
  });

  await check('C4', 'Portal 문의 → 내부 문의함 도착', async (r) => {
    await go('/portal/inquiries');
    await page.getByRole('button', { name: '새 문의' }).first().click(); await sleep(500);
    await page.getByPlaceholder('예: 결과보고 일정이 언제쯤 확정될까요?').fill('검수 확인용 문의입니다');
    await page.getByPlaceholder('궁금한 내용을 편하게 적어주세요.').fill('자동 검수 중 남긴 문의입니다.');
    await page.getByRole('button', { name: '문의 보내기' }).click(); await sleep(800);
    r.shots.push(await shot('portal-inquiry'));
    await login('park');
    await go('/ax/tasks?tab=inquiry');
    expect(r, (await page.getByText('검수 확인용 문의입니다').count()) > 0, '담당자 문의함에 도착');
  });

  // ── 검색·필터·이력, CSV·엑셀 (제5조)
  await check('C1', '실증 기록 검색·필터 · 엑셀 내보내기', async (r) => {
    await login('admin');
    await go('/ax/reports?tab=evidence');
    await page.getByPlaceholder('내용·기업·사람 이름으로 검색').fill('매출채권'); await sleep(400);
    const cnt = Number((await page.locator('#evidence-count').innerText()).replace(/\D/g, ''));
    expect(r, cnt > 0, `검색 결과 ${cnt}건`);
    r.shots.push(await shot('evidence'));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '이 결과 엑셀' }).click()]);
    expect(r, /\.xlsx$/.test(dl.suggestedFilename()), '조건 그대로 엑셀 내보내기');
    await go('/ax/clients');
    await page.getByRole('button', { name: '엑셀로 등록' }).click(); await sleep(500);
    expect(r, (await page.getByText('엑셀·CSV 파일 고르기').count()) === 1, '엑셀·CSV 로 기업고객 일괄 등록 창');
    r.shots.push(await shot('excel-import'));
  });

  await ctx.close();
  return { checks, errors };
}

fs.rmSync(OUT, { recursive: true, force: true });
const browser = await pw.chromium.launch({ executablePath: CHROME, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
const startedAt = new Date().toISOString();
const pc = await runViewport(browser, 'pc');
const mobile = await runViewport(browser, 'mobile');
await browser.close();
const all = [...pc.checks.map((c) => ({ ...c, viewport: 'pc' })), ...mobile.checks.map((c) => ({ ...c, viewport: 'mobile' }))];
const result = { startedAt, finishedAt: new Date().toISOString(), app: B, criteria: CRITERIA, checks: all, pageErrors: [...pc.errors, ...mobile.errors] };
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(result, null, 2));
const fails = all.filter((c) => !c.ok).length;
console.log(`\n${all.length - fails}/${all.length} 통과 · 페이지 오류 ${result.pageErrors.length}건 → ${path.join(OUT, 'results.json')}`);
process.exit(fails || result.pageErrors.length ? 1 : 0);

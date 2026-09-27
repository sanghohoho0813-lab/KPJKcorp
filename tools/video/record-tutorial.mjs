// 영상 2 — 대표·직원용 튜토리얼 2분 ("하루 업무 흐름")
// 원칙: 따라 할 수 있게 — 커서가 누르는 곳이 보이고, 누른 결과가 바로 보인다.
//       예시로 새로 입력하는 값은 누가 봐도 예시인 이름(예시기업·홍길동)만 쓴다.
import fs from 'fs';
import { launch, session, login, go, cap, tag, hl, typeInto, Recorder, assemble, stills, sleep, sameOriginCard, B } from './rec.mjs';
import { titleCard, endCard, phoneCard } from './cards.mjs';

const OUT = process.env.OUT || new URL('./out/tutorial', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const rec = new Recorder(OUT);
const TAG = '화면의 기업명·수치는 시연용 샘플 데이터';
const DOC = '부가가치세 신고서 (최근 2기)';
const FILE = { name: '부가세_신고서_2026_1기.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(180 * 1024, 5) };

const b = await launch();
const { ctx, page, mouse, errs } = await session(b);
const card = await ctx.newPage();
await card.setViewportSize({ width: 1440, height: 810 });

const ACC = {
  ceo: ['ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**'],
  client: ['ceo@a-precision.demo', 'client2026!', '**/portal**'],
};
const as = async (who) => login(page, ...ACC[who]);
const clear = () => cap(page, '', '', true);
const park = (x = 1180, y = 300) => mouse.to(x, y, 1);
const dialog = () => page.getByRole('dialog');

/* ───────────── T0 타이틀 ───────────── */
await as('ceo'); await tag(page, TAG);                     // 첫 로그인에서 튜토리얼 팝업을 닫아 두면 이후 다시 뜨지 않는다
await rec.shot(card, 't0-title', async () => {
  await card.setContent(titleCard({
    eyebrow: 'KPJK BUSINESS AX · 사용법',
    title: '하루 업무 흐름을<br><em>2분</em>에 익히기',
    sub: '로그인부터 고객 자료 검토까지, 실제 화면을 그대로 따라갑니다',
    foot: '대표 · 담당자용 · 화면 속 기업명·수치는 시연용 샘플 데이터입니다',
  }));
  await sleep(4400);
});

/* ───────────── T1 출근 — 로그인 → 오늘 확인할 일 ───────────── */
await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('kpjk')); const s = JSON.parse(localStorage.getItem(k)); s.state.session = null; localStorage.setItem(k, JSON.stringify(s)); });
await go(page, '/login'); await clear(); await park(1000, 330);
await rec.shot(page, 't1-login', async () => {
  await sleep(250);
  await cap(page, '① 출근', '아이디와 비밀번호로 로그인합니다');
  await sleep(500);
  await typeInto(mouse, page.getByLabel('아이디 (이메일)'), 'ceo@kpjk.co.kr', 35);
  await typeInto(mouse, page.locator('input[type=password]').first(), 'kpjk2026!', 45);
  await mouse.click(page.getByRole('button', { name: '로그인' }), { ms: 500 });
  await page.waitForURL('**/ax/dashboard', { timeout: 15000 });
  await sleep(1300);
  await cap(page, '① 출근', '<b>오늘 확인할 일</b>이 먼저 뜹니다 — 빨간 숫자부터 처리하세요');
  await sleep(300);
  const kpi = page.getByText('자료 검토 대기', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  await kpi.evaluate((e) => { const y = e.getBoundingClientRect().top + window.scrollY - 250; window.scrollTo({ top: y, behavior: 'smooth' }); });
  await sleep(700);
  await hl(page, kpi, { pad: 6 });
  await mouse.over(page.getByText('자료 검토 대기', { exact: true }).first(), 600);
  await sleep(1600);
  await hl(page, null);
}, { minMs: 12000 });

/* ───────────── T2 AI 브리핑 → 안내문 초안 ───────────── */
await go(page, '/ax/brief'); await clear(); await park(1250, 200);
const remind = page.getByRole('button', { name: '리마인드 초안' }).first();
await rec.shot(page, 't2-brief', async () => {
  await sleep(250);
  await cap(page, '② AI 브리핑', '급한 일이 <b>근거와 함께</b> 순서대로 정리됩니다');
  await sleep(500);
  const item = remind.locator('xpath=ancestor::div[contains(concat(" ",@class," ")," card ")][1]');
  await item.evaluate((e) => { const y = e.getBoundingClientRect().top + window.scrollY - 200; window.scrollTo({ top: y, behavior: 'smooth' }); });
  await sleep(600);
  await hl(page, item, { pad: 4 });
  await mouse.click(item.getByRole('button', { name: /왜\?/ }), { ms: 650 });
  await sleep(1500);
  await hl(page, null);
  await cap(page, '② AI 브리핑', '버튼 한 번에 <b>안내문 초안</b>이 만들어집니다');
  await mouse.click(remind, { ms: 600 });
  await sleep(500);
  await cap(page, '② AI 브리핑', '내용을 확인하고 <b>복사</b>해서 카톡·문자로 보내면 끝', false, 'top');
  await sleep(1700);
  await mouse.click(dialog().getByRole('button', { name: /복사/ }), { ms: 600 });
  await sleep(1300);
  await page.keyboard.press('Escape');
  await sleep(500);
}, { minMs: 14000 });

/* ───────────── T3 새 고객 등록 ───────────── */
await go(page, '/ax/clients'); await clear(); await park(1250, 300);
await rec.shot(page, 't3-newco', async () => {
  await sleep(250);
  await cap(page, '③ 새 고객', '새 고객은 <b>기업고객 등록</b>에서 시작합니다');
  await sleep(500);
  await mouse.click(page.getByRole('button', { name: '기업고객 등록' }).first(), { ms: 600 });
  await sleep(600);
  await cap(page, '③ 새 고객', '서류를 올리면 <b>자동으로 채워지고</b>, 나머지는 클릭', false, 'top');
  const fill = dialog().getByText('서류로 빠르게 채우기').first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  await hl(page, fill, { pad: 4 });
  await mouse.over(dialog().getByRole('button', { name: /파일 올리기/ }).first(), 600);
  await sleep(1200);
  await hl(page, null);
  await typeInto(mouse, dialog().getByPlaceholder(/대한정밀/), '예시기업(주)', 55);
  await typeInto(mouse, dialog().getByRole('textbox', { name: '대표자 *' }), '홍길동', 70);
  await mouse.click(dialog().getByRole('button', { name: '법인', exact: true }), { ms: 500 });
  await sleep(500);
  await mouse.click(dialog().getByRole('button', { name: '등록', exact: true }), { ms: 600 });
  await sleep(1300);
  await cap(page, '③ 새 고객', '이 기업의 상담·프로젝트·자료가 <b>한 카드</b>에 모이기 시작합니다');
  await sleep(1400);
}, { minMs: 14800 });

/* ───────────── T4 자료 요청 ───────────── */
await go(page, '/ax/projects/pj_a1'); await clear(); await park(1250, 300);
await rec.shot(page, 't4-docreq', async () => {
  await sleep(250);
  await cap(page, '④ 자료 요청', '프로젝트 화면에서 <b>자료 요청</b>을 누르고');
  await sleep(500);
  await mouse.click(page.getByRole('button', { name: '자료 요청' }).first(), { ms: 600 });
  await sleep(500);
  await cap(page, '④ 자료 요청', '자료 이름과 기한만 적으면 <b>고객 Portal에 바로</b> 뜹니다', false, 'top');
  await typeInto(mouse, dialog().getByPlaceholder(/최근 3년 재무제표/), DOC, 55);
  await sleep(400);
  await mouse.over(dialog().locator('input[type=date]').first(), 450);
  await sleep(400);
  await mouse.click(dialog().getByRole('button', { name: '요청 등록' }), { ms: 500 });
  await sleep(250);
  await cap(page, '④ 자료 요청', '기한을 3일 넘기면 <b>독촉 업무가 자동으로</b> 생깁니다');
  await sleep(2400);
}, { minMs: 13000 });

/* ───────────── T5 고객이 보는 화면 ───────────── */
await as('client'); await go(page, '/portal'); await clear(); await park(1250, 250);
await rec.shot(page, 't5-portal', async () => {
  await sleep(250);
  await cap(page, '⑤ 고객 화면', '고객은 로그인하면 <b>진행상황</b>부터 봅니다');
  await sleep(600);
  await mouse.to(900, 420, 600);
  await sleep(1000);
  await mouse.click(page.getByRole('link', { name: '요청자료', exact: true }).first(), { ms: 600 });
  await sleep(1200);
  const row = page.getByText(DOC, { exact: true }).first();
  await row.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await sleep(500);
  await cap(page, '⑤ 고객 화면', '방금 요청한 자료가 뜨고, 고객이 <b>직접 올립니다</b>');
  const item = row.locator("xpath=ancestor::div[.//button][1]");
  await hl(page, item, { pad: 2 });
  await sleep(900);
  await hl(page, null);
  await mouse.click(item.getByRole('button').last(), { ms: 550 });
  await cap(page, '', '');
  await sleep(600);
  const drop = dialog().locator('label').first();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), mouse.click(drop, { ms: 480, pause: 150 })]);
  await fc.setFiles(FILE);
  await sleep(700);
  await mouse.click(page.getByRole('button', { name: '제출하기' }), { ms: 500, pause: 150 });
  await sleep(300);
  await cap(page, '⑤ 고객 화면', '카톡·메일로 받을 필요 없이 <b>담당자에게 바로</b> 전달됩니다');
  await sleep(1600);
}, { minMs: 15200 });

/* ───────────── T6 업무함 → 검토 ───────────── */
await as('ceo'); await go(page, '/ax/tasks');
await page.getByRole('button', { name: '미완료' }).first().click(); await sleep(500);
const autoTask = page.getByText(`에이정밀(주) ${DOC} 검토`).first();
await autoTask.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(300);
await clear(); await park(1250, 200);
await rec.shot(page, 't6-review', async () => {
  await sleep(250);
  await cap(page, '⑥ 검토', '고객이 올리면 <b>업무함에 검토 업무</b>가 자동으로 생깁니다');
  await sleep(500);
  const tRow = autoTask.locator('xpath=ancestor::div[contains(@class,"px-4")][1]');
  await hl(page, tRow, { pad: 0, radius: 10 });
  await mouse.over(tRow.getByText('자동').first(), 650);
  await sleep(1500);
  await hl(page, null);
  await mouse.click(page.getByRole('link', { name: /자료관리/ }).first(), { ms: 650 });
  await sleep(1100);
  const dRow = page.locator('tr').filter({ hasText: DOC }).first();
  await mouse.click(dRow, { ms: 650 });
  await sleep(500);
  await cap(page, '⑥ 검토', '파일을 확인하고 <b>검토 완료</b> 또는 <b>보완 요청</b>', false, 'top');
  await sleep(1200);
  await mouse.over(dialog().getByRole('button', { name: '보완 요청' }), 450);
  await sleep(350);
  await mouse.click(dialog().getByRole('button', { name: '검토 완료' }), { ms: 450 });
  await sleep(400);
  await cap(page, '⑥ 검토', '결과는 고객에게 <b>알림으로 자동</b> 전달됩니다');
  await sleep(1450);
}, { minMs: 15000 });

/* ───────────── T7 고객 문의 답변 ───────────── */
await go(page, '/ax/tasks?tab=inquiry'); await clear(); await park(1250, 200);
await rec.shot(page, 't7-inquiry', async () => {
  await sleep(250);
  await cap(page, '⑦ 고객 문의', '고객 문의는 업무함 <b>고객 문의</b> 탭에 모입니다');
  await sleep(700);
  await mouse.over(page.getByText(/결과보고 일정이 언제쯤/).last(), 600);
  await sleep(700);
  await mouse.click(page.getByRole('button', { name: /초안 제안/ }).first(), { ms: 650 });
  await sleep(500);
  await cap(page, '⑦ 고객 문의', '<b>초안 제안</b>으로 시작해 다듬고, 등록하면 고객에게 전달됩니다');
  await sleep(1500);
  await mouse.click(page.getByRole('button', { name: '답변 등록' }), { ms: 600 });
  await sleep(700);
  // 답변하면 미답변 목록에서 빠진다 — 빈 화면으로 끝내지 않고 주고받은 대화를 보여 준다
  await mouse.click(page.getByRole('button', { name: /답변완료/ }).first(), { ms: 550 });
  await sleep(300);
  await cap(page, '⑦ 고객 문의', '등록한 답변은 <b>고객 Portal</b>에 그대로 보입니다', false, 'top');
  await mouse.to(1180, 560, 500);
  await sleep(1300);
}, { minMs: 12000 });

/* ───────────── T8 휴대폰 ───────────── */
const phone = await sameOriginCard(ctx, phoneCard({
  src: B + '/ax/dashboard',
  heading: '휴대폰에서도<br>그대로',
  lines: ['이동 중에 승인·확인', '같은 계정, 같은 데이터', '글자 크기도 바로 조절'],
}));
await tag(phone, TAG);
await sleep(3500);
const frame = phone.frames().find((f) => f.url().includes('/ax/dashboard'));
await rec.shot(phone, 't8-phone', async () => {
  await sleep(1800);
  if (frame) await frame.evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' })).catch(() => {});
  await sleep(2200);
  if (frame) await frame.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(() => {});
  await sleep(1600);
}, { minMs: 7800 });
await phone.close();

/* ───────────── T9 AX 코치 ───────────── */
await go(page, '/ax/dashboard'); await clear(); await park(1250, 200);
await rec.shot(page, 't9-coach', async () => {
  await sleep(250);
  await cap(page, '처음 2주', '<b>AX 코치</b>가 하루 1~3개씩 오늘 할 일을 알려 줍니다');
  await sleep(700);
  await mouse.click(page.getByRole('button', { name: '실증 시작' }).first(), { ms: 700 });
  await sleep(1100);
  const coach = page.getByText('오늘의 AX 코치').first().locator('xpath=ancestor::div[contains(@class,"coach-box")][1]');
  await hl(page, coach, { pad: 4, radius: 18 });
  await mouse.to(1100, 470, 700);
  await sleep(2600);
  await hl(page, null);
}, { minMs: 8800 });

/* ───────────── T10 마무리 ───────────── */
await rec.shot(card, 't10-end', async () => {
  await card.setContent(endCard({
    title: '이것만 기억하세요',
    items: ['출근하면 대시보드 — 빨간 숫자부터', '고객 자료는 카톡 대신 Portal로', '처리는 업무함에서 — 누르면 기록까지 남습니다'],
    foot: '막히면 오른쪽 위 ? 버튼 → 튜토리얼 다시 보기 · 화면 속 기업명·수치는 시연용 샘플 데이터입니다',
  }));
  await sleep(5000);
});

const FILEOUT = OUT + '/KPJK_AX_튜토리얼_2분.mp4';
const len = assemble(rec.clips, FILEOUT);
console.log('TOTAL', len.toFixed(2) + 's', '· pageerrors', errs.length, errs.slice(0, 2));
let t = 0; const marks = [];
for (const c of rec.clips) { marks.push(t + Math.min(c.dur - 0.5, c.dur * 0.7)); t += c.dur - 0.35; }
stills(FILEOUT, OUT + '/v2', marks);
await b.close();

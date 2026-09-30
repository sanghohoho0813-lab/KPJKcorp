// 영상 1 — 실사 담당자용 60초
// 원칙: 화면에 보이는 모든 동작은 실제 시스템이 그 자리에서 처리한 것이다. 편집으로 만든 결과 화면은 없다.
//       기업명·수치는 시연용 샘플이라는 표시를 처음부터 끝까지 띄운다.
import fs from 'fs';
import { launch, session, login, go, cap, tag, hl, hlUnion, Recorder, assemble, stills, sleep, SERVER_URL } from './rec.mjs';
import { titleCard, problemCard, endCard } from './cards.mjs';

const OUT = process.env.OUT || new URL('./out/60s', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const rec = new Recorder(OUT);
/*
 * 두 가지로 녹화한다.
 *  - 데모(기본): 브라우저 저장소의 시연용 샘플 기업(에이정밀)으로.
 *  - 서버·Pilot: VIDEO_SERVER=1 — 실제 서버에 붙은 앱을 파일럿 계정으로. 자막은 "샘플"이 아니라 사실대로 적는다.
 *    기업·자료·계정은 환경변수로 받는다 (README). 녹화 전에 대상 기업에 '요청' 또는 '보완요청' 상태 자료가 1건 있어야 한다.
 * 어느 쪽이든 개선율·ROI·검증되지 않은 성과 수치는 넣지 않는다.
 */
const PILOT = process.env.VIDEO_SERVER === '1';
if (PILOT && !SERVER_URL) throw new Error('VIDEO_SERVER=1 인데 서버 주소가 없습니다. .env.local 또는 SUPABASE_URL 을 확인하세요.');
const need = (k) => { const v = process.env[k]; if (!v) throw new Error(`서버·Pilot 녹화에는 ${k} 가 필요합니다 (tools/video/README.md)`); return v; };
const V = PILOT ? {
  tag: '비식별 Pilot 기업 · 실제 서버 연결 상태에서 녹화',
  titleFoot: '실제 서버에 연결된 화면을 그대로 녹화했습니다 · 기업명은 비식별 Pilot 기업',
  endFoot: '영상 속 기업은 비식별 Pilot 기업입니다. 모든 화면은 실제 서버에 연결된 시스템을 녹화한 것이며, 개선율·성과 수치는 넣지 않았습니다.',
  companyId: need('VIDEO_COMPANY_ID'), companyName: need('VIDEO_COMPANY_NAME'), doc: need('VIDEO_DOC'),
  file: { name: 'Pilot_시연_제출파일.txt', mimeType: 'text/plain', buffer: Buffer.from('Pilot 시연용 제출 파일입니다. 실제 서류가 아닙니다.\n') },
  acc: {
    ceo: [need('VIDEO_CEO_ID'), need('VIDEO_CEO_PW'), '**/ax/**'],
    park: [need('VIDEO_CONSULTANT_ID'), need('VIDEO_CONSULTANT_PW'), '**/ax/**'],
    client: [need('VIDEO_CLIENT_ID'), need('VIDEO_CLIENT_PW'), '**/portal**'],
  },
} : {
  tag: '화면의 기업명·수치는 시연용 샘플 데이터',
  titleFoot: '실제 작동하는 화면을 그대로 녹화했습니다 · 기업명·수치는 시연용 샘플',
  endFoot: '영상 속 기업명·수치는 시연용 샘플 데이터입니다. 모든 화면은 실제로 작동하는 시스템을 녹화한 것입니다.',
  companyId: 'co_a', companyName: '에이정밀(주)', doc: '매출채권 연령표',
  // 고객이 올릴 파일 (데모 모드는 파일명·크기만 기록한다). 한글 파일명은 경로로 넘기면 깨져서 메모리로 넘긴다
  file: { name: '매출채권_연령표_거래처별.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.alloc(24 * 1024, 7) },
  acc: {
    ceo: ['ceo@kpjk.co.kr', 'kpjk2026!', '**/ax/**'],
    park: ['park@kpjk.co.kr', 'kpjk2026!', '**/ax/**'],
    client: ['ceo@a-precision.demo', 'client2026!', '**/portal**'],
  },
};
const TAG = V.tag;
const FILE = V.file;
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const b = await launch();
const { ctx, page, mouse, errs } = await session(b);
const card = await ctx.newPage();
await card.setViewportSize({ width: 1440, height: 810 });

const ACC = V.acc;
const as = async (who) => login(page, ...ACC[who]);
const clear = () => cap(page, '', '', true);
const park = (x = 1180, y = 300) => mouse.to(x, y, 1);   // 녹화 밖에서 커서를 제자리에

/* ───────────── C0 타이틀 ───────────── */
await as('ceo'); await tag(page, TAG);                    // 태그는 세션 저장소에 남아 이후 모든 화면에 붙는다
await rec.shot(card, 'c0-title', async () => {
  await card.setContent(titleCard({
    eyebrow: 'KPJK CORPORATION · BUSINESS AX',
    title: '경영컨설팅 운영을<br><em>하나의 데이터 흐름</em>으로',
    sub: '기업고객 관리 · 상담 · 계약 · 프로젝트 · 자료 · 일정을 하나로 잇는 운영 AX와 기업고객 Portal',
    foot: V.titleFoot,
  }));
  await sleep(4300);
});

/* ───────────── C1 도입 전 문제 ───────────── */
await rec.shot(card, 'c1-problem', async () => {
  await card.setContent(problemCard({
    heading: '도입 전 — 사람의 기억에 묶인 구조',
    steps: [['고객 문의', '전화'], ['자료 요청', '카톡·메일'], ['고객 제출', '카톡·메일'], ['검토', '개인 PC'], ['진행', '담당자 기억'], ['결과 전달', '메일'], ['사후관리', '달력']],
    conclusion: '고객이 늘수록 <b>“그 자료 받았나? 어디까지 됐지?”</b><br>확인하는 시간이 컨설팅 시간을 잠식했습니다.',
    issues: ['자료를 찾는 시간 증가', '재요청·후속연락 누락', '대표가 물어봐야 아는 진행상황', '고객의 반복 진행상황 문의'],
  }));
  await sleep(7000);
});

/* ───────────── S2 기업고객 중심 구조 ───────────── */
await go(page, '/ax/clients'); await clear(); await park(1250, 250);
await rec.shot(page, 's2-client', async () => {
  await sleep(250);
  await cap(page, '내부 AX · 기업고객', '고객 한 곳을 중심으로 <b>상담·계약·프로젝트·자료·일정</b>이 모입니다');
  await sleep(700);
  await mouse.click(page.locator(`a[href="/ax/clients/${V.companyId}"]`).first(), { ms: 650 });
  await sleep(1500);
  const tiles = page.getByText('진행 프로젝트', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  await hl(page, tiles, { pad: 6 });
  await mouse.over(page.getByText('다음 일정', { exact: true }).first(), 600);
  await sleep(1300);
  await hl(page, null);
}, { minMs: 7400 });

/* ───────────── S3 고객이 Portal 에서 재제출 ───────────── */
await as('client'); await go(page, '/portal/documents'); await clear(); await park(1200, 330);
// 보완요청 상태면 "재제출", 처음 요청이면 "업로드" 버튼이다
const row = page.locator('div').filter({ has: page.getByText(V.doc, { exact: true }) }).filter({ has: page.getByRole('button', { name: /재제출|업로드/ }) }).last();
const resubmit = (await row.getByRole('button', { name: /재제출/ }).count()) > 0;
await rec.shot(page, 's3-submit', async () => {
  await sleep(250);
  await cap(page, '고객 Portal', resubmit ? '보완 요청을 받은 고객이 <b>Portal에서 직접 재제출</b>합니다' : '고객이 요청받은 자료를 <b>Portal에서 직접 제출</b>합니다');
  await sleep(600);
  await hl(page, row, { pad: 2 });
  await sleep(900);
  await hl(page, null);
  await mouse.click(row.getByRole('button', { name: /재제출|업로드/ }).first(), { ms: 520, pause: 150 });
  await cap(page, '', '');                                   // 창이 열리는 동안은 자막을 내린다 — 제출 버튼을 가린다
  await sleep(700);
  const drop = page.getByRole('dialog').locator('label').first();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), mouse.click(drop, { ms: 480, pause: 150 })]);
  await fc.setFiles(FILE);
  await sleep(750);
  await mouse.click(page.getByRole('button', { name: '제출하기' }), { ms: 520, pause: 150 });
  await sleep(350);
  await cap(page, '고객 Portal', '제출하면 <b>담당 컨설턴트에게 바로</b> 전달됩니다');
  await sleep(1600);
}, { minMs: 9400 });

/* ───────────── S4 담당자 업무함에 자동 생성 ───────────── */
await as('park'); await go(page, '/ax/tasks');
await page.getByRole('button', { name: '미완료' }).first().click(); await sleep(500);
const task = page.getByText(`${V.companyName} ${V.doc} 검토`).first();
await task.scrollIntoViewIfNeeded(); await sleep(300);
const taskRow = task.locator('xpath=ancestor::div[contains(@class,"px-4")][1]');
await clear(); await park(1250, 200);
await rec.shot(page, 's4-task', async () => {
  await sleep(250);
  await cap(page, '내부 AX · 담당자 업무함', '제출 즉시 담당자 업무함에 <b>검토 업무가 자동으로</b> 생깁니다');
  await sleep(500);
  await hl(page, taskRow, { pad: 0, radius: 10 });
  await mouse.over(taskRow.getByText('자동').first(), 700);
}, { minMs: 4300 });
await hl(page, null);

/* ───────────── S5 검토 완료 ───────────── */
await go(page, '/ax/documents'); await clear(); await park(1250, 200);
const docRow = page.locator('tr').filter({ hasText: V.doc }).filter({ hasText: V.companyName }).first();
await rec.shot(page, 's5-review', async () => {
  await sleep(250);
  await cap(page, '내부 AX · 자료 검토', '담당자는 <b>방금 올라온 파일</b>을 열어 확인하고');
  await sleep(500);
  await hl(page, docRow, { pad: 0, radius: 8 });
  await sleep(600);
  await hl(page, null);
  await mouse.click(docRow, { ms: 600 });
  await cap(page, '', '');
  await sleep(1000);
  await mouse.click(page.getByRole('button', { name: '검토 완료' }), { ms: 650 });
  await sleep(350);
  await cap(page, '내부 AX · 자료 검토', '<b>검토 완료</b> 한 번이면 고객 화면까지 바뀝니다');
  await sleep(1700);
}, { minMs: 7300 });

/* ───────────── S6 고객 화면에 반영 ───────────── */
await as('client'); await go(page, '/portal/documents'); await clear(); await park(1250, 300);
const doneName = page.getByText(V.doc, { exact: true }).first();
const doneRow = doneName.locator("xpath=ancestor::div[.//*[normalize-space()='확인완료']][1]");
await doneRow.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(400);
await rec.shot(page, 's6-reflect', async () => {
  await sleep(250);
  await cap(page, '고객 Portal', '고객 화면이 <b>확인완료</b>로 바뀌고, 알림이 갑니다');
  await sleep(400);
  const meta = page.getByText(new RegExp(esc(FILE.name))).first();
  const item = meta.locator(`xpath=ancestor::div[.//*[normalize-space()='${V.doc}']][1]`);
  await hl(page, item, { pad: 2, radius: 12 });
  await mouse.over(doneRow.getByText('확인완료').first(), 600);
  await sleep(900);
  await mouse.over(page.getByRole('button', { name: /알림/ }).first(), 650);
}, { minMs: 4600 });
await hl(page, null);

/* ───────────── S7 대표 대시보드 ───────────── */
await as('ceo'); await go(page, '/ax/dashboard'); await clear(); await park(1300, 180);
await rec.shot(page, 's7-dash', async () => {
  await sleep(250);
  await cap(page, '내부 AX · 대표 대시보드', '대표는 출근하면 <b>오늘 먼저 확인할 것</b>을 근거와 함께 봅니다');
  await sleep(500);
  const kpi = page.getByText('자료 검토 대기', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  await hl(page, kpi, { pad: 6 });
  await mouse.over(page.getByText('지연 프로젝트', { exact: true }).first(), 700);
  await sleep(1400);
  await hl(page, null);
  await mouse.to(1300, 560, 400);
  await mouse.scroll(260, 900);
}, { minMs: 6000 });

/* ───────────── S8 모든 처리가 기록된다 ───────────── */
await go(page, '/ax/reports');
await page.getByRole('tab', { name: /Evidence Log/ }).click(); await sleep(700);
const evReview = page.getByText(new RegExp(`검토 완료: ${esc(V.doc)}`)).first();
const evSubmit = page.getByText(new RegExp(`고객 제출: ${esc(V.doc)}`)).first();
const evSubmitMeta = evSubmit.locator('xpath=following-sibling::*[1]');
const feedCard = page.getByText(/Evidence Pack 구조/).first().locator('xpath=..');
await evReview.evaluate((e) => { const y = e.getBoundingClientRect().top + window.scrollY - 170; window.scrollTo(0, y); }); await sleep(400);
await clear(); await park(1250, 200);
await rec.shot(page, 's8-evidence', async () => {
  await sleep(250);
  await cap(page, '내부 AX · 실증 기록', '고객 제출 → <b>업무 자동 생성</b> → 검토 완료가 순서대로 남습니다');
  await sleep(500);
  await hlUnion(page, [evReview, evSubmit, evSubmitMeta], { widthOf: feedCard, pad: 8 });
  await mouse.over(evSubmit, 650);
  await sleep(500);
  await mouse.over(evReview, 700);
  await sleep(1100);
  await hl(page, null);
  await cap(page, '내부 AX · 실증 기록', '기준선과 실측을 나눠 측정 — <b>개선율은 실측 뒤에만</b> 표시합니다');
  await sleep(2400);
}, { minMs: 6800 });

/* ───────────── C9 마무리 ───────────── */
await rec.shot(card, 'c9-end', async () => {
  await card.setContent(endCard({
    title: 'KPJK Business AX',
    items: ['대표 · 담당자 · 고객 권한 분리', 'PC와 휴대폰에서 같은 화면', '모든 처리 이력 기록 · CSV 내보내기'],
    foot: V.endFoot,
  }));
  await sleep(4500);
});

const len = assemble(rec.clips, OUT + '/KPJK_AX_실사용_60초.mp4');
console.log('TOTAL', len.toFixed(2) + 's', '· pageerrors', errs.length, errs.slice(0, 2));
let t = 0; const marks = [];
for (const c of rec.clips) { marks.push(t + Math.min(c.dur - 0.5, c.dur * 0.72)); t += c.dur - 0.35; }
stills(OUT + '/KPJK_AX_실사용_60초.mp4', OUT + '/v1', marks);
await b.close();

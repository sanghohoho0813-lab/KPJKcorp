// "PC 에서 넣은 기업이 휴대폰에서 안 보인다" 재현과 해결 확인
//  1) 서버 연결 전(데모 저장소) PC 브라우저에만 기업 3곳(+샘플 1곳)이 있는 상태
//  2) 서버가 붙은 사이트에서 같은 PC 로 로그인 → 화면 위 "서버 연결 전에 입력했던 기업 3곳" (샘플 제외)
//  3) 서버로 올리기 → 서버에 3곳 → 휴대폰(다른 브라우저) 같은 계정에서 3곳
//  4) 같은 것을 또 가지고 들어와도 중복으로 올라가지 않는다
//  5) 휴대폰 왼쪽 위 메뉴(햄버거) — 연결 상태·로그인 아이디 표시, 메뉴 전체, 누르면 이동하고 닫힘
// 시험용 기업 이름은 지어낸 것(비식별).
import { launch, ctxFor, login, logout, B, ACC, ok, sql, body, summary } from './lib.mjs';

const TAG = Date.now().toString(36).slice(-4);
const NAMES = [`이월 검증 A ${TAG} (비식별)`, `이월 검증 B ${TAG} (비식별)`, `이월 검증 C ${TAG} (비식별)`];
const co = (i, name, extra = {}) => ({
  id: `co_local_${TAG}_${i}`, code: String.fromCharCode(65 + i), name, ceo: '비식별 대표', industry: '제조', bizNo: '', contactName: '비식별 담당',
  contactTitle: '대표', contactPhone: '010-0000-0000', contactEmail: '', address: '경기 화성시', employees: 5, revenue: '',
  firstConsultDate: new Date().toISOString(), consultantId: 'u_admin', memo: '', ...extra,
});
// 서버 주소가 없는 빌드(데모 저장소)에서 쓰던 브라우저 — 저장본의 기업 목록·운영 표시만 바꿔 같은 상태를 만든다
const plant = async (p) => {
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const planted = await p.evaluate((companies) => {
    const raw = localStorage.getItem('kpjk-ax-demo-v1');
    if (!raw) return false;
    const v = JSON.parse(raw);
    v.state = { ...v.state, serverMode: false, session: null, companies, settings: { ...v.state.settings, liveMode: true } };
    localStorage.setItem('kpjk-ax-demo-v1', JSON.stringify(v));
    return true;
  }, [...NAMES.map((n, i) => co(i, n)), co(9, '샘플 기업 (데모)', { sample: true })]);
  if (!planted) throw new Error('브라우저 저장본이 없습니다');
};

const b = await launch();
const { p } = await ctxFor(b, 'pc');

// 1~2
await plant(p);
await login(p, ACC.ceo, /\/ax\//);
const card = p.getByTestId('carryover-card');
await card.waitFor({ timeout: 8000 }).catch(() => {});
const ct = (await card.innerText().catch(() => '')).replace(/\n/g, ' ');
ok('2 로그인 뒤 "이 브라우저에만 입력했던 기업 3곳" 카드', /기업 3곳/.test(ct) && NAMES.every((n) => ct.includes(n)), ct.slice(0, 120));
ok('2 샘플 기업은 올릴 목록에 없음', !ct.includes('샘플 기업'));
ok('2 아직 서버에는 없음', sql(`select count(*) from companies where name like '이월 검증 % ${TAG} %'`) === '0');

// 3
await card.getByRole('button', { name: '서버로 올리기' }).click(); await p.waitForTimeout(3500);
ok('3 서버에 3곳 저장', sql(`select count(*) from companies where name like '이월 검증 % ${TAG} %'`) === '3');
ok('3 담당자는 올린 사람(데모 ID 아님)', sql(`select count(*) from companies c join profiles p on p.id = c.consultant_id where c.name like '이월 검증 % ${TAG} %' and p.email = '${ACC.ceo.id}'`) === '3');
ok('3 카드 사라짐', (await p.getByTestId('carryover-card').count()) === 0);
ok('3 보관 목록 지워짐', (await p.evaluate(() => localStorage.getItem('kpjk-local-carryover'))) === null);

const { p: m } = await ctxFor(b, 'mobile');
await login(m, ACC.ceo, /\/ax\//);
await m.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await m.waitForTimeout(2500);
const mt = await body(m);
ok('3 휴대폰(다른 브라우저)에서 3곳 보임', NAMES.every((n) => mt.includes(n)));

// 4 같은 것을 다시 가지고 들어와도 중복 없음
await logout(p);
await plant(p);
await login(p, ACC.ceo, /\/ax\//);
await p.getByTestId('carryover-card').getByRole('button', { name: '서버로 올리기' }).click({ timeout: 8000 }); await p.waitForTimeout(2500);
ok('4 다시 올려도 중복 없음', sql(`select count(*) from companies where name like '이월 검증 % ${TAG} %'`) === '3');

// 5 휴대폰 왼쪽 위 메뉴 (그 사이 PC 에서 로그아웃했다 — 휴대폰은 그대로 로그인돼 있어야 한다)
await m.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await m.waitForTimeout(2500);
ok('5 PC 로그아웃해도 휴대폰은 로그인 유지', /\/ax\//.test(m.url()), m.url());
const hb = m.getByTestId('mobile-menu-button');
const box = await hb.boundingBox();
ok('5 햄버거 버튼: 왼쪽 위', !!box && box.x < 40 && box.y < 60, box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'none');
ok('5 손가락 크기(40px)', !!box && box.width >= 40 && box.height >= 40);
await hb.click(); await m.waitForTimeout(500);
const menu = m.getByTestId('mobile-menu');
ok('5 메뉴 열림', await menu.isVisible().catch(() => false));
const cs = m.getByTestId('connection-status');
ok('5 연결 상태: 서버', (await cs.getAttribute('data-mode')) === 'server');
ok('5 로그인 아이디 표시', (await cs.innerText()).includes(ACC.ceo.id));
const labels = ['대시보드', '기업고객', '지원사업 매칭', '일정 · 공지', '리포트 · 실증', '설정'];
const mtx = await menu.innerText();
ok('5 메뉴 전체(대시보드~설정)', labels.every((l) => mtx.includes(l)), labels.filter((l) => !mtx.includes(l)).join(','));
await menu.getByRole('link', { name: /지원사업 매칭/ }).click(); await m.waitForURL(/\/ax\/programs/, { timeout: 8000 }).catch(() => {});
await m.waitForTimeout(600);
ok('5 누르면 이동', /\/ax\/programs/.test(m.url()));
ok('5 이동 후 메뉴 닫힘', (await m.getByTestId('mobile-menu').count()) === 0);
for (const w of [360, 390]) {
  await m.setViewportSize({ width: w, height: 800 }); await m.waitForTimeout(300);
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`5 폭 ${w}px 가로 넘침 없음`, ov <= 0, String(ov));
}
ok('페이지 오류 없음', [...p.errs, ...m.errs].filter((e) => !/Failed to load resource|favicon/.test(e)).length === 0, [...p.errs, ...m.errs].slice(0, 2).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);

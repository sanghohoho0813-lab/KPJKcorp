// 저장 실패 보호: 서버 저장이 막힌 사이 입력한 기업이 사라지지 않는가 / 연결되면 자동으로 들어가는가
// + 서버 사이트에서 이 브라우저만 데모일 때 경고가 보이는가
import { launch, ctxFor, login, B, ACC, ok, sql, body, summary } from './lib.mjs';
const b = await launch();
const { ctx, p } = await ctxFor(b, 'pc');
await login(p, ACC.ceo, /\/ax\//);
const NAME = `저장실패 보호 확인 ${Date.now().toString().slice(-5)} (비식별)`;
let blocked = true;
await ctx.route(/:54321\/rest\/v1\/(companies|activities)/, (r) => (blocked && r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue()));
await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
await p.getByRole('button', { name: '기업고객 등록' }).first().click(); await p.waitForTimeout(600);
const dlg = p.locator('[role=dialog]:visible').last();
await dlg.getByLabel(/^기업명/).first().fill(NAME);
await dlg.getByLabel(/^대표자/).first().fill('비식별 대표');
await dlg.getByRole('button', { name: '등록', exact: true }).click(); await p.waitForTimeout(3000);
ok('막힌 동안: 서버엔 없음', sql(`select count(*) from companies where name='${NAME}'`) === '0');
ok('빨간 안내 "저장되지 않은 변경"', await p.getByTestId('unsaved-banner').isVisible());
await p.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(20000);   // 자동 갱신 한 번 이상
ok('20초 뒤(자동 갱신)에도 화면에 남아 있음', (await body(p)).includes(NAME));
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000);
ok('새로고침 뒤에도 화면에 남아 있음', (await body(p)).includes(NAME));
ok('안내 계속 보임(닫기 없음)', await p.getByTestId('unsaved-banner').isVisible());
blocked = false;
await p.getByTestId('unsaved-banner').getByRole('button', { name: '다시 보내기' }).click(); await p.waitForTimeout(4000);
ok('연결 후 다시 보내기 → 서버에 저장', sql(`select count(*) from companies where name='${NAME}'`) === '1');
ok('안내 사라짐', !(await p.getByTestId('unsaved-banner').isVisible().catch(() => false)));
// 다른 기기에서 보이는가
const { p: m } = await ctxFor(b, 'mobile');
await login(m, ACC.ceo, /\/ax\//);
await m.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' }); await m.waitForTimeout(2500);
ok('휴대폰에서도 보임', (await body(m)).includes(NAME));

// 서버 사이트에서 이 브라우저만 데모
const { p: d } = await ctxFor(b, 'pc');
await d.goto(B + '/login?demo=1', { waitUntil: 'domcontentloaded' }); await d.waitForTimeout(2500);
await d.getByRole('button', { name: '이 브라우저를 데모 모드로 전환' }).click(); await d.waitForTimeout(3000);
await login(d, { id: 'ceo@kpjk.co.kr', pw: 'kpjk2026!' }, /\/ax\//);
ok('데모 브라우저: 빨간 경고 상시', await d.getByTestId('demo-forced-banner').isVisible());
ok('데모 브라우저: 서버 기업 안 보임', !(await body(d)).includes(NAME));
const fails = summary(); await b.close(); process.exit(fails ? 1 : 0);

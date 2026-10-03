// 내부 알림 읽음은 계정마다 따로 — 컨설턴트가 "모두 읽음"을 눌러도 대표에게는 안 읽음으로 남는다
//  1) 서버에 내부 알림 1건 (모든 내부 계정이 보는 알림)
//  2) 컨설턴트: 알림 목록에 안 읽음으로 → 모두 읽음 → 안 읽음 표시 사라짐 · 서버 read_by 에 컨설턴트만 · read 칸 그대로
//  3) 대표(다른 브라우저): 같은 알림이 여전히 안 읽음 → 눌러서 읽음 → read_by 2명
//  4) 컨설턴트 새로고침: 대표가 읽은 것과 상관없이 계속 읽음 · 대표 새로고침: 읽음 유지
import { launch, ctxFor, login, B, ACC, ok, sql, summary } from './lib.mjs';

const TAG = Date.now().toString(36).slice(-5);
const ID = `nt_rd_${TAG}`;
const TITLE = `읽음 분리 시험 ${TAG}`;
sql(`insert into public.notifications(id, audience, company_id, title, body, href) values ('${ID}', 'internal', null, '${TITLE}', '계정별 읽음 확인', '/ax/dashboard')`);

const item = (p) => p.locator('a', { hasText: TITLE }).first();
const openBell = async (p) => {
  await p.getByRole('button', { name: '알림', exact: true }).first().click();
  await item(p).waitFor({ timeout: 8000 }).catch(() => {});
};
const unreadDot = async (p) => (await item(p).locator('span.rounded-full.bg-accent').count()) > 0;
const readBy = () => sql(`select coalesce(array_to_string(read_by, ','), '') from public.notifications where id = '${ID}'`);
const uid = (email) => sql(`select id from public.profiles where email = '${email}'`);

const b = await launch();
const { p: con } = await ctxFor(b, 'pc');
await login(con, ACC.con, /\/ax\//);
await con.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2000);
await openBell(con);
ok('2 컨설턴트: 새 알림이 목록에', await item(con).isVisible().catch(() => false));
ok('2 컨설턴트: 안 읽음 표시', await unreadDot(con));
await con.getByRole('button', { name: '모두 읽음' }).click(); await con.waitForTimeout(2500);
ok('2 컨설턴트: 모두 읽음 → 안 읽음 표시 사라짐', !(await unreadDot(con)));
const conId = uid(ACC.con.id), ceoId = uid(ACC.ceo.id);
ok('2 서버: 읽은 사람에 컨설턴트만', readBy() === conId, readBy());
ok('2 서버: 예전 읽음 칸은 그대로(다른 사람에겐 안 읽음)', sql(`select read from public.notifications where id = '${ID}'`) === 'f');

const { p: ceo } = await ctxFor(b, 'pc');
await login(ceo, ACC.ceo, /\/ax\//);
await ceo.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2000);
await openBell(ceo);
ok('3 대표: 같은 알림이 여전히 안 읽음', await unreadDot(ceo));
await item(ceo).click(); await ceo.waitForTimeout(2500);
const rb = readBy().split(',').sort();
ok('3 서버: 읽은 사람 2명 (덮어쓰지 않고 더함)', rb.length === 2 && rb.includes(conId) && rb.includes(ceoId), rb.join(','));

await con.reload({ waitUntil: 'domcontentloaded' }); await con.waitForTimeout(2500);
await openBell(con);
ok('4 컨설턴트 새로고침 뒤에도 읽음', !(await unreadDot(con)));
await ceo.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' }); await ceo.waitForTimeout(2500);
await openBell(ceo);
ok('4 대표 새로고침 뒤에도 읽음', !(await unreadDot(ceo)));
ok('페이지 오류 없음', [...con.errs, ...ceo.errs].filter((e) => !/Failed to load resource|favicon/.test(e)).length === 0, [...con.errs, ...ceo.errs].slice(0, 2).join(' | '));
sql(`delete from public.notifications where id = '${ID}'`);
await b.close();
process.exit(summary() ? 1 : 0);

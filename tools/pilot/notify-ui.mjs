// 고객 화면 "버튼"을 실제로 눌러서 → 담당 컨설턴트·대표 화면에 알림 팝업이 뜨는지 반복 확인 (실제 서버)
//  새 문의 · 추가 문의 · 상담 요청 · 관심 있어요 · 요청 취소 · 지원사업 물어보기 · 자료 제출
//  node tools/pilot/notify-ui.mjs        (기본 10바퀴, R=20 처럼 바꿀 수 있음)
import { launch, ctxFor, login, B, ACC, CO1, FILES, ok, sql, summary } from './lib.mjs';

const R = Number(process.env.R || 10);
const co = sql(`select id from public.companies where name = '${CO1}' limit 1`);
const conId = sql(`select consultant_id from public.companies where id = '${co}'`);
// 지원사업: 담당자가 이 회사에 보낸 공고로 만들어 고객 화면 '담당 컨설턴트가 보낸 공고'에 보이게
for (let i = 1; i <= 2; i++) sql(`insert into public.support_programs (id, title, agency, source, apply_end, notified) values ('pg_ui_${i}', '[시험] 버튼 확인용 공고 ${i}', '시험기관', 'manual', current_date + 30, array['${co}']) on conflict (id) do update set notified = array['${co}']`);
const AREAS = ['가수금', '이익잉여금', '재무세무', '특허자본', '세무조사', '법인전환'];
// 이미 진행 중인 요청이 있는 분야는 앱이 "이미 요청하셨습니다"로 막는다(정상) — 아직 요청하지 않은 분야를 고른다
async function openFreeArea(start, btn) {
  for (let k = 0; k < AREAS.length; k++) {
    await cli.locator('#portal-kpjk-areas').getByRole('button', { name: AREAS[(start + k) % AREAS.length] }).click();
    if (await dlg().getByRole('button', { name: btn, exact: true }).isVisible({ timeout: 1500 }).catch(() => false)) return;
    await dlg().getByRole('button', { name: '닫기' }).last().click();
    await cli.waitForTimeout(300);
  }
  throw new Error('요청 가능한 분야 없음');
}

const b = await launch();
const { p: cli } = await ctxFor(b, 'mobile');
await login(cli, ACC.c1, /\/portal/);
const { p: con } = await ctxFor(b, 'pc');
await login(con, ACC.con, /\/ax\//);
await con.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' });
const { p: ceo } = await ctxFor(b, 'pc');
await login(ceo, ACC.ceo, /\/ax\//);
await ceo.goto(B + '/ax/clients', { waitUntil: 'domcontentloaded' });

const dbNow = () => sql('select clock_timestamp()');
async function waitDb(since, re) {
  for (let t = 0; t < 80; t++) {
    const rows = sql(`select id || '|' || title from public.notifications where audience = 'internal' and company_id = '${co}' and at > '${since}'::timestamptz - interval '3 seconds' order by at desc`).split('\n').filter(Boolean);
    const hit = rows.map((r) => r.split('|')).find(([, title]) => new RegExp(re).test(title));
    if (hit) return hit[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
async function popup(page, nid) {
  const el = page.locator(`[data-testid=live-popup][data-nid="${nid}"]`);
  const t0 = Date.now();
  try { await el.waitFor({ state: 'visible', timeout: 25000 }); } catch { return null; }
  const ms = Date.now() - t0;
  await el.getByRole('button', { name: '알림 닫기' }).click().catch(() => {});
  return ms;
}
const res = {};
const lat = [];
const fails = [];
async function check(label, since, re) {
  res[label] = res[label] ?? { n: 0, ok: 0 };
  res[label].n++;
  const nid = await waitDb(since, re);
  if (!nid) { fails.push(`${label}: 서버 알림 없음`); return; }
  const [a, c] = await Promise.all([popup(con, nid), popup(ceo, nid)]);
  if (a !== null) lat.push(a); else fails.push(`${label}: 컨설턴트 팝업 안 뜸`);
  if (c !== null) lat.push(c); else fails.push(`${label}: 대표 팝업 안 뜸`);
  if (a !== null && c !== null) res[label].ok++;
}
const dlg = () => cli.locator('[role=dialog]:visible').last();
async function step(label, re, fn) {
  const since = dbNow();
  try { await fn(); } catch (e) {
    res[label] = res[label] ?? { n: 0, ok: 0 }; res[label].n++; fails.push(`${label}: 버튼 조작 실패 ${String(e).slice(0, 120)}`);
    if (process.env.SHOT) await cli.screenshot({ path: `${process.env.SHOT}/fail-${fails.length}.png` }).catch(() => {});
    await cli.keyboard.press('Escape').catch(() => {});
    return;
  }
  await check(label, since, re);
}
async function cancelFirst(where) {
  const btn = cli.getByRole('button', { name: '요청 취소' }).first();
  await btn.click();
  await dlg().getByRole('button', { name: '요청 취소' }).click();
  await cli.waitForTimeout(600);
  void where;
}

for (let r = 1; r <= R; r++) {
  const tag = `[UI${r}]`;
  // 1) 새 문의
  await cli.goto(B + '/portal/inquiries', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1200);
  await step('새 문의', '^새 문의', async () => {
    await cli.getByRole('button', { name: '새 문의' }).first().click();
    await dlg().getByPlaceholder(/결과보고 일정이/).fill(`${tag} 중간 보고 일정 문의`);
    await dlg().getByPlaceholder(/궁금한 내용을/).fill(`${tag} 다음 주 가능할까요?`);
    await dlg().getByRole('button', { name: '문의 보내기' }).click();
  });
  // 2) 추가 문의 (방금 남긴 문의에)
  await step('추가 문의', '^고객 추가 문의', async () => {
    await cli.getByRole('button', { name: new RegExp(`\\${tag.slice(0, -1)}\\] 중간 보고`) }).first().click();
    await cli.getByPlaceholder('추가로 궁금한 점을 남겨주세요.').fill(`${tag} 자료도 같이 준비할까요?`);
    await cli.getByRole('button', { name: '보내기', exact: true }).click();
  });
  // 3) 상담 요청 → 4) 요청 취소
  await cli.goto(B + '/portal/services', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1200);
  await step('상담 요청', '^상담 요청', async () => {
    await openFreeArea(r, '상담 요청');
    await dlg().getByRole('button', { name: '상담 요청', exact: true }).click();
    await cli.waitForTimeout(300);
    await dlg().getByRole('button', { name: '상담 요청', exact: true }).click();
  });
  await cli.waitForTimeout(800);
  await step('요청 취소', '^요청 취소', () => cancelFirst('services'));
  // 5) 관심 있어요 → 취소
  await step('관심 있어요', '^추가서비스 관심', async () => {
    await openFreeArea(r + 3, '관심 있어요');
    await dlg().getByRole('button', { name: '관심 있어요' }).click();
    await cli.waitForTimeout(300);
    await dlg().getByRole('button', { name: '관심 남기기' }).click();
  });
  await cli.waitForTimeout(800);
  await step('요청 취소', '^요청 취소', () => cancelFirst('services'));
  // 6) 지원사업 물어보기 → 취소
  await cli.goto(B + '/portal/programs', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(1500);
  await step('지원사업 물어보기', '^지원사업 문의', async () => {
    await cli.getByTestId('programs-sent').getByRole('button', { name: '담당 컨설턴트에게 물어보기' }).first().click();
    await dlg().getByRole('textbox').fill(`${tag} 신청 가능할까요?`);
    await dlg().getByRole('button', { name: '보내기' }).click();
  });
  await cli.waitForTimeout(800);
  await step('요청 취소', '^요청 취소', () => cancelFirst('programs'));
  // 7) 자료 제출 — 담당자가 요청해 둔 자료에 파일을 올린다
  const did = `dr_ui_${Date.now().toString(36)}`;
  sql(`insert into public.document_requests (id, company_id, name, description, requested_at, due_date, status, assignee_id) values ('${did}', '${co}', '${tag} 4대보험 가입자 명부', '시험', now(), now() + interval '5 days', 'requested', '${conId}')`);
  await cli.goto(B + '/portal/documents', { waitUntil: 'domcontentloaded' }); await cli.waitForTimeout(2500);
  await step('자료 제출', '^새 자료 도착', async () => {
    const card = cli.locator('div', { hasText: `${tag} 4대보험 가입자 명부` }).filter({ has: cli.getByRole('button', { name: /업로드/ }) }).last();
    await card.getByRole('button', { name: /업로드/ }).first().click();
    await dlg().locator('input[type=file]').first().setInputFiles(FILES + 'pilot-a1.txt');
    await cli.waitForTimeout(400);
    await dlg().getByRole('button', { name: /제출하기/ }).click();
  });
  console.log(`… ${r}/${R}바퀴 · ${JSON.stringify(res)} · 실패 ${fails.length}`);
}
const s = [...lat].sort((x, y) => x - y);
const total = Object.values(res).reduce((n, x) => n + x.n, 0);
const good = Object.values(res).reduce((n, x) => n + x.ok, 0);
ok(`버튼 ${total}회 → 컨설턴트·대표 화면 모두 팝업`, good === total, `${good}/${total}`);
for (const [k, v] of Object.entries(res)) ok(`  ${k}`, v.ok === v.n, `${v.ok}/${v.n}`);
ok(`화면에 뜨기까지 — 중앙 ${s[Math.floor(s.length / 2)]}ms · 최대 ${s.at(-1)}ms`, (s.at(-1) ?? 99999) < 25000);
if (fails.length) console.log('실패 목록:\n' + fails.slice(0, 20).join('\n'));
ok('페이지 오류 없음', [cli, con, ceo].every((p) => p.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT/.test(e)).length === 0), [cli, con, ceo].flatMap((p) => p.errs).filter((e) => !/Failed to load resource|ERR_CERT/.test(e)).slice(0, 3).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);

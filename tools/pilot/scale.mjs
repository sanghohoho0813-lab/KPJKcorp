// 데이터가 쌓여도 빠짐없이 · 가볍게
//  Supabase 는 한 번에 1000줄까지만 준다. 그냥 읽으면 1000줄을 넘는 표는 말없이 잘린다.
//  1) 시험 공고 1300건 · 시험 활동 2500건 · 시험 알림 1100건을 넣고 대표로 로그인 → 화면에 서버 건수 그대로(잘림 없음)
//  2) 아무것도 바뀌지 않으면 다시 읽을 때 큰 표를 받지 않는다 (공고·활동·알림 본문 0, 전체 200KB 미만)
//  3) 다른 사람이 활동을 추가 → 늘어난 것만 받아 화면에 붙는다(활동 50KB 미만) · 건수 서버와 같음
//  4) 공고 수정·삭제 → 다음 갱신에 반영
//  5) 고객 휴대폰: 공고 전체 · 갱신 가벼움
//  6) 로그인 없는 지원사업 찾기 화면: 끝나지 않은 공고 전부(1000건 넘게)
//  시험 데이터는 끝나면 지운다.
import { launch, ctxFor, login, B, ACC, ok, sql, summary, mem } from './lib.mjs';

const TAG = Date.now().toString(36).slice(-5);
const co = sql(`select id from public.companies order by id limit 1`);
sql(`insert into public.support_programs(id, title, agency, category, regions, apply_end, source, tags)
  select 'sc_${TAG}_' || g, '규모 시험 공고 ' || g || ' (시험용)', '시험 기관', '기타', '{}', case when g % 3 = 0 then null else current_date + (g % 90) end, 'manual', '{}'
  from generate_series(1, 1300) g`);
sql(`insert into public.activities(id, type, company_id, actor_role, at, message)
  select 'sc_${TAG}_' || g, 'task_done', '${co}', 'consultant', now() - (g || ' minutes')::interval, '규모 시험 활동 ' || g || ' (시험용)'
  from generate_series(1, 2500) g`);
sql(`insert into public.notifications(id, audience, company_id, title, body, href, at)
  select 'sc_${TAG}_' || g, 'internal', null, '규모 시험 알림 ' || g, '시험용', '/ax/dashboard', now() - (g || ' minutes')::interval
  from generate_series(1, 1100) g`);
const cnt = (q) => +sql(q);

const b = await launch();
try {
  const { p } = await ctxFor(b, 'pc');
  let rec = [];
  p.on('requestfinished', async (r) => {
    if (!/rest\/v1\//.test(r.url())) return;
    const s = await r.sizes().catch(() => null);
    rec.push({ url: r.url(), t: r.url().replace(/^.*rest\/v1\//, '').split('?')[0], head: r.method() === 'HEAD', b: s ? s.responseBodySize : 0 });
  });
  await login(p, ACC.ceo, /\/ax\//);
  await p.waitForTimeout(3000);
  const refresh = async () => { rec = []; await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(4500); };
  const kb = (t) => Math.round(rec.filter((r) => !t || r.t === t).reduce((n, r) => n + r.b, 0) / 1024);
  // 큰 표 본문(건수·최신 시각 확인용 작은 요청 제외)
  const bodyKb = (t) => Math.round(rec.filter((r) => r.t === t && !/limit=1|select=id/.test(r.url) && !r.head).reduce((n, r) => n + r.b, 0) / 1024);

  // 1) 잘림 없음
  await refresh();
  let s = await mem(p);
  const dbProg = cnt(`select count(*) from public.support_programs`);
  const dbAct = cnt(`select count(*) from public.activities`);
  ok('1 공고: 서버 건수 그대로 (1000건에서 잘리지 않음)', s.programs.length === dbProg && dbProg > 1000, `${s.programs.length} / ${dbProg}`);
  ok('1 활동 기록: 서버 건수 그대로', s.activities.length === dbAct && dbAct > 1000, `${s.activities.length} / ${dbAct}`);
  const dbNoti = cnt(`select count(*) from public.notifications where audience = 'internal'`);
  ok('1 알림: 서버 건수 그대로', s.notifications.filter((n) => n.audience === 'internal').length === dbNoti, `${s.notifications.filter((n) => n.audience === 'internal').length} / ${dbNoti}`);

  // 2) 변화 없음 → 큰 표 안 받음
  await refresh();
  ok('2 변화 없음: 공고 본문 안 받음', bodyKb('support_programs') === 0, `${bodyKb('support_programs')}KB`);
  ok('2 변화 없음: 활동 본문 안 받음', bodyKb('activities') === 0, `${bodyKb('activities')}KB`);
  ok('2 변화 없음: 알림 본문 안 받음', bodyKb('notifications') === 0, `${bodyKb('notifications')}KB`);
  ok('2 한 번 갱신 전체 200KB 미만', kb() < 200, `${kb()}KB`);

  // 3) 활동 추가 → 늘어난 것만
  sql(`insert into public.activities(id, type, company_id, actor_role, at, message)
    select 'sc_${TAG}_new' || g, 'task_done', '${co}', 'consultant', now(), '규모 시험 새 활동 ' || g from generate_series(1, 3) g`);
  await refresh();
  s = await mem(p);
  ok('3 새 활동 3건 화면에', s.activities.filter((a) => /규모 시험 새 활동/.test(a.text ?? a.message ?? '')).length === 3);
  ok('3 늘어난 것만 받음 (활동 50KB 미만)', kb('activities') < 50, `${kb('activities')}KB`);
  ok('3 활동 건수 서버와 같음', s.activities.length === cnt(`select count(*) from public.activities`));
  ok('3 최신 활동이 맨 앞', /규모 시험 새 활동/.test(s.activities[0]?.text ?? s.activities[0]?.message ?? ''), s.activities[0]?.text ?? '');

  // 4) 공고 수정·삭제
  sql(`update public.support_programs set title = '규모 시험 공고 바뀜 ${TAG}' where id = 'sc_${TAG}_7'`);
  sql(`delete from public.support_programs where id = 'sc_${TAG}_8'`);
  await refresh();
  s = await mem(p);
  ok('4 공고 수정 반영', s.programs.some((x) => x.title === `규모 시험 공고 바뀜 ${TAG}`));
  ok('4 공고 삭제 반영', !s.programs.some((x) => x.id === `sc_${TAG}_8`) && s.programs.length === cnt(`select count(*) from public.support_programs`));
  // 7) 이 브라우저 저장은 작게 · 새로고침해도 서버에서 전부
  const ls = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('kpjk-ax')); const v = localStorage.getItem(k) ?? ''; const st = JSON.parse(v).state; return { kb: Math.round(v.length / 1024), act: st.activities.length, prog: st.programs.length }; });
  ok('7 브라우저 저장 1MB 미만 (공고·활동 기록 전부를 남기지 않음)', ls.kb < 1024, `${ls.kb}KB · 활동 ${ls.act} · 공고 ${ls.prog}`);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000);
  s = await mem(p);
  ok('7 새로고침 → 공고·활동 다시 전부', s.programs.length === cnt(`select count(*) from public.support_programs`) && s.activities.length === cnt(`select count(*) from public.activities`), `${s.programs.length} · ${s.activities.length}`);

  // 8) 브라우저 저장이 꽉 차도 버튼이 먹는다
  await p.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('kpjk-ax')) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  const pageErrs = p.errs.length;
  await p.getByRole('button', { name: '알림', exact: true }).first().click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: '모두 읽음' }).click(); await p.waitForTimeout(2500);
  const me = sql(`select id from public.profiles where email = '${ACC.ceo.id}'`);
  ok('8 저장 공간이 꽉 차도 "모두 읽음" 동작 (서버 반영)', cnt(`select count(*) from public.notifications where audience = 'internal' and not ('${me}' = any(read_by))`) === 0);
  ok('8 페이지 오류 없음', p.errs.slice(pageErrs).filter((e) => /Quota|Uncaught|pageerror/i.test(e)).length === 0, p.errs.slice(pageErrs).slice(0, 2).join(' | '));
  await p.keyboard.press('Escape');

  ok('페이지 오류 없음 (대표)', p.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT/.test(e)).length === 0, p.errs.slice(0, 2).join(' | '));

  // 5) 고객 휴대폰
  const { p: c } = await ctxFor(b, 'mobile');
  await login(c, ACC.c1, /\/portal/);
  await c.waitForTimeout(3000);
  const cs = await mem(c);
  ok('5 고객: 공고 전체', cs.programs.length === cnt(`select count(*) from public.support_programs`), `${cs.programs.length}`);
  let crec = [];
  c.on('requestfinished', async (r) => { if (!/rest\/v1\//.test(r.url())) return; const z = await r.sizes().catch(() => null); crec.push(z ? z.responseBodySize : 0); });
  await c.evaluate(() => window.dispatchEvent(new Event('focus'))); await c.waitForTimeout(4500);
  crec = []; // 로그인 직후 한 번은 제외하고, 그다음 갱신을 잰다
  await c.evaluate(() => window.dispatchEvent(new Event('focus'))); await c.waitForTimeout(4500);
  const ckb = Math.round(crec.reduce((n, x) => n + x, 0) / 1024);
  ok('5 고객 갱신 100KB 미만', ckb < 100, `${ckb}KB`);

  // 6) 로그인 없는 지원사업 찾기
  const { p: g } = await ctxFor(b, 'mobile');
  let rows = 0;
  g.on('response', async (r) => { if (/rest\/v1\/support_programs/.test(r.url()) && r.request().method() === 'GET') { try { rows += (await r.json()).length; } catch { /* 무시 */ } } });
  await g.goto(B + '/match', { waitUntil: 'domcontentloaded' }); await g.waitForTimeout(5000);
  const open = cnt(`select count(*) from public.support_programs where apply_end is null or apply_end >= current_date`);
  ok('6 지원사업 찾기: 끝나지 않은 공고 전부', rows === open && open > 1000, `${rows} / ${open}`);
} finally {
  sql(`delete from public.support_programs where id like 'sc_${TAG}_%'`);
  sql(`delete from public.activities where id like 'sc_${TAG}_%'`);
  sql(`delete from public.notifications where id like 'sc_${TAG}_%'`);
  await b.close();
}
process.exit(summary() ? 1 : 0);

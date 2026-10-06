// 고객 행동 → 담당 컨설턴트·대표 화면 알림 — 수백 번 반복 시험 (실제 서버)
//  고객(휴대폰)이 문의 · 추가 문의 · 상담 요청 · 관심 표시 · 지원사업 물어보기 · 요청 취소를 하면
//  1) 서버에 내부 알림이 저장되고  2) 컨설턴트 PC 와 대표 PC 화면 구석에 팝업이 실제로 뜨고
//  3) 종 아이콘(안 읽음)에 들어가고  4) 업무가 생겨야 하는 행동은 담당자 업무가 생기는지
//  를 한 번 한 번 확인한다. 화면에 뜨기까지 걸린 시간도 잰다.
//  node tools/pilot/notify.mjs            (기본 300회, N=500 처럼 바꿀 수 있음)
import { launch, ctxFor, login, B, ACC, CO1, ok, sql, summary } from './lib.mjs';

const N = Number(process.env.N || 300);
const POPUP_MS = Number(process.env.POPUP_MS || 25000);
const co = sql(`select id from public.companies where name = '${CO1}' limit 1`);
const conId = sql(`select consultant_id from public.companies where id = '${co}'`);
for (let i = 1; i <= 3; i++) sql(`insert into public.support_programs (id, title, agency, source, apply_end) values ('pg_nt_${i}', '[시험] 알림 확인용 공고 ${i}', '시험기관', 'manual', current_date + 30) on conflict (id) do nothing`);
const KEYS = ['kpjk_가지급금', 'kpjk_가수금', 'kpjk_이익잉여금', 'kpjk_가업승계', 'kpjk_인사노무', 'kpjk_기업부설연구소', 'kpjk_특허자본', 'kpjk_재무세무'];

const b = await launch();
const { p: cli } = await ctxFor(b, 'mobile');
await login(cli, ACC.c1, /\/portal/);
const { p: con } = await ctxFor(b, 'pc');
await login(con, ACC.con, /\/ax\//);
await con.goto(B + '/ax/dashboard', { waitUntil: 'domcontentloaded' });
const { p: ceo } = await ctxFor(b, 'pc');
await login(ceo, ACC.ceo, /\/ax\//);
await ceo.goto(B + '/ax/tasks', { waitUntil: 'domcontentloaded' });
await cli.goto(B + '/portal', { waitUntil: 'domcontentloaded' });
await cli.waitForTimeout(3000);
const me = await cli.evaluate(() => window.__kpjkState().session.userId);

/** 고객 화면에서 실제 앱 코드(store 동작)로 행동한다 — 버튼을 누른 것과 같은 길로 서버에 저장된다 */
async function act(kind, i) {
  return cli.evaluate(async ({ kind, i, co, me, KEYS }) => {
    const s = window.__kpjkState();
    const tag = `[NT${i}]`;
    if (kind === 'inquiry') { s.createInquiry({ companyId: co, title: `${tag} 결과보고 일정 문의`, category: '일정', body: `${tag} 확인 부탁드립니다.` }, me); return { expect: '^새 문의', task: `${tag} 결과보고` }; }
    if (kind === 'reply') {
      const iq = s.inquiries.find((x) => x.companyId === co);
      if (!iq) { s.createInquiry({ companyId: co, title: `${tag} 첫 문의`, category: '기타', body: tag }, me); return { expect: '^새 문의', task: `${tag} 첫 문의` }; }
      s.replyInquiry(iq.id, `${tag} 추가로 궁금한 점이 있습니다.`, me, 'client'); return { expect: '^고객 추가 문의' };
    }
    if (kind === 'request' || kind === 'interest') {
      const key = KEYS[i % KEYS.length];
      s.raiseOpportunity({ companyId: co, serviceKey: key, source: kind === 'request' ? 'portal_request' : 'portal_interest', note: `${tag} 연락 부탁드립니다` }, me, 'client');
      return { expect: kind === 'request' ? '^상담 요청' : '^추가서비스 관심', task: '관심 — 상담 연락', cancelKey: key };
    }
    if (kind === 'program') {
      const pid = `pg_nt_${(i % 3) + 1}`;
      // 이미 물어본 공고면 먼저 취소(취소도 담당자 알림이 간다) — 다음 회차에 다시 물어볼 수 있게
      const okAsk = s.askProgram(pid, co, me, `${tag} 신청 가능할까요?`);
      return okAsk ? { expect: '^지원사업 문의', task: '관심 — 상담 연락', cancelKey: 'support_program' } : { error: '공고를 찾지 못함' };
    }
    return { error: 'unknown' };
  }, { kind, i, co, me, KEYS });
}
async function cancelLatest(serviceKey) {
  return cli.evaluate(async ({ co, me, serviceKey }) => {
    const s = window.__kpjkState();
    const o = s.opportunities.find((x) => x.companyId === co && x.serviceKey === serviceKey && (x.source === 'portal_request' || x.source === 'portal_interest') && x.status !== 'dropped');
    if (!o) return { error: '취소할 요청 없음' };
    const r = await s.cancelMyRequest(o.id, me);
    return r.ok ? { expect: '^요청 취소' } : { error: r.reason };
  }, { co, me, serviceKey });
}

const dbNow = () => sql('select clock_timestamp()');
async function waitDb(since, re) {
  for (let t = 0; t < 60; t++) {
    const rows = sql(`select id || '|' || title from public.notifications where audience = 'internal' and company_id = '${co}' and at > '${since}'::timestamptz - interval '3 seconds' order by at desc`).split('\n').filter(Boolean);
    const hit = rows.map((r) => r.split('|')).find(([, title]) => new RegExp(re).test(title));
    if (hit) return hit[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
async function popup(page, nid) {
  const t0 = Date.now();
  const el = page.locator(`[data-testid=live-popup][data-nid="${nid}"]`);
  try { await el.waitFor({ state: 'visible', timeout: POPUP_MS }); } catch { return null; }
  const ms = Date.now() - t0;
  const unread = await page.evaluate((nid) => { const s = window.__kpjkState(); const n = s.notifications.find((x) => x.id === nid); return !!n && !(n.readBy ?? []).includes(s.session.userId); }, nid);
  await el.getByRole('button', { name: '알림 닫기' }).click().catch(() => {});
  return { ms, unread };
}

const KINDS = ['inquiry', 'request', 'reply', 'program', 'interest'];
const stats = { total: 0, db: 0, con: 0, ceo: 0, task: 0, taskNeed: 0, lat: [], fails: [] };
const byKind = {};
const one = async (label, res, since) => {
  stats.total++;
  byKind[label] = byKind[label] ?? { n: 0, ok: 0 };
  byKind[label].n++;
  if (res.error) { stats.fails.push(`${label}: ${res.error}`); return; }
  const nid = await waitDb(since, res.expect);
  if (!nid) { stats.fails.push(`${label}: 서버에 알림 없음`); return; }
  stats.db++;
  const [a, c] = await Promise.all([popup(con, nid), popup(ceo, nid)]);
  if (a?.unread) { stats.con++; stats.lat.push(a.ms); } else stats.fails.push(`${label}: 컨설턴트 화면 팝업 ${a ? '떴으나 안 읽음 아님' : '안 뜸'} (${nid})`);
  if (c?.unread) { stats.ceo++; stats.lat.push(c.ms); } else stats.fails.push(`${label}: 대표 화면 팝업 ${c ? '떴으나 안 읽음 아님' : '안 뜸'} (${nid})`);
  if (res.task) {
    stats.taskNeed++;
    const n = Number(sql(`select count(*) from public.tasks where company_id = '${co}' and assignee_id::text = '${conId}' and created_at > '${since}'::timestamptz - interval '3 seconds' and title like '%${res.task.replace(/'/g, "''")}%'`));
    if (n > 0) stats.task++; else stats.fails.push(`${label}: 담당자 업무 없음`);
  }
  if (a?.unread && c?.unread) byKind[label].ok++;
};

const started = Date.now();
for (let i = 1; i <= N; i++) {
  const kind = KINDS[i % KINDS.length];
  let since = dbNow();
  const res = await act(kind, i);
  await one(kind, res, since);
  if (res.cancelKey) {
    since = dbNow();
    await one('cancel', await cancelLatest(res.cancelKey), since);
  }
  if (i % 25 === 0) {
    const sorted = [...stats.lat].sort((x, y) => x - y);
    console.log(`… ${i}/${N}회 · 알림 ${stats.total}건 · 서버 ${stats.db} · 컨설턴트 팝업 ${stats.con} · 대표 팝업 ${stats.ceo} · 업무 ${stats.task}/${stats.taskNeed} · 중앙 ${sorted[Math.floor(sorted.length / 2)] ?? '-'}ms · 최대 ${sorted.at(-1) ?? '-'}ms · 실패 ${stats.fails.length} · ${Math.round((Date.now() - started) / 1000)}초`);
  }
}
const sorted = [...stats.lat].sort((x, y) => x - y);
const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
console.log(JSON.stringify(byKind));
ok(`고객 행동 ${N}회 → 알림 ${stats.total}건 모두 서버 저장`, stats.db === stats.total, `${stats.db}/${stats.total}`);
ok('컨설턴트 PC 화면 팝업 (안 읽음)', stats.con === stats.total, `${stats.con}/${stats.total}`);
ok('대표 PC 화면 팝업 (안 읽음)', stats.ceo === stats.total, `${stats.ceo}/${stats.total}`);
ok('담당자 업무 자동 생성', stats.task === stats.taskNeed, `${stats.task}/${stats.taskNeed}`);
ok(`화면에 뜨기까지 — 중앙 ${pct(0.5)}ms · 95% ${pct(0.95)}ms · 최대 ${sorted.at(-1)}ms`, (sorted.at(-1) ?? 99999) < POPUP_MS);
if (stats.fails.length) console.log('실패 목록:\n' + stats.fails.slice(0, 30).join('\n'));
ok('페이지 오류 없음', [cli, con, ceo].every((p) => p.errs.filter((e) => !/Failed to load resource|favicon|ERR_CERT/.test(e)).length === 0), [cli, con, ceo].flatMap((p) => p.errs).filter((e) => !/Failed to load resource|ERR_CERT/.test(e)).slice(0, 3).join(' | '));
await b.close();
process.exit(summary() ? 1 : 0);

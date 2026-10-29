// 시험 로그 → results.json. 보고서의 숫자는 전부 여기서 나온다(손으로 적지 않는다).
//   node tools/appeal-test/report/collect.mjs <증빙 폴더>
import fs from 'node:fs';
const E = process.argv[2];
if (!E) { console.error('사용: node collect.mjs <증빙 폴더>'); process.exit(2); }
const L = (f) => fs.readFileSync(`${E}/logs/${f}`, 'utf-8');
const need = (cond, m) => { if (!cond) { console.error('로그에서 찾지 못함 —', m); process.exit(1); } };
const when = (s) => ({ start: (s.match(/시작 (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) KST/) || [])[1], end: (s.match(/# 끝 (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) KST/) || [])[1] });
const R = {};

const b0 = L('00_build_start.txt').trim().split('\n');
R.commit = b0[2]; R.commitShort = b0[2].slice(0, 7); R.testDayKST = b0[1].slice(0, 10); R.buildStartKST = b0[1].replace(' KST', '');

const u = L('01_unit_tests.log');
const um = u.match(/파일 (\d+)개 · 통과 (\d+) · 실패 (\d+)/); need(um, '단위 시험 합계');
R.unit = { files: +um[1], pass: +um[2], fail: +um[3], checks: (u.match(/^OK/gm) || []).length, failChecks: (u.match(/^FAIL/gm) || []).length, ...when(u), per: {} };
let cur = null;
for (const line of u.split('\n')) { const m = line.match(/^== ((?:tools|supabase)\/\S+)/); if (m) cur = m[1].split('/').pop(); else if (cur && /^OK/.test(line)) R.unit.per[cur] = (R.unit.per[cur] || 0) + 1; }

const r = L('02_rls_202.log'); const rm = r.match(/(\d+) \|\s+(\d+)\s*$/m); need(rm, '권한 시험 합계');
R.rls = { pass: +rm[1], fail: +rm[2], ...when(r) };
const items = L('02_rls_202_items.txt').trim().split('\n').map((x) => { const [n, res, label] = x.split(' | '); return { n: +n, res, label }; });
R.rls.items = items.length; R.rls.itemsPass = items.filter((x) => x.res === '통과').length;
R.rls.selfRun = items.filter((x) => x.n >= 157).length;
R.rls.pick = Object.fromEntries([3, 91, 98, 99, 100, 101, 132, 151, 154, 164, 183, 184].map((n) => [n, items.find((x) => x.n === n)?.label]));

const d = L('03_daily_228.log'); const dm = d.match(/== OK (\d+) \/ FAIL (\d+)/); need(dm, '업무 흐름 합계');
R.daily = { pass: +dm[1], fail: +dm[2], sec17: (d.match(/^17 .*: OK/gm) || []).length, ...when(d) };

const a = L('04_acceptance_16.log'); const am = a.match(/(\d+)\/(\d+) 통과 · 페이지 오류 (\d+)건/); need(am, '자동 검수 합계');
R.accept = { pass: +am[1], total: +am[2], pageErrors: +am[3], ...when(a) };

const s = L('05_server_tests.log');
const checks = [...s.matchAll(/^CHECK\|(\w+)\|(\d+)\|([^|]*)\|([^|]*)\|([^|]*)\|(PASS|FAIL)$/gm)].map((m) => ({ test: m[1], n: +m[2], label: m[3], expect: m[4], actual: m[5], pass: m[6] === 'PASS' }));
const tm = s.match(/^TOTAL\|(\d+)\|(\d+)$/m); need(tm, '서버 시험 합계');
const mm = s.match(/^MEASURE\|TEST01\|[^|]*\|(\d+)회\|최소 ([\d.]+)ms\|중앙값 ([\d.]+)ms\|최대 ([\d.]+)ms$/m); need(mm, '처리시간');
R.server = { pass: +tm[1], fail: +tm[2], checks, ...when(s),
  by: Object.fromEntries([...s.matchAll(/^SUMMARY\|(\w+)\|(\d+)\|(\d+)$/gm)].map((m) => [m[1], { pass: +m[2], fail: +m[3] }])),
  measure: { n: +mm[1], min: +mm[2], median: +mm[3], max: +mm[4] },
  setupSha: (s.match(/setup\.sql sha256 (\w+)/) || [])[1], pg: (s.match(/PostgreSQL ([\d.]+)/) || [])[1],
  log02: [...s.matchAll(/^LOG\|TEST02\|([^|]*)\|([^|]*)\|([^|]*)\|(.*)$/gm)].map((m) => ({ at: m[1], type: m[2], actor: m[3], msg: m[4] })),
  tables: +((s.match(/공개 스키마 표 (\d+)개/) || [])[1]), policies: +((s.match(/권한 정책 (\d+)개/) || [])[1]) };

const st = L('06_stage_map.log');
const at1 = (t) => (t.match(/(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) KST/) || [])[1];
R.stage = { at: at1(st), pass: (st.match(/^OK/gm) || []).length, fail: (st.match(/^FAIL/gm) || []).length, rows: [...st.matchAll(/^OK\s+(\S+)\s*\((\w+)\) → ([^·]+) ·/gm)].map((m) => ({ label: m[1].replace(/　/g, ''), key: m[2], step: m[3].trim() })) };

const p = L('07_production_readonly.log');
R.prod = { at: (p.match(/시각 (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/) || [])[1], login: (p.match(/\/login\nHTTP (\d+)/) || [])[1], learn: (p.match(/\/learn\nHTTP (\d+)/) || [])[1], serverText: /서버의 인증\(Supabase Auth\)/.test(p) };

const fj = JSON.parse(fs.readFileSync(`${E}/flow/flow.json`, 'utf-8'));
const f1 = L('08_flow_screens_1차_실패2.log');
R.flow = { pass: fj.summary.pass, fail: fj.summary.fail, checks: fj.checks, ruleRuns: fj.ruleRuns, ...when(L('08_flow_screens.log')),
  first: { pass: +(f1.match(/통과 (\d+) · 실패 (\d+)/) || [])[1], fail: +(f1.match(/통과 (\d+) · 실패 (\d+)/) || [])[2] } };

const g = L('09_regress_cases.log');
R.regress = { at: at1(g), pass: (g.match(/^OK/gm) || []).length, fail: (g.match(/^FAIL/gm) || []).length, lines: g.split('\n').filter((x) => /^OK|^FAIL/.test(x)).map((x) => x.replace(/^(OK|FAIL)\s+/, '')) };

// 증빙 폴더의 실제 파일 수(보고서 문구도 여기서 가져온다)
const cnt = (d, re = /./) => fs.readdirSync(`${E}/${d}`).filter((f) => re.test(f)).length;
R.files = { logs: cnt('logs'), flowScreens: cnt('flow/screens', /\.png$/), flow1Screens: cnt('flow_1차/screens', /\.png$/), accPc: cnt('acceptance/pc', /\.png$/), accMobile: cnt('acceptance/mobile', /\.png$/) };

// 전체 묶음
R.suites = [
  { name: '서버 규칙 시험(TEST 01~06 · 과거 결함)', pass: R.server.pass, total: R.server.pass + R.server.fail },
  { name: '서버 권한(RLS) 시험', pass: R.rls.pass, total: R.rls.pass + R.rls.fail },
  { name: '업무 흐름 시험(화면)', pass: R.daily.pass, total: R.daily.pass + R.daily.fail },
  { name: '완료·검수 기준 자동 검수(PC · 휴대폰)', pass: R.accept.pass, total: R.accept.total },
  { name: '화면 흐름 증빙 시험', pass: R.flow.pass, total: R.flow.pass + R.flow.fail },
  { name: '단위 시험(규칙 · 변환)', pass: R.unit.checks + R.stage.pass + R.regress.pass, total: R.unit.checks + R.unit.failChecks + R.stage.pass + R.stage.fail + R.regress.pass + R.regress.fail },
];
R.allPass = R.suites.reduce((t, x) => t + x.pass, 0); R.allTotal = R.suites.reduce((t, x) => t + x.total, 0);
fs.writeFileSync(`${E}/results.json`, JSON.stringify(R, null, 1));
console.log(`results.json — 전체 ${R.allPass} / ${R.allTotal} · 서버 ${R.server.pass}/${R.server.pass + R.server.fail} · 권한 ${R.rls.pass} · 흐름 ${R.daily.pass} · 검수 ${R.accept.pass}/${R.accept.total} · 화면 ${R.flow.pass} · 단위 ${R.unit.checks}+${R.stage.pass}+${R.regress.pass} · 처리시간 중앙값 ${R.server.measure.median}ms`);

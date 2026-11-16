/**
 * 과적합 점검 — 개발 때의 가정을 깨뜨린 스트레스 세트와, 업종 사전을 줄인 엔진으로 다시 잰다.
 * 놓친 연결은 원인별로 나눈다(이름 유사도 · 규격 충돌 · 단위 · 단가 · 경쟁 항목 · 확인 대기).
 * 실행: npx tsx lossguard/eval/stress.ts [--n 30] [--out lossguard/eval/results]
 * 주의: 합성 자료의 측정값이다. 실제 현장 자료의 성능을 뜻하지 않는다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import type { AnalyzeResult, DocInput, LeafRole, GroupKey, Line } from "../engine/types";
import { readXlsx } from "../engine/io/xlsx";
import { analyze, detailItems } from "../engine/analyze";
import { ENGINE_VERSION } from "../engine/version";
import { makeNormalizer } from "../engine/normalize/name";
import { pairScore } from "../engine/match/match";
import pack from "../packs/construction-interior/index";
import { STRESS_SETS, generateStressCase } from "../synth/stress";
import { generateCase, type GtLink } from "../synth/index";
import { baselineMatch } from "./baselines";
import { minimalPack } from "./minimal-pack";

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const N = Number(opt("n", "30"));
const OUT = opt("out", "lossguard/eval/results");
const pc = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

async function load(docs: { docId: string; kind: DocInput["kind"]; round?: number; bytes: Uint8Array; fileName: string }[]): Promise<DocInput[]> {
  const out: DocInput[] = [];
  for (const d of docs) out.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
  return out;
}
const key = (docId: string, sheet: string, row: number) => `${docId}|${sheet}|${row}`;

const CAUSES = ["확인 대기", "다른 기준 항목에 잘못 연결", "기준 항목을 다른 줄이 가져감", "이름 유사도 낮음", "규격 충돌(점수 상한)", "단위 불일치(점수 상한)", "단가 차이", "합산 점수 부족(구간 등)", "점수는 넘었으나 후보에서 빠짐"] as const;

function causeOf(res: AnalyzeResult, g: GtLink, A: Map<string, Line>, B: Map<string, Line>, norm: ReturnType<typeof makeNormalizer>): string {
  const aKey = key(g.a.docId, g.a.sheet, g.a.row), bKey = key(g.b.docId, g.b.sheet, g.b.row);
  const lb = res.links.find((l) => key(l.b.docId, l.b.sheet, l.b.row) === bKey);
  const la = res.links.find((l) => key(l.a.docId, l.a.sheet, l.a.row) === aKey);
  if (lb && key(lb.a.docId, lb.a.sheet, lb.a.row) === aKey && lb.state === "review") return "확인 대기";
  if (lb) return "다른 기준 항목에 잘못 연결";
  if (la) return "기준 항목을 다른 줄이 가져감";
  const a = A.get(aKey), b = B.get(bKey);
  if (!a || !b) return "합산 점수 부족(구간 등)";
  const secA = a.path.length ? norm.section(a.path[a.path.length - 1]) : "", secB = b.path.length ? norm.section(b.path[b.path.length - 1]) : "";
  const s = pairScore(a.norm, b.norm, a.unitPrice, b.unitPrice, secA && secB ? (secA === secB ? 1 : 0) : 0.5, pack, {});
  if (s.score >= pack.params.tReview) return "점수는 넘었으나 후보에서 빠짐";
  if (s.parts.spec === 0) return "규격 충돌(점수 상한)";
  if (s.parts.unit === 0) return "단위 불일치(점수 상한)";
  if (s.parts.name < 0.5) return "이름 유사도 낮음";
  if (s.parts.price < 0.5) return "단가 차이";
  return "합산 점수 부족(구간 등)";
}

type Primary = Partial<Record<string, number>>;
function primaryOf(cols: { col: number; role: LeafRole; group?: GroupKey }[]): Primary {
  const f = (role: LeafRole, groups: (GroupKey | undefined)[]) => { for (const g of groups) { const c = cols.find((x) => x.role === role && x.group === g); if (c) return c.col; } return undefined; };
  return { name: f("name", [undefined]), spec: f("spec", [undefined]), unit: f("unit", [undefined]), qty: f("qty", [undefined, "after"]), unitPrice: f("unitPrice", [undefined, "sum", "after"]), amount: f("amount", [undefined, "sum", "after"]) };
}

async function main() {
  const t0 = Date.now();
  const norm = makeNormalizer(pack);
  const plain = makeNormalizer(pack, { synonyms: false });
  let commit = "unknown";
  try { commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* 없음 */ }
  const startedAt = new Date().toISOString();
  const md: string[] = [
    `# LossGuard 과적합 점검 (스트레스 세트 · 합성 자료)`, ``,
    `> **합성(가상) 자료의 측정값이다. 실제 현장 자료의 성능이 아니다.** 개발 때의 가정을 하나씩 깨뜨려 "어디서 떨어지는지"를 보려는 시험이다.`, ``,
    `| 실행 정보 | |`, `|---|---|`, `| 실행 시각(UTC) | ${startedAt} |`, `| 엔진 · 업종 묶음 | ${ENGINE_VERSION} · ${pack.key}@${pack.version} |`, `| 커밋 | ${commit} |`, `| 세트마다 현장 | ${N}건 (씨앗 2001~${2000 + N}) |`, ``,
    `## 1. 문서 간 항목 정합 — 조건별`, ``,
    `| 조건 | 정답 쌍 | 자동 연결 정밀도 | 자동 연결 재현율 | 확인 대기 포함 재현율 | 확인 대기 | 기준선: 이름 완전 일치 재현율 | 기준선: 기호 제거 재현율 |`,
    `|---|---|---|---|---|---|---|---|`,
  ];
  const json: Record<string, unknown> = { startedAt, commit, engine: ENGINE_VERSION, n: N, sets: {} };
  const causeRows: string[] = [];
  const tfRows: string[] = [];
  for (const set of STRESS_SETS) {
    let gt = 0, auto = 0, autoTP = 0, review = 0, reviewTP = 0, b1 = 0, b3 = 0;
    const causes = new Map<string, number>();
    const byTf = new Map<string, [number, number]>();
    for (let i = 1; i <= N; i++) {
      const c = generateStressCase(2000 + i, set.opts);
      const docs = await load(c.docs);
      const res = analyze({ docs, meta: c.meta, pack });
      const contract = res.docs.find((d) => d.kind === "contract")!, other = res.docs.find((d) => d.kind !== "contract")!;
      const A = new Map(detailItems(contract).map((l) => [key(l.docId, l.sheet, l.row), l]));
      const B = new Map(detailItems(other).map((l) => [key(l.docId, l.sheet, l.row), l]));
      const truth = new Map(c.links.map((g) => [key(g.b.docId, g.b.sheet, g.b.row), key(g.a.docId, g.a.sheet, g.a.row)]));
      gt += c.links.length;
      const autoHit = new Set<string>();
      for (const l of res.links) {
        const ok = truth.get(key(l.b.docId, l.b.sheet, l.b.row)) === key(l.a.docId, l.a.sheet, l.a.row);
        if (l.state === "review") { review++; if (ok) reviewTP++; } else { auto++; if (ok) { autoTP++; autoHit.add(key(l.b.docId, l.b.sheet, l.b.row)); } }
      }
      for (const g of c.links) {
        const hit = autoHit.has(key(g.b.docId, g.b.sheet, g.b.row));
        for (const t of g.transforms.length ? [...new Set(g.transforms)] : ["none"]) { const x = byTf.get(t) ?? [0, 0]; x[0]++; if (hit) x[1]++; byTf.set(t, x); }
        if (hit) continue;
        const cz = causeOf(res, g, A, B, norm);
        causes.set(cz, (causes.get(cz) ?? 0) + 1);
      }
      for (const [m, setter] of [["exactName", (n: number) => { b1 += n; }], ["normalized", (n: number) => { b3 += n; }]] as const) {
        const pairs = baselineMatch([...A.values()], [...B.values()], m, plain);
        setter(pairs.filter((p) => truth.get(key(p.b.docId, p.b.sheet, p.b.row)) === key(p.a.docId, p.a.sheet, p.a.row)).length);
      }
    }
    md.push(`| ${set.label} | ${gt} | ${pc(autoTP, auto)} (${autoTP}/${auto}) | **${pc(autoTP, gt)}** | ${pc(autoTP + reviewTP, gt)} | ${review} | ${pc(b1, gt)} | ${pc(b3, gt)} |`);
    const missed = gt - autoTP;
    causeRows.push(`| ${set.label} | ${missed} | ${CAUSES.map((cz) => causes.get(cz) ?? 0).join(" | ")} |`);
    tfRows.push(`| ${set.label} | ${[...byTf.entries()].sort().map(([t, [n, h]]) => `${t} ${pc(h, n)}(${n})`).join(" · ")} |`);
    (json.sets as Record<string, unknown>)[set.key] = { label: set.label, gt, auto, autoTP, review, reviewTP, baselineExactName: b1, baselineNormalized: b3, causes: Object.fromEntries(causes), byTransform: Object.fromEntries(byTf) };
  }
  md.push(``, `## 2. 놓친 연결의 원인 (자동 연결이 되지 않은 정답 쌍)`, ``, `| 조건 | 놓친 쌍 | ${CAUSES.join(" | ")} |`, `|---|---|${CAUSES.map(() => "---").join("|")}|`, ...causeRows);
  md.push(``, `원인 분류: 엔진이 그 쌍을 확인 대기로 둠 / 비교 문서의 줄을 다른 기준 항목과 자동 연결(틀린 연결) / 기준 항목이 다른 줄과 연결됨 / 둘 다 연결 없음 — 정답 쌍의 점수를 다시 계산해 가장 약한 요소로 분류.`);
  md.push(``, `## 3. 바꿔 적은 방식별 자동 연결 재현율`, ``, `| 조건 | 방식별 재현율(쌍 수) |`, `|---|---|`, ...tfRows);

  // 업종 사전을 줄였을 때(구조 인식 · 탐지)
  const mini = minimalPack(pack);
  const stat = { full: { t1: [0, 0], t3: [0, 0], tp: 0, fp: 0, err: 0, found: 0 }, mini: { t1: [0, 0], t3: [0, 0], tp: 0, fp: 0, err: 0, found: 0 } };
  for (let seed = 1; seed <= N; seed++) {
    const c = generateCase(seed, { split: "dev" });
    const docs = await load(c.docs);
    for (const [name, pk] of [["full", pack], ["mini", mini]] as const) {
      const res = analyze({ docs, meta: c.meta, pack: pk });
      const s = stat[name];
      for (const pd of res.docs) for (const sh of pd.sheets) {
        const gt = c.docs.find((d) => d.docId === pd.docId)!.gt.find((g) => g.name === sh.sheet);
        if (!gt || (gt.kind !== "detail" && gt.kind !== "summary")) continue;
        const gp = primaryOf(gt.columns), ep = primaryOf(sh.columns);
        for (const k of Object.keys(gp)) if (gp[k] !== undefined) { s.t1[1]++; if (ep[k] === gp[k]) s.t1[0]++; }
        for (const r of gt.rows) if (r.kind === "item") { s.t3[1]++; const l = sh.lines.find((x) => x.row === r.row); if (l && l.kind === "item" && l.qty === r.qty && l.amount === r.amount) s.t3[0]++; }
      }
      const found = new Set<string>();
      for (const f of res.findings) {
        const hit = c.errors.find((e) => e.detector === f.detector && e.check === f.check && f.evidence.some((x) => x.docId === e.docId && x.sheet === e.anchor.sheet && x.row === e.anchor.row));
        if (hit) { s.tp++; found.add(hit.id); continue; }
        if (c.errors.some((e) => e.consequences.some((q) => q.detector === f.detector && q.check === f.check && f.evidence[0]?.docId === (q.docId ?? e.docId)))) continue;
        s.fp++;
      }
      s.err += c.errors.length; s.found += found.size;
    }
  }
  md.push(``, `## 4. 업종 사전을 최소로 줄였을 때 (개발용 합성 현장 ${N}건)`, ``,
    `최소 사전: 머리글 별칭을 품명 · 규격 · 단위 · 수량 · 단가 · 금액 · 번호 · 비고 한 낱말씩, 합계 낱말 3개, 같은 뜻 낱말 · 간접비 낱말 · 꼬리표 없음.`, ``,
    `| 사전 | 핵심 열 정확도 | 항목 값 일치 | 주입 오류 찾음 | 틀린 경고 |`, `|---|---|---|---|---|`,
    `| 전체 사전 | ${pc(stat.full.t1[0], stat.full.t1[1])} | ${pc(stat.full.t3[0], stat.full.t3[1])} | ${stat.full.found}/${stat.full.err} | ${stat.full.fp} |`,
    `| 최소 사전 | ${pc(stat.mini.t1[0], stat.mini.t1[1])} | ${pc(stat.mini.t3[0], stat.mini.t3[1])} | ${stat.mini.found}/${stat.mini.err} | ${stat.mini.fp} |`);
  json.packAblation = stat;
  md.push(``, `걸린 시간 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  mkdirSync(OUT, { recursive: true });
  const base = `${OUT}/${startedAt.slice(0, 10)}-${commit}-stress`;
  writeFileSync(`${base}.md`, md.join("\n") + "\n");
  writeFileSync(`${base}.json`, JSON.stringify(json, null, 2));
  console.log(md.join("\n"));
  console.log(`\n저장: ${base}.md · .json`);
}
main().catch((e) => { console.error(e); process.exit(1); });

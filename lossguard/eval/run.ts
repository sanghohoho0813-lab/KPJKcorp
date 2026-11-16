/**
 * LossGuard 평가 도구 — 합성 현장으로 엔진을 재고, 단순 방식(기준선)과 비교하고, 기술 요소를 하나씩 빼 보고(빼고 돌리기),
 * 재현성 · 근거 정확도 · 처리 시간을 잰다. 결과는 실행 시각 · 엔진 판 · 커밋과 함께 파일로 남긴다.
 * 실행: npx tsx lossguard/eval/run.ts [--dev 40] [--eval 40] [--out lossguard/eval/results] [--quick]
 * 주의: 합성 자료의 측정값이다. 실제 현장 자료에서의 성능을 뜻하지 않는다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { AnalyzeResult, ColumnAssign, DocInput, GroupKey, LeafRole, Line, RawWorkbook } from "../engine/types";
import { readXlsx } from "../engine/io/xlsx";
import { analyze, detailItems } from "../engine/analyze";
import { ENGINE_VERSION } from "../engine/version";
import { hash16 } from "../engine/hash";
import { makeNormalizer } from "../engine/normalize/name";
import { aliasIndex } from "../engine/read/header";
import { parseSheet } from "../engine/read/parse";
import { matchLines } from "../engine/match/match";
import pack from "../packs/construction-interior/index";
import { generateCase, generateLargeCase, type GtError, type SynthCase } from "../synth/index";
import type { GtColumn, GtSheet } from "../synth/render";
import { baselineMatch, baselineParse, type MatchMethod } from "./baselines";

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const QUICK = args.includes("--quick");
const N_DEV = Number(opt("dev", QUICK ? "10" : "40"));
const N_EVAL = Number(opt("eval", QUICK ? "10" : "40"));
const OUT = opt("out", "lossguard/eval/results");

interface Ratio { n: number; ok: number }
const R = (): Ratio => ({ n: 0, ok: 0 });
const add = (r: Ratio, ok: boolean) => { r.n++; if (ok) r.ok++; };
const pct = (r: Ratio) => (r.n ? `${((100 * r.ok) / r.n).toFixed(1)}% (${r.ok}/${r.n})` : "-");
const val = (r: Ratio) => (r.n ? r.ok / r.n : null);

type Primary = Partial<Record<"name" | "spec" | "unit" | "qty" | "unitPrice" | "amount", number>>;
function primaryOf(cols: { col: number; role: LeafRole; group?: GroupKey }[]): Primary {
  const f = (role: LeafRole, groups: (GroupKey | undefined)[]) => { for (const g of groups) { const c = cols.find((x) => x.role === role && x.group === g); if (c) return c.col; } return undefined; };
  return { name: f("name", [undefined]), spec: f("spec", [undefined]), unit: f("unit", [undefined]), qty: f("qty", [undefined, "after"]), unitPrice: f("unitPrice", [undefined, "sum", "after"]), amount: f("amount", [undefined, "sum", "after"]) };
}

async function load(c: SynthCase): Promise<DocInput[]> {
  const out: DocInput[] = [];
  for (const d of c.docs) out.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
  return out;
}

const STRUCT_KINDS = new Set(["item", "section", "subtotal", "total", "adjust", "tax", "note"]);
const normKind = (k?: string) => (k === "total" ? "subtotal" : k);

interface TplStat { sheets: number; t1e: Ratio; t1b: Ratio; t1full: Ratio; t2e: Ratio; t2eBin: Ratio; t2bBin: Ratio; t3: Ratio; naive: number[]; confOk: number[]; confBad: number[] }
const tplStat = (): TplStat => ({ sheets: 0, t1e: R(), t1b: R(), t1full: R(), t2e: R(), t2eBin: R(), t2bBin: R(), t3: R(), naive: [], confOk: [], confBad: [] });

interface MatchStat { auto: number; autoTP: number; review: number; reviewTP: number; gt: number; byTf: Map<string, Ratio> }
const matchStat = (): MatchStat => ({ auto: 0, autoTP: 0, review: 0, reviewTP: 0, gt: 0, byTf: new Map() });

function structure(stats: Map<string, TplStat>, overall: TplStat, gt: GtSheet, sh: AnalyzeResult["docs"][number]["sheets"][number], raw: RawWorkbook) {
  if (gt.kind !== "detail" && gt.kind !== "summary") return;
  const s = stats.get(gt.template) ?? tplStat();
  stats.set(gt.template, s);
  for (const t of [s, overall]) t.sheets++;
  const gp = primaryOf(gt.columns);
  const ep = primaryOf(sh.columns);
  const rawSheet = raw.sheets.find((x) => x.name === gt.name)!;
  const bl = baselineParse(rawSheet, pack);
  const bp: Primary = {};
  for (const c of bl?.columns ?? []) if (c.role in gp) (bp as Record<string, number>)[c.role] = c.col;
  let allOk = true;
  for (const k of Object.keys(gp) as (keyof Primary)[]) {
    if (gp[k] === undefined) continue;
    const okE = ep[k] === gp[k];
    if (!okE) allOk = false;
    for (const t of [s, overall]) { add(t.t1e, okE); add(t.t1b, bp[k] === gp[k]); }
  }
  for (const gc of gt.columns as GtColumn[]) {
    if (gc.role === "no" || gc.role === "note") continue;
    const ok = sh.columns.some((ec: ColumnAssign) => ec.col === gc.col && ec.role === gc.role && ec.group === gc.group);
    for (const t of [s, overall]) add(t.t1full, ok);
  }
  const blRows = new Map((bl?.rows ?? []).map((x) => [x.row, x]));
  let gtSum = 0, blSum = 0;
  for (const gr of gt.rows) {
    if (!STRUCT_KINDS.has(gr.kind)) continue;
    const l = sh.lines.find((x) => x.row === gr.row);
    const okStrict = normKind(l?.kind) === normKind(gr.kind);
    const gtItem = gr.kind === "item";
    for (const t of [s, overall]) { add(t.t2e, okStrict); add(t.t2eBin, (l?.kind === "item") === gtItem); add(t.t2bBin, !!blRows.get(gr.row)?.item === gtItem); }
    if (gtItem) {
      gtSum += gr.amount ?? 0;
      const ok = !!l && l.kind === "item" && l.name === (gr.name ?? "").trim() && l.spec === (gr.spec ?? "") && l.unit === (gr.unit ?? "")
        && l.qty === gr.qty && l.unitPrice === gr.unitPrice && Math.abs((l.amount ?? NaN) - (gr.amount ?? NaN)) < 0.5;
      for (const t of [s, overall]) add(t.t3, ok);
    }
  }
  if (gt.kind === "detail") {
    for (const x of bl?.rows ?? []) if (x.item) blSum += x.amount ?? 0;
    const e = gtSum ? blSum / gtSum - 1 : 0;
    for (const t of [s, overall]) t.naive.push(e);
  }
  for (const t of [s, overall]) (allOk ? t.confOk : t.confBad).push(sh.confidence);
}

function refKey(docId: string, sheet: string, row: number) { return `${docId}|${sheet}|${row}`; }

function evalLinks(st: MatchStat, c: SynthCase, docId: string, pairs: { a: Line; b: Line; state: "auto" | "review" }[]) {
  const gt = c.links.filter((g) => g.b.docId === docId);
  const gtMap = new Map(gt.map((g) => [refKey(g.b.docId, g.b.sheet, g.b.row), refKey(g.a.docId, g.a.sheet, g.a.row)]));
  st.gt += gt.length;
  const autoHit = new Set<string>();
  for (const p of pairs) {
    const truth = gtMap.get(refKey(p.b.docId, p.b.sheet, p.b.row));
    const ok = truth === refKey(p.a.docId, p.a.sheet, p.a.row);
    if (p.state === "auto") { st.auto++; if (ok) { st.autoTP++; autoHit.add(refKey(p.b.docId, p.b.sheet, p.b.row)); } }
    else { st.review++; if (ok) st.reviewTP++; }
  }
  for (const g of gt) {
    const tfs = g.transforms.length ? [...new Set(g.transforms.map((t) => t))] : ["none"];
    for (const t of tfs) { const r = st.byTf.get(t) ?? R(); st.byTf.set(t, r); add(r, autoHit.has(refKey(g.b.docId, g.b.sheet, g.b.row))); }
  }
}

interface DetStat { byType: Map<string, Ratio>; tp: number; cons: number; fp: number; byDetector: Map<string, { tp: number; cons: number; fp: number }>; fpSamples: string[]; cleanDocs: number; cleanFindings: number; evidence: Ratio }

function evalFindings(d: DetStat, c: SynthCase, res: AnalyzeResult, raws: Map<string, RawWorkbook>) {
  const matched = new Set<string>();
  const inEvidence = (f: AnalyzeResult["findings"][number], e: GtError) => f.evidence.some((x) => x.docId === e.docId && x.sheet === e.anchor.sheet && x.row === e.anchor.row);
  for (const f of res.findings) {
    const det = d.byDetector.get(f.detector) ?? { tp: 0, cons: 0, fp: 0 };
    d.byDetector.set(f.detector, det);
    const hit = c.errors.find((e) => e.detector === f.detector && e.check === f.check && inEvidence(f, e));
    if (hit) { d.tp++; det.tp++; matched.add(hit.id); }
    else if (c.errors.some((e) => e.consequences.some((q) => q.detector === f.detector && q.check === f.check && (f.evidence[0]?.docId === (q.docId ?? e.docId))))) { d.cons++; det.cons++; }
    else { d.fp++; det.fp++; if (d.fpSamples.length < 15) d.fpSamples.push(`씨앗 ${c.seed} · ${f.detector}/${f.check} · ${f.message.slice(0, 140)}`); }
    for (const ev of f.evidence) for (const [k, col] of Object.entries(ev.cols)) {
      const sheet = raws.get(ev.docId)?.sheets.find((s) => s.name === ev.sheet);
      add(d.evidence, (sheet?.rows[ev.row]?.[col]?.v ?? "") === ev.values[k]);
    }
  }
  for (const e of c.errors) { const r = d.byType.get(e.type) ?? R(); d.byType.set(e.type, r); add(r, matched.has(e.id)); }
  if (!c.errors.length) { d.cleanDocs += c.docs.length; d.cleanFindings += res.findings.length; }
}

function stableResult(res: AnalyzeResult): string {
  return hash16(JSON.stringify({ f: res.findings, l: res.links, g: res.lineage, d: res.docs.map((d) => d.sheets.map((s) => [s.sheet, s.kind, s.columns, s.lines.map((l) => [l.row, l.kind, l.fp, l.amount])])) }));
}

function shiftWorkbook(wb: RawWorkbook, n: number): RawWorkbook {
  return {
    fileName: wb.fileName,
    sheets: wb.sheets.map((s) => ({
      ...s,
      rows: [...Array.from({ length: n }, (_, i) => (i === 1 ? [{ v: "※ 이 줄은 위치 이동 시험용으로 넣은 줄", t: "text" as const }] : [])), ...s.rows],
      merges: s.merges.map((m) => ({ r1: m.r1 + n, c1: m.c1, r2: m.r2 + n, c2: m.c2 })),
      hiddenRows: s.hiddenRows.map((r) => r + n),
    })),
  };
}

async function main() {
  const t0 = performance.now();
  const norm = makeNormalizer(pack);
  const plain = makeNormalizer(pack, { synonyms: false });
  const idx = aliasIndex(pack);
  const report: Record<string, unknown> = {};
  const md: string[] = [];
  let commit = "unknown", dirty = false;
  try { commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); dirty = execSync("git status --porcelain -- lossguard", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().length > 0; } catch { /* git 없음 */ }
  const startedAt = new Date().toISOString();

  const splits: ["dev" | "eval", number[]][] = [["dev", Array.from({ length: N_DEV }, (_, i) => i + 1)], ["eval", Array.from({ length: N_EVAL }, (_, i) => 1001 + i)]];
  const methods: MatchMethod[] = ["exactName", "exactNameSpecUnit", "normalized"];
  const variants: [string, Parameters<typeof matchLines>[4]][] = [["엔진(전체)", {}], ["엔진 − 같은 뜻 사전", { synonyms: false }], ["엔진 − 순서 정렬", { align: false }], ["엔진 − 규격 · 단가 특징", { specPrice: false }]];
  const perSplit: Record<string, unknown> = {};
  for (const [split, seeds] of splits) {
    const tpl = new Map<string, TplStat>();
    const overall = tplStat();
    const mEngine = new Map<string, MatchStat>(variants.map(([k]) => [k, matchStat()]));
    const mBase = new Map<string, MatchStat>(methods.map((k) => [k, matchStat()]));
    const det: DetStat = { byType: new Map(), tp: 0, cons: 0, fp: 0, byDetector: new Map(), fpSamples: [], cleanDocs: 0, cleanFindings: 0, evidence: R() };
    const tplCount = new Map<string, number>();
    let cases = 0, docsN = 0, linesN = 0;
    for (const seed of seeds) {
      const c = generateCase(seed, { split });
      const docs = await load(c);
      const raws = new Map(docs.map((d) => [d.docId, d.workbook]));
      const res = analyze({ docs, meta: c.meta, pack });
      cases++; docsN += docs.length;
      for (const d of c.docs) tplCount.set(d.template, (tplCount.get(d.template) ?? 0) + 1);
      for (const pd of res.docs) {
        const sd = c.docs.find((x) => x.docId === pd.docId)!;
        for (const sh of pd.sheets) {
          linesN += sh.lines.length;
          const gt = sd.gt.find((g) => g.name === sh.sheet);
          if (gt) structure(tpl, overall, gt, sh, raws.get(pd.docId)!);
        }
      }
      // 항목 정합
      const contract = res.docs.find((d) => d.kind === "contract")!;
      const baseItems = detailItems(contract);
      for (const pd of res.docs) {
        if (pd === contract) continue;
        const items = detailItems(pd);
        const at = (docId: string, sheet: string, row: number) => [...baseItems, ...items].find((l) => l.docId === docId && l.sheet === sheet && l.row === row)!;
        for (const [name, o] of variants) {
          const links = name === "엔진(전체)" ? res.links.filter((l) => l.b.docId === pd.docId) : matchLines(baseItems, items, pack, norm, o);
          evalLinks(mEngine.get(name)!, c, pd.docId, links.map((l) => ({ a: at(l.a.docId, l.a.sheet, l.a.row), b: at(l.b.docId, l.b.sheet, l.b.row), state: l.state === "review" ? "review" : "auto" })));
        }
        for (const m of methods) evalLinks(mBase.get(m)!, c, pd.docId, baselineMatch(baseItems, items, m, plain).map((p) => ({ ...p, state: "auto" as const })));
      }
      evalFindings(det, c, res, raws);
    }
    const tplRows = [...tpl.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
    const absMean = (xs: number[]) => mean(xs.map(Math.abs));
    perSplit[split] = {
      cases, docs: docsN, lines: linesN, templates: Object.fromEntries(tplCount),
      structure: { overall: { t1Engine: val(overall.t1e), t1Baseline: val(overall.t1b), t1Full: val(overall.t1full), t2Engine: val(overall.t2e), t2EngineBinary: val(overall.t2eBin), t2BaselineBinary: val(overall.t2bBin), t3Engine: val(overall.t3), naiveSumAbsError: absMean(overall.naive) },
        byTemplate: Object.fromEntries(tplRows.map(([k, s]) => [k, { sheets: s.sheets, t1Engine: val(s.t1e), t1Baseline: val(s.t1b), t2Engine: val(s.t2e), t2BaselineBinary: val(s.t2bBin), t3: val(s.t3), naiveSumAbsError: absMean(s.naive), confidenceCorrectMin: s.confOk.length ? Math.min(...s.confOk) : null, confidenceWrong: s.confBad }])) },
      matching: Object.fromEntries([...mEngine.entries(), ...mBase.entries()].map(([k, m]) => [k, { gt: m.gt, auto: m.auto, autoTP: m.autoTP, precision: m.auto ? m.autoTP / m.auto : null, recall: m.gt ? m.autoTP / m.gt : null, recallWithReview: m.gt ? (m.autoTP + m.reviewTP) / m.gt : null, review: m.review, reviewTP: m.reviewTP, byTransform: Object.fromEntries([...m.byTf.entries()].map(([t, r]) => [t, { n: r.n, recall: val(r) }])) }])),
      detection: { byType: Object.fromEntries([...det.byType.entries()].map(([k, r]) => [k, { n: r.n, detected: r.ok }])), tp: det.tp, consequences: det.cons, fp: det.fp, byDetector: Object.fromEntries(det.byDetector), fpSamples: det.fpSamples, cleanDocs: det.cleanDocs, cleanDocFindings: det.cleanFindings, evidenceCells: { n: det.evidence.n, ok: det.evidence.ok } },
    };
    // ── 마크다운
    md.push(`\n## ${split === "dev" ? "개발용" : "평가용"} 합성 현장 (${split}) — ${cases}건 · 문서 ${docsN}개 · 읽은 줄 ${linesN}개`);
    md.push(`양식별 문서 수: ${[...tplCount.entries()].sort().map(([k, v]) => `${k} ${v}`).join(" · ")}${split === "eval" ? "  (V7 · V8 은 개발 중에 쓰지 않은 양식)" : ""}`);
    md.push(`\n### 표 구조 인식 (시트 ${overall.sheets}개)\n`);
    md.push("| 양식 | 시트 | 핵심 열 정확도 — 엔진 | 핵심 열 정확도 — 기준선 | 줄 종류 정확도 — 엔진 | 항목/비항목 구분 — 기준선 | 항목 값 일치 — 엔진 | 금액 열 단순 합계의 오차 — 기준선 |");
    md.push("|---|---|---|---|---|---|---|---|");
    for (const [k, s] of tplRows) md.push(`| ${k} | ${s.sheets} | ${pct(s.t1e)} | ${pct(s.t1b)} | ${pct(s.t2e)} | ${pct(s.t2bBin)} | ${pct(s.t3)} | ${s.naive.length ? (100 * absMean(s.naive)).toFixed(1) + "%" : "-"} |`);
    md.push(`| **전체** | ${overall.sheets} | **${pct(overall.t1e)}** | ${pct(overall.t1b)} | **${pct(overall.t2e)}** | ${pct(overall.t2bBin)} | **${pct(overall.t3)}** | ${(100 * absMean(overall.naive)).toFixed(1)}% |`);
    md.push(`\n- 엔진 항목/비항목 구분: ${pct(overall.t2eBin)} · 묶음(재료비 · 변경 전 등)까지 포함한 전체 열 역할: ${pct(overall.t1full)}`);
    md.push(`- 핵심 열을 하나라도 틀린 시트의 읽기 신뢰도: ${overall.confBad.length ? overall.confBad.map((x) => x.toFixed(2)).join(", ") : "없음"} / 모두 맞힌 시트의 최저 신뢰도: ${overall.confOk.length ? Math.min(...overall.confOk).toFixed(3) : "-"}`);
    md.push(`\n### 문서 간 항목 정합 (정답 쌍 ${mEngine.get("엔진(전체)")!.gt}개)\n`);
    md.push("| 방법 | 자동 연결 정밀도 | 자동 연결 재현율 | 확인 대기 포함 재현율 | 확인 대기 건수 |");
    md.push("|---|---|---|---|---|");
    const mrow = (k: string, m: MatchStat) => `| ${k} | ${m.auto ? ((100 * m.autoTP) / m.auto).toFixed(1) + "%" : "-"} (${m.autoTP}/${m.auto}) | ${((100 * m.autoTP) / Math.max(1, m.gt)).toFixed(1)}% | ${(100 * (m.autoTP + m.reviewTP) / Math.max(1, m.gt)).toFixed(1)}% | ${m.review} |`;
    for (const [k, m] of mEngine) md.push(mrow(k, m));
    const bname: Record<string, string> = { exactName: "기준선: 이름 완전 일치(VLOOKUP 방식)", exactNameSpecUnit: "기준선: 이름 · 규격 · 단위 완전 일치", normalized: "기준선: 띄어쓰기 · 기호 제거 후 일치" };
    for (const [k, m] of mBase) md.push(mrow(bname[k], m));
    const tfs = [...new Set([...mEngine.get("엔진(전체)")!.byTf.keys()])].sort();
    md.push(`\n이름을 바꿔 적은 방식별 자동 연결 재현율(한 쌍에 여러 방식이 겹칠 수 있음)\n`);
    md.push(`| 바꿔 적은 방식 | 쌍 | 엔진 | 기준선: 이름 완전 일치 | 기준선: 띄어쓰기 · 기호 제거 |`);
    md.push("|---|---|---|---|---|");
    const tfLabel: Record<string, string> = { none: "바꾸지 않음", space: "띄어쓰기", specInName: "규격을 이름에 붙임", specNotation: "규격 표기(600x600 → 600*600 등)", unitForm: "단위 표기(㎡ → M2 등)", "synonym:dict": "같은 뜻 낱말(사전에 있음)", "synonym:nodict": "다른 이름(사전에 없음 · 글자 겹침 많음)", "synonym:hard": "다른 이름(사전에 없음 · 글자 겹침 적음)", order: "낱말 순서", tag: "꼬리표((변경) · [수정])" };
    for (const t of tfs) {
      const e = mEngine.get("엔진(전체)")!.byTf.get(t)!, b1 = mBase.get("exactName")!.byTf.get(t), b3 = mBase.get("normalized")!.byTf.get(t);
      md.push(`| ${tfLabel[t] ?? t} | ${e.n} | ${pct(e)} | ${b1 ? pct(b1) : "-"} | ${b3 ? pct(b3) : "-"} |`);
    }
    md.push(`\n### 불일치 탐지 (D01 · D02 · D03)\n`);
    md.push("| 주입한 오류 | 건수 | 찾음 | 재현율 |");
    md.push("|---|---|---|---|");
    const typeLabel: Record<string, string> = { E1: "계약 내역서 줄 금액 오기", E1b: "변경 내역서 줄 금액 오기", E1c: "정산서 줄 금액 오기", E2: "재료비 금액 오기", E3: "소계 오기", E4: "숨긴 행이 소계에 포함", E5: "집계표 구간 금액 오기", E6: "계약금액 ≠ 문서 합계", E7: "표지 금액 오기", E8: "증감 금액 오기", E9: "증감 수량 오기", E10: "변경 계약금액 ≠ 변경 문서 합계", E11: "변경 전 수량 ≠ 계약 수량" };
    for (const [k, r] of [...det.byType.entries()].sort()) md.push(`| ${k} ${typeLabel[k] ?? ""} | ${r.n} | ${r.ok} | ${pct(r)} |`);
    md.push(`\n- 결과 ${det.tp + det.cons + det.fp}건 = 주입 오류를 맞힘 ${det.tp} · 주입 오류 때문에 함께 생긴 결과 ${det.cons} · **틀린 경고 ${det.fp}**`);
    md.push(`- 오류를 하나도 넣지 않은 현장의 문서 ${det.cleanDocs}개에서 나온 결과: **${det.cleanFindings}건**`);
    md.push(`- 근거 칸 정확도(결과가 가리키는 칸의 글자 = 원본 파일의 글자): ${pct(det.evidence)}`);
    if (det.fpSamples.length) { md.push(`- 틀린 경고 예:`); for (const s of det.fpSamples) md.push(`  - ${s}`); }
  }
  report.splits = perSplit;

  // ── 재현성 · 행 밀림 · 자기 검증 · 처리 시간
  let r1Ok = 0, r1N = 0, r2Keys = 0, r2Kept = 0;
  for (let seed = 1; seed <= (QUICK ? 5 : 10); seed++) {
    const c = generateCase(seed, { split: "dev" });
    const docs = await load(c);
    const h = new Set<string>();
    for (let k = 0; k < 10; k++) h.add(stableResult(analyze({ docs: k % 2 ? [...docs].reverse() : docs, meta: c.meta, pack })));
    r1N++; if (h.size === 1) r1Ok++;
    const base = analyze({ docs, meta: c.meta, pack });
    const shifted = analyze({ docs: docs.map((d) => ({ ...d, workbook: shiftWorkbook(d.workbook, 3) })), meta: c.meta, pack });
    const keys = new Set(shifted.findings.map((f) => f.key));
    for (const f of base.findings) { r2Keys++; if (keys.has(f.key)) r2Kept++; }
  }
  const t4: Record<string, Ratio> = { "금액 ↔ 단가 열 바꿈": R(), "수량 · 단가 · 금액 열을 한 칸씩 돌림": R(), "수량 ↔ 단가 열 바꿈": R() };
  for (let seed = 1; seed <= (QUICK ? 10 : 30); seed++) {
    const c = generateCase(seed, { split: "dev" });
    for (const d of c.docs) {
      const wb = await readXlsx(d.bytes, d.fileName);
      for (const gt of d.gt) {
        if (gt.kind !== "detail") continue;
        const p = primaryOf(gt.columns);
        if (p.qty === undefined || p.unitPrice === undefined || p.amount === undefined || gt.columns.some((x) => x.group)) continue;
        const raw = wb.sheets.find((s) => s.name === gt.name)!;
        const base = gt.columns.filter((x) => !x.group).map((x) => ({ col: x.col, role: x.role }));
        const perturb = (m: Record<number, LeafRole>) => base.map((x) => ({ col: x.col, role: m[x.col] ?? x.role }));
        const cases: [string, Record<number, LeafRole>][] = [
          ["금액 ↔ 단가 열 바꿈", { [p.amount]: "unitPrice", [p.unitPrice]: "amount" }],
          ["수량 · 단가 · 금액 열을 한 칸씩 돌림", { [p.qty]: "unitPrice", [p.unitPrice]: "amount", [p.amount]: "qty" }],
          ["수량 ↔ 단가 열 바꿈", { [p.qty]: "unitPrice", [p.unitPrice]: "qty" }],
        ];
        for (const [name, m] of cases) {
          const ps = parseSheet(raw, wb.sheets.indexOf(raw), { docId: d.docId, fileName: d.fileName }, pack, idx, norm, { docId: d.docId, sheet: raw.name, columns: perturb(m) });
          add(t4[name], ps.confidence < pack.params.confidenceThreshold);
        }
      }
    }
  }
  const large = generateLargeCase(7, QUICK ? 1000 : 5000);
  const tr0 = performance.now();
  const ldocs = await load(large);
  const readMs = performance.now() - tr0;
  const times: number[] = [];
  let largeLines = 0, largeFindings = 0, largeLinks = 0;
  for (let k = 0; k < 3; k++) {
    const t = performance.now();
    const res = analyze({ docs: ldocs, meta: large.meta, pack });
    times.push(performance.now() - t);
    largeLines = res.docs.reduce((s, d) => s + d.sheets.reduce((a, sh) => a + sh.lines.length, 0), 0);
    largeFindings = res.findings.length; largeLinks = res.links.length;
  }
  times.sort((a, b) => a - b);
  const contractItems = large.docs[0].gt.flatMap((g) => g.rows.filter((r) => r.kind === "item")).length;
  report.reproducibility = { cases: r1N, identical: r1Ok, findingsKeysChecked: r2Keys, keysKeptAfterRowShift: r2Kept };
  report.selfCheck = Object.fromEntries(Object.entries(t4).map(([k, r]) => [k, { sheets: r.n, flagged: r.ok }]));
  report.performance = { documents: ldocs.length, contractItems, linesRead: largeLines, readMs: Math.round(readMs), analyzeMsMedian: Math.round(times[1]), analyzeMs: times.map((x) => Math.round(x)), findings: largeFindings, links: largeLinks, node: process.version };
  md.push(`\n## 공통 측정`);
  md.push(`\n| 항목 | 결과 |`);
  md.push("|---|---|");
  md.push(`| 재현성 — 같은 입력 10번(문서 순서 뒤집기 포함) | ${r1Ok}/${r1N} 건 모두 결과 지문 동일 |`);
  md.push(`| 행 밀림 — 모든 시트 맨 위에 3줄을 끼워 넣은 뒤 결과 열쇠 유지 | ${r2Kept}/${r2Keys} (${r2Keys ? ((100 * r2Kept) / r2Keys).toFixed(1) : "-"}%) |`);
  for (const [k, r] of Object.entries(t4)) md.push(`| 자기 검증 — 열을 일부러 틀리게 지정(${k}) → 신뢰도 ${pack.params.confidenceThreshold} 미만으로 떨어진 비율 | ${pct(r)} |`);
  md.push(`| 처리 시간 — 문서 ${ldocs.length}개 · 계약 항목 ${contractItems}줄 · 읽은 줄 ${largeLines}개 | 파일 읽기 ${Math.round(readMs)}ms · 분석 중앙값 ${Math.round(times[1])}ms (3회: ${times.map((x) => Math.round(x)).join(" / ")}ms) · Node ${process.version} · 이 컨테이너 |`);
  const totalMs = Math.round(performance.now() - t0);
  const header = [
    `# LossGuard 엔진 평가 보고서 (합성 자료)`,
    ``,
    `> **이 보고서의 모든 수치는 합성(가상) 현장 자료로 잰 것이다. 실제 현장 자료에서의 성능 · 실증 결과가 아니다.**`,
    `> 합성 자료와 엔진을 같은 개발 과정에서 만들었으므로, 실제 자료보다 좋게 나올 가능성이 크다. 평가용 씨앗(1001~)과 개발에 쓰지 않은 양식(V7 · V8)으로 일부 보완했을 뿐이다.`,
    `> 기준선은 우리가 만든 단순 방식의 재현이며 특정 제품이 아니다.`,
    ``,
    `| 실행 정보 | |`,
    `|---|---|`,
    `| 실행 시각(UTC) | ${startedAt} |`,
    `| 엔진 판 · 업종 묶음 | ${ENGINE_VERSION} · ${pack.key}@${pack.version} |`,
    `| 커밋 | ${commit}${dirty ? " (lossguard/ 에 커밋하지 않은 변경 있음)" : ""} |`,
    `| 합성 현장 | 개발용 씨앗 1~${N_DEV} · 평가용 씨앗 1001~${1000 + N_EVAL} |`,
    `| 걸린 시간 | ${(totalMs / 1000).toFixed(1)}초 |`,
    ``,
    `용어 — 핵심 열: 품명 · 규격 · 단위 · 수량 · 단가 · 금액(분할 양식은 합계 단가 · 금액, 비교 양식은 변경 후 값). 줄 종류: 항목 · 구간 제목 · 합계(소계와 합계는 한 종류로 셈) · 조정 · 세금 · 메모. 항목 값 일치: 품명 · 규격 · 단위 · 수량 · 단가 · 금액이 모두 원본과 같은 항목 줄의 비율.`,
  ];
  report.meta = { startedAt, engine: ENGINE_VERSION, pack: `${pack.key}@${pack.version}`, commit, dirty, nDev: N_DEV, nEval: N_EVAL, totalMs };
  mkdirSync(OUT, { recursive: true });
  const stamp = startedAt.slice(0, 10);
  const base = `${OUT}/${stamp}-${commit}${QUICK ? "-quick" : ""}`;
  writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  writeFileSync(`${base}.md`, [...header, ...md, ""].join("\n"));
  console.log([...header, ...md].join("\n"));
  console.log(`\n저장: ${base}.md · ${base}.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });

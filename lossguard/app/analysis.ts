import type { AnalyzeResult, CaseMeta, DocInput, Finding, IndustryPack, Line, LinkDecision, ParsedDoc, RawWorkbook } from "../engine/types";
import { analyze, detailItems } from "../engine/analyze";
import { makeNormalizer } from "../engine/normalize/name";
import { pairScore } from "../engine/match/match";
import type { AnalysisView, FindingCategory, FindingSnap, Judgment, LinkOrigin, NameRule, RunSnapshot, Site, StoredFile } from "./model";
import { activeFor, nameKey, siteDecisions } from "./judgments";

/**
 * 분석 한 번: 현장 정보 + 쓰는 파일 + 사람 판단 → 엔진 → 화면이 쓰는 결과.
 * 회사 규칙은 두 단계로 쓴다 — ① 현장 판단만으로 분석해 줄 지문을 얻고 ② 규칙에 맞는 줄 쌍(양쪽 모두 한 줄뿐일 때만)을
 * "같다" 판단으로 더해 다시 분석한다. 현장 판단이 있는 줄에는 규칙을 쓰지 않는다(현장 판단이 우선).
 */
export interface AnalysisInput { site: Site; files: { file: StoredFile; workbook: RawWorkbook }[]; judgments: Judgment[]; pack: IndustryPack }

export const pairId = (a: string, b: string) => `${a}|${b}`;

export function categoryOf(f: Finding): FindingCategory {
  return f.certainty === "calc" ? "calc" : "unconfirmed";
}

function snapOf(f: Finding): FindingSnap {
  const e = f.evidence[0];
  return {
    key: f.key, detector: f.detector, check: f.check, title: f.title, message: f.message, amount: f.amount,
    certainty: f.certainty, severity: f.severity, category: categoryOf(f),
    where: e ? `${e.fileName} › ${e.sheet} › ${e.row + 1}행` : "",
  };
}

export function metaOf(site: Site): CaseMeta {
  return { contractAmount: site.contractAmount, vat: site.vat, changes: site.changes.filter((c) => c.prevAmount !== undefined || c.newAmount !== undefined) };
}

function applyRules(pass1: AnalyzeResult, rules: Judgment[], taken: Set<string>, pack: IndustryPack): { links: LinkDecision[]; applied: AnalysisView["rules"]["applied"]; skipped: AnalysisView["rules"]["skipped"] } {
  const links: LinkDecision[] = [];
  const applied: AnalysisView["rules"]["applied"] = [];
  const skipped: AnalysisView["rules"]["skipped"] = [];
  const contract = pass1.docs.find((d) => d.kind === "contract");
  if (!contract || !rules.length) return { links, applied, skipped };
  const keyOf = (l: Line) => nameKey(pack, l.name, l.spec, l.unit);
  const index = (d: ParsedDoc) => { const m = new Map<string, Line[]>(); for (const l of detailItems(d)) { const k = keyOf(l); m.set(k, [...(m.get(k) ?? []), l]); } return m; };
  const base = index(contract);
  const others = pass1.docs.filter((d) => d !== contract).map(index);
  const seen = new Set<string>();
  for (const j of rules) {
    const r = j.payload as NameRule;
    let used = false;
    for (const other of others) {
      for (const [ka, kb] of [[r.aKey, r.bKey], [r.bKey, r.aKey]]) {
        const xs = base.get(ka) ?? [], ys = other.get(kb) ?? [];
        if (!xs.length || !ys.length) continue;
        if (!r.same) { for (const x of xs) for (const y of ys) { const id = pairId(x.fp, y.fp); if (!seen.has(id)) { seen.add(id); links.push({ a: x.fp, b: y.fp, same: false }); used = true; applied.push({ judgmentId: j.id, a: x.fp, b: y.fp }); } } continue; }
        if (xs.length > 1 || ys.length > 1) { skipped.push({ judgmentId: j.id, reason: `같은 이름의 줄이 여러 개라 자동으로 쓰지 않음(계약 ${xs.length}줄 · 비교 문서 ${ys.length}줄)` }); continue; }
        const x = xs[0], y = ys[0];
        if (taken.has(x.fp) || taken.has(y.fp)) { skipped.push({ judgmentId: j.id, reason: "이 현장에서 사람이 이미 판단한 줄이라 현장 판단을 따름" }); continue; }
        const id = pairId(x.fp, y.fp);
        if (seen.has(id)) continue;
        seen.add(id);
        links.push({ a: x.fp, b: y.fp, same: true });
        applied.push({ judgmentId: j.id, a: x.fp, b: y.fp });
        used = true;
      }
    }
    if (!used && !skipped.some((s) => s.judgmentId === j.id)) skipped.push({ judgmentId: j.id, reason: "이 현장 자료에 해당 이름이 없음" });
  }
  return { links, applied, skipped };
}

export function runAnalysis(inp: AnalysisInput): AnalysisView {
  const { site, pack } = inp;
  const active = inp.files.filter((f) => f.file.active);
  const docs: DocInput[] = active.map((f) => ({ docId: f.file.id, kind: f.file.kind, round: f.file.round, workbook: f.workbook }));
  const meta = metaOf(site);
  const { site: sj, rules } = activeFor(inp.judgments, site);
  const dec = siteDecisions(sj);
  let result = analyze({ docs, meta, pack, decisions: dec });
  const taken = new Set<string>();
  for (const l of dec.links ?? []) { taken.add(l.a); taken.add(l.b); }
  const r = applyRules(result, rules, taken, pack);
  if (r.links.length) {
    const links = [...(dec.links ?? []), ...r.links].sort((x, y) => (pairId(x.a, x.b) < pairId(y.a, y.b) ? -1 : 1));
    result = analyze({ docs, meta, pack, decisions: { ...dec, links } });
  }
  // 연결이 어떻게 정해졌나
  const personSame = new Set((dec.links ?? []).filter((l) => l.same).map((l) => pairId(l.a, l.b)));
  const ruleSame = new Set(r.links.filter((l) => l.same).map((l) => pairId(l.a, l.b)));
  const origins = new Map<string, LinkOrigin>();
  for (const l of result.links) {
    const id = pairId(l.a.fp, l.b.fp);
    const origin: LinkOrigin = l.via === "decision" ? (personSame.has(id) ? "person" : ruleSame.has(id) ? "rule" : "person") : l.state === "review" ? "review" : "auto";
    origins.set(`${id}|${l.b.docId}`, origin);
  }
  const snapshot = snapshotOf(result, origins, dec.links?.filter((l) => !l.same).length ?? 0, inp.files.map((f) => f.file));
  return { result, origins, rules: { applied: r.applied, skipped: r.skipped }, snapshot };
}

export function linkOrigin(view: AnalysisView, l: AnalyzeResult["links"][number]): LinkOrigin {
  return view.origins.get(`${pairId(l.a.fp, l.b.fp)}|${l.b.docId}`) ?? (l.state === "review" ? "review" : "auto");
}

/** 연결되지 않은 줄 — 비교 문서마다: 계약 쪽 · 비교 쪽 */
export function unlinked(result: AnalyzeResult): { docId: string; base: Line[]; other: Line[] }[] {
  const contract = result.docs.find((d) => d.kind === "contract");
  if (!contract) return [];
  const baseItems = detailItems(contract);
  return result.docs.filter((d) => d !== contract && d.kind !== "cost").map((d) => {
    const ls = result.links.filter((l) => l.b.docId === d.docId);
    const a = new Set(ls.map((l) => `${l.a.sheet}|${l.a.row}`)), b = new Set(ls.map((l) => `${l.b.sheet}|${l.b.row}`));
    return { docId: d.docId, base: baseItems.filter((l) => !a.has(`${l.sheet}|${l.row}`)), other: detailItems(d).filter((l) => !b.has(`${l.sheet}|${l.row}`)) };
  });
}

/** 연결 후보 — 사람이 직접 짝을 고를 때 보여 줄 상위 n개(점수 · 항목별 기여 포함) */
export function candidates(line: Line, pool: Line[], pack: IndustryPack, n = 3): { line: Line; score: number; parts: Record<string, number> }[] {
  const norm = makeNormalizer(pack);
  const sec = (l: Line) => (l.path.length ? norm.section(l.path[l.path.length - 1]) : "");
  return pool
    .map((p) => { const s = pairScore(line.norm, p.norm, line.unitPrice, p.unitPrice, sec(line) && sec(p) ? (sec(line) === sec(p) ? 1 : 0.5) : 0.5, pack, {}); return { line: p, score: Math.round(s.score * 1000) / 1000, parts: s.parts }; })
    .sort((x, y) => y.score - x.score || x.line.row - y.line.row)
    .slice(0, n);
}

export function snapshotOf(result: AnalyzeResult, origins: Map<string, LinkOrigin>, rejected: number, files: StoredFile[]): RunSnapshot {
  const counts = { auto: 0, review: 0, person: 0, rule: 0, rejected, unlinkedBase: 0, unlinkedOther: 0, items: 0 };
  const links = result.links.map((l) => {
    const origin = origins.get(`${pairId(l.a.fp, l.b.fp)}|${l.b.docId}`) ?? (l.state === "review" ? "review" : "auto");
    if (origin === "auto") counts.auto++; else if (origin === "review") counts.review++; else if (origin === "person") counts.person++; else if (origin === "rule") counts.rule++;
    const find = (docId: string, sheet: string, row: number) => result.docs.find((d) => d.docId === docId)?.sheets.find((s) => s.sheet === sheet)?.lines.find((x) => x.row === row);
    return { a: l.a.fp, b: l.b.fp, docB: l.b.docId, state: l.state, origin, score: l.score, aName: find(l.a.docId, l.a.sheet, l.a.row)?.name ?? "", bName: find(l.b.docId, l.b.sheet, l.b.row)?.name ?? "" };
  });
  for (const u of unlinked(result)) { counts.unlinkedBase += u.base.length; counts.unlinkedOther += u.other.length; }
  counts.items = result.docs.reduce((s, d) => s + detailItems(d).length, 0);
  const name = (id: string) => files.find((f) => f.id === id)?.fileName ?? id;
  return {
    findings: result.findings.map(snapOf),
    links,
    columns: result.docs.flatMap((d) => d.sheets.filter((s) => s.lines.length).map((s) => ({ fileId: d.docId, sheet: s.sheet, confidence: s.confidence, roles: s.columns.map((c) => `${c.col}:${c.group ? c.group + "." : ""}${c.role}`).join(",") }))),
    skipped: result.skipped.map((s) => ({ ...s, reason: s.reason.replace(/^([0-9a-f-]{8,})(?= \/)/, (m) => name(m)) })),
    counts,
  };
}

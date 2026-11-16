import type { Finding, Line, ParsedDoc, ParsedSheet } from "../types";
import { checkTotals } from "../read/totals";
import { bigrams, dice } from "../normalize/text";
import { makeNormalizer } from "../normalize/name";
import type { DetectCtx } from "./common";
import { cellEvidence, docTag, evidence, findingKey, fmt, itemSum, severity, totalsOf } from "./common";

/**
 * D02 합계 — ① 시트 안: 소계 · 합계 · 금액 단 구간 제목이 아래(위) 항목의 합과 맞는가, 숨긴 행이 섞였는가
 *            ② 시트 사이: 요약(집계) 시트의 구간 금액 ↔ 세부 시트의 구간 합, 요약에 빠진 구간
 *            ③ 문서 ↔ 계약 정보: 최종 합계 ↔ 계약금액, 표지 금액 ↔ 합계
 */
export function detectD02(ctx: DetectCtx): Finding[] {
  const out: Finding[] = [];
  const norm = makeNormalizer(ctx.pack);
  for (const doc of ctx.docs) {
    for (const sh of doc.sheets) inSheet(out, ctx, doc, sh);
    crossSheet(out, ctx, doc, norm);
    if (doc.kind === "contract") contractAmount(out, ctx, doc);
    cover(out, ctx, doc);
  }
  return out;
}

function seriesKey(series: string): string { return series === "amount" ? "amount" : series; }
const SERIES_LABEL: Record<string, string> = { amount: "", "before.amount": " (변경 전 금액)", "after.amount": " (변경 후 금액)", "delta.amount": " (증감 금액)" };

function inSheet(out: Finding[], ctx: DetectCtx, doc: ParsedDoc, sh: ParsedSheet) {
  if (!sh.lines.length) return;
  // 같은 숨긴 행을 안쪽 합계에서 이미 알렸으면 바깥 합계(총계 등)에서는 다시 알리지 않는다
  const reported = new Map<string, Set<number>>();
  for (const c of checkTotals(sh.lines, sh.shape, ctx.pack.params.sumTolPerLine)) {
    const L = c.line;
    const label = L.name || L.kind;
    const keyCols = ["name", seriesKey(c.series)];
    if (!c.ok && c.expected !== undefined) {
      const diff = c.value - c.expected;
      out.push({
        key: findingKey(["D02", L.kind === "section" ? "section" : "subtotal", docTag(doc), sh.kind, L.fp, c.series]),
        detector: "D02", check: L.kind === "section" ? "section" : "subtotal", severity: severity(ctx, diff), certainty: "calc",
        title: L.kind === "section" ? "구간 제목에 적힌 금액이 그 구간 항목의 합과 다릅니다" : "합계 줄이 항목의 합과 다릅니다",
        message: `${sh.sheet} ${L.row + 1}행 '${label}'${SERIES_LABEL[c.series]}: 적힌 값 ${fmt(c.value)} / ${c.expectedLabel} ${fmt(c.expected)} / 차이 ${fmt(diff)}`,
        amount: Math.abs(diff),
        evidence: [evidence(ctx, L, keyCols, "base")],
        calc: { expr: `적힌 값 − ${c.expectedLabel}`, inputs: { value: c.value, expected: c.expected } },
        caveat: "합계의 범위를 다르게 잡은 문서일 수 있습니다(예: 일부 항목만 더함). 원본의 합계 수식 범위를 확인해 보세요.",
      });
    }
    if (c.hiddenNote) {
      const h = c.hiddenNote;
      const seen = reported.get(c.series) ?? new Set<number>();
      reported.set(c.series, seen);
      if (h.rows.every((r) => seen.has(r))) continue;
      for (const r of h.rows) seen.add(r);
      const hiddenLines = sh.lines.filter((x) => h.rows.includes(x.row)).slice(0, 5);
      out.push({
        key: findingKey(["D02", `hidden-${h.mode}`, docTag(doc), sh.kind, L.fp, c.series]),
        detector: "D02", check: `hidden-${h.mode}`, severity: "low", certainty: "calc",
        title: h.mode === "included" ? "숨긴 행이 합계에 들어 있습니다" : "숨긴 행이 합계에서 빠져 있습니다",
        message: h.mode === "included"
          ? `${sh.sheet} ${L.row + 1}행 '${label}': 숨긴 행 ${h.count}개(합 ${fmt(h.sum)})가 이 합계에 들어 있습니다 — 인쇄하거나 PDF 로 보내면 보이는 항목의 합이 맞지 않게 보입니다`
          : `${sh.sheet} ${L.row + 1}행 '${label}': 숨긴 행 ${h.count}개(합 ${fmt(h.sum)})가 이 합계에서 빠져 있습니다 — 일부러 뺀 것인지 확인해 보세요`,
        amount: Math.abs(h.sum),
        evidence: [evidence(ctx, L, keyCols, "base"), ...hiddenLines.map((x) => evidence(ctx, x, ["name", "amount"], "compare" as const))],
        calc: { expr: "합계 − 보이는 항목의 합", inputs: { hiddenSum: h.sum, hiddenRows: h.count } },
      });
    }
  }
}

interface Sec { key: string; name: string; canon: string; items: Line[]; sum: number; subtotal?: Line; header?: Line; sheet: ParsedSheet }

function sectionsOf(sh: ParsedSheet, norm: ReturnType<typeof makeNormalizer>): Sec[] {
  const map = new Map<string, Sec>();
  for (const l of sh.lines) {
    if (l.kind === "section") {
      if (!map.has(l.sectionKey)) map.set(l.sectionKey, { key: l.sectionKey, name: l.name, canon: norm.section(l.name), items: [], sum: 0, header: l, sheet: sh });
    }
  }
  for (const l of sh.lines) {
    if (l.kind === "item" && l.sectionKey) {
      // 항목의 구간 열쇠와 그 조상 구간들에 더한다("/a/b" → "/a", "/a/b")
      let cur = "";
      for (const part of l.sectionKey.split("/").slice(1)) { cur += "/" + part; const s = map.get(cur); if (s) { s.items.push(l); s.sum += l.amount ?? 0; } }
    }
    if (l.kind === "subtotal" && l.closes) { const s = map.get(l.closes); if (s) s.subtotal = l; }
  }
  return [...map.values()].filter((s) => s.items.length);
}

function crossSheet(out: Finding[], ctx: DetectCtx, doc: ParsedDoc, norm: ReturnType<typeof makeNormalizer>) {
  const summaries = doc.sheets.filter((s) => s.kind === "summary" && s.lines.length);
  const details = doc.sheets.filter((s) => s.kind === "detail" && s.lines.length);
  if (!summaries.length || !details.length) return;
  const secs = details.flatMap((d) => sectionsOf(d, norm));
  const tol = (n: number) => Math.max(1, n * ctx.pack.params.sumTolPerLine);
  for (const sm of summaries) {
    // 요약 시트의 "구간 목록"은 첫 합계 줄 앞까지다 — 그 뒤의 줄(간접비 · 조정 등)은 세부 시트의 구간과 비교하지 않는다(낱말 사전 없이 구조로 판단)
    const firstSum = sm.lines.findIndex((l) => l.kind === "subtotal" || l.kind === "total");
    const block = firstSum >= 0 ? sm.lines.slice(0, firstSum) : sm.lines;
    const rows = block.filter((l) => l.kind === "item" && !l.flags.includes("overhead") && l.amount !== undefined);
    let matchedRows = 0;
    const unmatched: Finding[] = [];
    const used = new Set<string>();
    const byCanon = new Map<string, Sec[]>();
    for (const s of secs) { const arr = byCanon.get(s.canon); if (arr) arr.push(s); else byCanon.set(s.canon, [s]); }
    for (const r of rows) {
      const c = norm.section(r.name);
      let best: Sec | undefined, bestS = 0;
      const exact = byCanon.get(c)?.find((s) => !used.has(s.key));
      if (exact) { best = exact; bestS = 1; }
      else {
        const bc = bigrams(c);
        for (const s of secs) {
          if (used.has(s.key)) continue;
          const sc = dice(bigrams(s.canon), bc);
          if (sc > bestS) { best = s; bestS = sc; }
        }
      }
      if (!best || bestS < 0.75) {
        unmatched.push({
          key: findingKey(["D02", "summary-unmatched", docTag(doc), r.fp]),
          detector: "D02", check: "summary-unmatched", severity: "low", certainty: "inferred",
          title: "요약 시트의 구간을 세부 시트에서 찾지 못했습니다",
          message: `${sm.sheet} ${r.row + 1}행 '${r.name}' ${fmt(r.amount)} — 세부 시트에 같은 이름의 구간이 없습니다(이름이 다르게 적혔을 수 있습니다)`,
          amount: r.amount,
          evidence: [evidence(ctx, r, ["name", "amount"], "base")],
          calc: { expr: "구간 이름 대조", inputs: { amount: r.amount ?? 0 } },
        });
        continue;
      }
      used.add(best.key);
      matchedRows++;
      const v = r.amount!;
      const okVals = [best.sum, best.subtotal?.amount, best.header?.amount].filter((x): x is number => x !== undefined);
      if (okVals.some((x) => Math.abs(x - v) <= tol(best!.items.length))) continue;
      const diff = v - best.sum;
      const ref = best.subtotal ?? best.header;
      out.push({
        key: findingKey(["D02", "summary-section", docTag(doc), r.fp, best.key]),
        detector: "D02", check: "summary-section", severity: severity(ctx, diff), certainty: "calc",
        title: "요약 시트의 구간 금액이 세부 시트의 구간 합과 다릅니다",
        message: `'${r.name}': 요약 ${sm.sheet} ${r.row + 1}행 ${fmt(v)} / 세부 ${best.sheet.sheet} 항목 합 ${fmt(best.sum)}${best.subtotal ? ` (소계 줄 ${fmt(best.subtotal.amount)})` : ""} / 차이 ${fmt(diff)}`,
        amount: Math.abs(diff),
        evidence: [evidence(ctx, r, ["name", "amount"], "base"), ...(ref ? [evidence(ctx, ref, ["name", "amount"], "compare" as const)] : [])],
        calc: { expr: "요약 구간 금액 − 세부 구간 항목 합", inputs: { summary: v, detail: best.sum } },
        caveat: "요약 시트를 세부 시트와 연결하지 않고 값으로 적었을 때 생깁니다. 마지막으로 고친 쪽이 어느 것인지 확인해 보세요.",
      });
    }
    // 세부에는 있는데 요약에 없는 구간(최상위 · 그다음 단계만)
    // 이름이 맞지 않는 요약 줄은, 요약 시트의 대부분이 세부 시트와 맞을 때만 알린다(대부분 안 맞으면 읽기 문제일 가능성이 크다)
    if (rows.length && matchedRows >= rows.length * 0.5) out.push(...unmatched);
    // 요약 시트를 구간 목록으로 제대로 읽었는지: 맞춘 구간이 너무 적으면(절반 미만) "요약에 없는 구간" 판정을 하지 않는다
    const topSecs = secs.filter((x) => !x.key.slice(1).includes("/"));
    if (matchedRows < Math.max(2, Math.ceil(topSecs.length * 0.5)) && rows.length > 0 && matchedRows < rows.length * 0.5) continue;
    let topLevel = Infinity;
    for (const s of secs) topLevel = Math.min(topLevel, s.header?.level ?? 1);
    // 쓰인 구간의 조상 열쇠 모음(하위 구간이 요약에 있으면 상위 구간은 빠진 것이 아니다)
    const usedAncestors = new Set<string>();
    for (const k of used) { let i = k.lastIndexOf("/"); while (i > 0) { usedAncestors.add(k.slice(0, i)); i = k.lastIndexOf("/", i - 1); } }
    for (const s of secs) {
      if (used.has(s.key)) continue;
      const lvl = s.header?.level ?? 1;
      const childUsed = usedAncestors.has(s.key);
      let parentUsed = false;
      { let i = s.key.lastIndexOf("/"); while (i > 0 && !parentUsed) { if (used.has(s.key.slice(0, i))) parentUsed = true; i = s.key.lastIndexOf("/", i - 1); } }
      if (childUsed || parentUsed || lvl > topLevel + 1) continue;
      out.push({
        key: findingKey(["D02", "summary-missing", docTag(doc), s.key]),
        detector: "D02", check: "summary-missing", severity: severity(ctx, s.sum), certainty: "inferred",
        title: "세부 시트의 구간이 요약 시트에 없습니다",
        message: `'${s.name}' (세부 ${s.sheet.sheet}, 항목 ${s.items.length}개 · 합 ${fmt(s.sum)}) — 요약 시트에서 찾지 못했습니다`,
        amount: s.sum,
        evidence: [...(s.header ? [evidence(ctx, s.header, ["name"], "base")] : [])],
        calc: { expr: "구간 이름 대조", inputs: { sum: s.sum } },
      });
    }
  }
}

function contractAmount(out: Finding[], ctx: DetectCtx, doc: ParsedDoc) {
  const target = ctx.meta.contractAmount;
  if (target === undefined) return;
  const sm = doc.sheets.find((s) => s.kind === "summary" && s.lines.length);
  const dt = doc.sheets.find((s) => s.kind === "detail" && s.lines.length);
  const src = sm ?? dt;
  if (!src) return;
  const t = totalsOf(src);
  const line = ctx.meta.vat === "included" ? t.postTax ?? t.preTax : t.preTax;
  const value = line?.amount ?? (sm ? undefined : itemSum(dt!.lines));
  if (value === undefined) return;
  if (Math.abs(value - target) <= 1) return;
  const diff = value - target;
  out.push({
    key: findingKey(["D02", "contract-amount", docTag(doc), src.kind, line?.fp ?? "items"]),
    detector: "D02", check: "contract-amount", severity: severity(ctx, diff), certainty: "calc",
    title: "문서의 최종 합계가 계약금액과 다릅니다",
    message: `${src.sheet}${line ? ` ${line.row + 1}행 '${line.name}'` : " 항목 합"} ${fmt(value)} / 계약금액(${ctx.meta.vat === "included" ? "부가세 포함" : "부가세 별도"}) ${fmt(target)} / 차이 ${fmt(diff)}`,
    amount: Math.abs(diff),
    evidence: line ? [evidence(ctx, line, ["name", "amount"], "base")] : [],
    calc: { expr: "문서 합계 − 계약금액", inputs: { document: value, contract: target } },
    caveat: "계약 때 금액을 조정(네고)하고 문서를 고치지 않았을 수 있습니다. 어느 금액이 최종인지 확인해 보세요.",
  });
}

function cover(out: Finding[], ctx: DetectCtx, doc: ParsedDoc) {
  const covers = doc.sheets.filter((s) => s.coverAmounts.length);
  if (!covers.length) return;
  const sm = doc.sheets.find((s) => s.kind === "summary" && s.lines.length) ?? doc.sheets.find((s) => s.kind === "detail" && s.lines.length);
  if (!sm) return;
  const t = totalsOf(sm);
  const refs = [t.preTax?.amount, t.postTax?.amount].filter((x): x is number => x !== undefined);
  if (!refs.length) return;
  for (const cv of covers) for (const a of cv.coverAmounts) {
    if (refs.some((x) => Math.abs(x - a.amount) <= 1)) continue;
    const near = refs.reduce((p, x) => (Math.abs(x - a.amount) < Math.abs(p - a.amount) ? x : p), refs[0]);
    const diff = a.amount - near;
    const refLine = Math.abs((t.preTax?.amount ?? NaN) - near) < 1e-9 ? t.preTax : t.postTax;
    out.push({
      key: findingKey(["D02", "cover", docTag(doc), cv.kind, a.label, a.col]),
      detector: "D02", check: "cover", severity: severity(ctx, diff), certainty: "calc",
      title: "표지 금액이 합계와 다릅니다",
      message: `${cv.sheet} ${a.row + 1}행 '${a.label}' ${fmt(a.amount)} / ${sm.sheet} 합계 ${fmt(near)} / 차이 ${fmt(diff)}`,
      amount: Math.abs(diff),
      evidence: [cellEvidence(ctx, doc.docId, cv.sheetIndex, a.row, a.col, "amount", "base"), ...(refLine ? [evidence(ctx, refLine, ["name", "amount"], "compare" as const)] : [])],
      calc: { expr: "표지 금액 − 합계", inputs: { cover: a.amount, total: near } },
    });
  }
}

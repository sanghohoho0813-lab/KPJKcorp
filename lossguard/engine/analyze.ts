import type { AnalyzeInput, AnalyzeResult, Finding, Line, Link, LineageItem, ParsedDoc, RawWorkbook } from "./types";
import { ENGINE_VERSION } from "./version";
import { hash16 } from "./hash";
import { makeNormalizer } from "./normalize/name";
import { aliasIndex } from "./read/header";
import { parseDoc } from "./read/parse";
import { lineage, matchLines } from "./match/match";
import { itemSum, totalsOf, type DetectCtx } from "./detect/common";
import { detectD01 } from "./detect/d01";
import { detectD02 } from "./detect/d02";
import { detectD03 } from "./detect/d03";

/**
 * 엔진의 입구 — 화면도, 명령줄 도구도, 시험도 이 함수 하나만 부른다.
 * 같은 파일 + 같은 업종 묶음 + 같은 사람 판단이면 결과가 글자 하나까지 같다(문서를 넣는 순서와 무관).
 */
const KIND_ORDER = { contract: 0, change: 1, settlement: 2, other: 3 } as const;

export function inputHash(docs: { docId: string; workbook: RawWorkbook }[], meta: unknown): string {
  const parts: string[] = [];
  for (const d of docs) {
    parts.push(`#${d.docId}`);
    for (const s of d.workbook.sheets) {
      parts.push(`@${s.name}|${s.hidden ? 1 : 0}|${s.hiddenRows.join(",")}|${s.merges.map((m) => `${m.r1},${m.c1},${m.r2},${m.c2}`).join(";")}`);
      s.rows.forEach((row, r) => { if (row.length) parts.push(`${r}:${row.map((c) => (c ? c.v : "")).join("\t")}`); });
    }
  }
  parts.push(JSON.stringify(meta));
  return hash16(parts.join("\n"));
}

export function detailItems(doc: ParsedDoc): Line[] {
  return doc.sheets.filter((s) => s.kind === "detail").flatMap((s) => s.lines.filter((l) => l.kind === "item" && !l.flags.includes("overhead")));
}

export function analyze(input: AnalyzeInput): AnalyzeResult {
  const { pack, meta } = input;
  const docsIn = [...input.docs].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.round ?? 0) - (b.round ?? 0) || (a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0));
  const norm = makeNormalizer(pack);
  const idx = aliasIndex(pack);
  const docs = docsIn.map((d) => parseDoc(d, pack, idx, norm, input.decisions?.columns));
  const raw = new Map(docsIn.map((d) => [d.docId, d.workbook]));

  // 문서 간 항목 정합: 기준 = 계약 문서
  const contract = docs.find((d) => d.kind === "contract");
  const links = new Map<string, Link[]>();
  const allLinks: Link[] = [];
  const lin: LineageItem[] = [];
  const skipped: AnalyzeResult["skipped"] = [];
  if (contract) {
    const baseItems = detailItems(contract);
    for (const d of docs) {
      if (d === contract) continue;
      const items = detailItems(d);
      if (!items.length || !baseItems.length) continue;
      const lk = matchLines(baseItems, items, pack, norm, input.options?.matching, input.decisions?.links);
      links.set(d.docId, lk);
      allLinks.push(...lk);
      if (d.kind === "change") lin.push(...lineage(baseItems, items, lk, d.docId));
    }
  } else skipped.push({ detector: "match", reason: "계약 문서가 없어 문서 간 항목 정합을 하지 않음" });

  // 심각도 기준 금액
  let base = meta.contractAmount;
  if (base === undefined && contract) {
    const sm = contract.sheets.find((s) => s.kind === "summary" && s.lines.length);
    base = (sm && totalsOf(sm).preTax?.amount) || itemSum(detailItems(contract)) || undefined;
  }
  const ctx: DetectCtx = { pack, meta, docs, raw, base, links };
  const raw0: Finding[] = [...detectD01(ctx), ...detectD02(ctx), ...detectD03(ctx)];
  // 안전장치: 읽기 신뢰도가 문턱보다 낮은 시트를 근거로 한 결과는 경고로 내지 않고 보류한다
  //  (처음 보는 양식을 잘못 읽은 채로 틀린 경고를 쏟아내지 않게 — 사람이 열 지정을 확인한 뒤 다시 분석)
  const conf = new Map<string, { c: number; n: number }>();
  for (const d of docs) for (const s of d.sheets) if (s.lines.length) conf.set(`${d.docId}|${s.sheet}`, { c: s.confidence, n: 0 });
  const found: Finding[] = [];
  for (const f of raw0) {
    const low = f.evidence.map((e) => conf.get(`${e.docId}|${e.sheet}`)).find((x) => x && x.c < pack.params.confidenceThreshold);
    if (low) { low.n++; continue; }
    found.push(f);
  }
  for (const [k, v] of conf) if (v.n) skipped.push({ detector: "읽기 신뢰도", reason: `${k.replace("|", " / ")}: 신뢰도 ${v.c} — 결과 ${v.n}건 보류(열 지정을 확인한 뒤 다시 분석)` });
  if (!docs.some((d) => d.kind === "change")) skipped.push({ detector: "D03", reason: "변경 문서가 없음" });
  if (meta.contractAmount === undefined) skipped.push({ detector: "D02:contract-amount", reason: "계약금액이 입력되지 않음" });

  const seen = new Set<string>();
  const findings: Finding[] = [];
  const sevRank = { high: 0, mid: 1, low: 2 };
  const docRank = new Map(docs.map((d, i) => [d.docId, i]));
  found.sort((a, b) => {
    const ea = a.evidence[0], eb = b.evidence[0];
    return sevRank[a.severity] - sevRank[b.severity]
      || (docRank.get(ea?.docId ?? "") ?? 0) - (docRank.get(eb?.docId ?? "") ?? 0)
      || (ea && eb ? (ea.sheet < eb.sheet ? -1 : ea.sheet > eb.sheet ? 1 : ea.row - eb.row) : 0)
      || (a.detector < b.detector ? -1 : a.detector > b.detector ? 1 : 0)
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  });
  for (const f of found) { if (seen.has(f.key)) continue; seen.add(f.key); findings.push(f); }

  return {
    docs,
    links: allLinks,
    lineage: lin,
    findings,
    skipped,
    versions: { engine: ENGINE_VERSION, pack: `${pack.key}@${pack.version}`, inputHash: inputHash(docsIn, meta) },
  };
}

import type { Finding, GroupKey, Line, ParsedDoc, ParsedSheet } from "../types";
import { lineTol } from "../normalize/number";
import type { DetectCtx } from "./common";
import { docTag, evidence, findingKey, fmt, severity } from "./common";

/**
 * D01 줄 계산 — 한 줄 안의 수량 × 단가 와 금액, (재료비 + 노무비 + 경비) 와 합계 금액.
 * 계산으로 확정되는 불일치만 낸다(certainty: calc).
 */
const CAVEAT = "원 미만 처리 방식이나 일부러 조정한 금액(네고)일 수 있습니다. 원본 파일의 수식이 값으로 바뀌었는지 확인해 보세요.";

export function detectD01(ctx: DetectCtx): Finding[] {
  const out: Finding[] = [];
  const P = ctx.pack.params;
  for (const doc of ctx.docs) for (const sh of doc.sheets) {
    if (sh.kind === "cover" || sh.kind === "unitcost" || sh.shape === "none") continue;
    for (const l of sh.lines) {
      if (l.kind !== "item") continue;
      check(out, ctx, doc, sh, l, "line", l.qty, l.unitPrice, l.amount, ["name", "qty", "unitPrice", "amount"], P.lineAbsTol, P.lineRelTol);
      if (sh.shape === "split") {
        const parts: number[] = [];
        for (const g of ["mat", "lab", "exp"] as GroupKey[]) {
          const p = l.groups[g];
          if (!p) continue;
          if (p.amount !== undefined) parts.push(p.amount);
          check(out, ctx, doc, sh, l, `part:${g}`, l.qty, p.unitPrice, p.amount, ["name", "qty", `${g}.unitPrice`, `${g}.amount`], P.lineAbsTol, P.lineRelTol);
        }
        const sumAmt = l.groups.sum?.amount;
        if (sumAmt !== undefined && parts.length >= 2) {
          const s = parts.reduce((a, b) => a + b, 0);
          const diff = s - sumAmt;
          if (Math.abs(diff) > Math.max(P.lineAbsTol, parts.length)) {
            out.push({
              key: findingKey(["D01", "parts-sum", docTag(doc), sh.kind, l.fp]),
              detector: "D01", check: "parts-sum", severity: severity(ctx, diff), certainty: "calc",
              title: "재료비 · 노무비 · 경비의 합이 합계 금액과 다릅니다",
              message: `${sh.sheet} ${l.row + 1}행 '${l.name}': 나눈 금액의 합 ${fmt(s)} / 합계 금액 ${fmt(sumAmt)} / 차이 ${fmt(diff)}`,
              amount: Math.abs(diff),
              evidence: [evidence(ctx, l, ["name", "mat.amount", "lab.amount", "exp.amount", "sum.amount"], "base")],
              calc: { expr: "Σ(재료비 · 노무비 · 경비 금액) − 합계 금액", inputs: { parts: s, sum: sumAmt } },
              caveat: CAVEAT,
            });
          }
        }
      }
      if (sh.shape === "compare" && l.groups.before) {
        const b = l.groups.before;
        if (b.amount !== undefined) check(out, ctx, doc, sh, l, "line:before", b.qty, l.unitPrice, b.amount, ["name", "before.qty", "unitPrice", "before.amount"], P.lineAbsTol, P.lineRelTol);
      }
    }
  }
  return out;
}

function check(
  out: Finding[], ctx: DetectCtx, doc: ParsedDoc, sh: ParsedSheet, l: Line, chk: string,
  q: number | undefined, p: number | undefined, a: number | undefined, keys: string[], absTol: number, relTol: number,
) {
  if (q === undefined || p === undefined || a === undefined || q === 0 || p === 0) return;
  const calc = q * p;
  const diff = a - calc;
  if (Math.abs(diff) <= lineTol(a, absTol, relTol) + 1) return;
  out.push({
    key: findingKey(["D01", chk, docTag(doc), sh.kind, l.fp]),
    detector: "D01", check: chk, severity: severity(ctx, diff), certainty: "calc",
    title: "줄 계산(수량 × 단가)이 금액과 다릅니다",
    message: `${sh.sheet} ${l.row + 1}행 '${l.name}': 수량 ${fmt(q)} × 단가 ${fmt(p)} = ${fmt(Math.floor(calc))} / 적힌 금액 ${fmt(a)} / 차이 ${fmt(Math.round(diff))}`,
    amount: Math.abs(Math.round(diff)),
    evidence: [evidence(ctx, l, keys, "base")],
    calc: { expr: "금액 − 수량 × 단가", inputs: { qty: q, unitPrice: p, amount: a } },
    caveat: CAVEAT,
  });
}

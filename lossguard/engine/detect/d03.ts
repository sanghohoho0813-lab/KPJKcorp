import type { Finding, Line, ParsedDoc } from "../types";
import { lineTol } from "../normalize/number";
import type { DetectCtx } from "./common";
import { docTag, evidence, findingKey, fmt, severity, totalsOf } from "./common";

/**
 * D03 변경 — ① 변경 전 + 증감 = 변경 후 (줄마다)
 *            ② 변경 문서의 합계 ↔ 계약 정보의 변경 전 · 후 금액
 *            ③ 변경 문서의 "변경 전" 값 ↔ 기준(계약) 문서의 같은 항목(항목 정합 결과 사용)
 */
export function detectD03(ctx: DetectCtx): Finding[] {
  const out: Finding[] = [];
  const P = ctx.pack.params;
  const contract = ctx.docs.find((d) => d.kind === "contract");
  for (const doc of ctx.docs) {
    if (doc.kind !== "change") continue;
    const meta = ctx.meta.changes?.find((c) => c.round === (doc.round ?? 1));
    for (const sh of doc.sheets) {
      if (!sh.lines.length) continue;
      if (sh.shape === "compare") {
        for (const l of sh.lines) {
          const b = l.groups.before, a = l.groups.after, d = l.groups.delta;
          if (!b || !a || !d) continue;
          if (b.amount !== undefined && a.amount !== undefined && d.amount !== undefined) {
            const diff = b.amount + d.amount - a.amount;
            if (Math.abs(diff) > lineTol(a.amount, P.lineAbsTol, P.lineRelTol) + 1) {
              out.push(mk(ctx, doc, l, "delta-amount", diff, `변경 전 ${fmt(b.amount)} + 증감 ${fmt(d.amount)} = ${fmt(b.amount + d.amount)} / 변경 후 ${fmt(a.amount)} / 차이 ${fmt(diff)}`,
                ["name", "before.amount", "delta.amount", "after.amount"], { before: b.amount, delta: d.amount, after: a.amount }));
            }
          }
          if (l.kind === "item" && b.qty !== undefined && a.qty !== undefined && d.qty !== undefined) {
            const dq = b.qty + d.qty - a.qty;
            if (Math.abs(dq) > 1e-6 * Math.max(1, Math.abs(a.qty))) {
              const money = l.unitPrice !== undefined ? dq * l.unitPrice : undefined;
              out.push(mk(ctx, doc, l, "delta-qty", money ?? dq, `수량: 변경 전 ${fmt(b.qty)} + 증감 ${fmt(d.qty)} = ${fmt(b.qty + d.qty)} / 변경 후 ${fmt(a.qty)}`,
                ["name", "before.qty", "delta.qty", "after.qty"], { beforeQty: b.qty, deltaQty: d.qty, afterQty: a.qty }, money === undefined));
            }
          }
        }
        if (meta) {
          const t = totalsOf(sh).preTax;
          const after = t?.groups.after?.amount, before = t?.groups.before?.amount;
          if (t && meta.newAmount !== undefined && after !== undefined && Math.abs(after - meta.newAmount) > 1) out.push(amountFinding(ctx, doc, sh.sheet, t, "change-amount", after, meta.newAmount, "변경 후 합계", "변경 계약금액", ["name", "after.amount"]));
          if (t && meta.prevAmount !== undefined && before !== undefined && Math.abs(before - meta.prevAmount) > 1) out.push(amountFinding(ctx, doc, sh.sheet, t, "change-prev", before, meta.prevAmount, "변경 전 합계", "직전 계약금액", ["name", "before.amount"]));
        }
      }
    }
    // 바꾼 뒤 전체를 다시 쓴 변경 문서: 최종 합계 ↔ 변경 계약금액
    if (meta?.newAmount !== undefined && !doc.sheets.some((s) => s.shape === "compare")) {
      const src = doc.sheets.find((s) => s.kind === "summary" && s.lines.length) ?? doc.sheets.find((s) => s.kind === "detail" && s.lines.length);
      const t = src ? totalsOf(src).preTax : undefined;
      if (src && t?.amount !== undefined && Math.abs(t.amount - meta.newAmount) > 1) out.push(amountFinding(ctx, doc, src.sheet, t, "change-amount", t.amount, meta.newAmount, "변경 문서 합계", "변경 계약금액", ["name", "amount"]));
    }
    // ③ 변경 전 값 ↔ 계약 문서
    if (contract) beforeVsContract(out, ctx, doc, contract);
  }
  return out;
}

function mk(ctx: DetectCtx, doc: ParsedDoc, l: Line, chk: string, money: number, msg: string, keys: string[], inputs: Record<string, number>, qtyOnly = false): Finding {
  return {
    key: findingKey(["D03", chk, docTag(doc), l.fp]),
    detector: "D03", check: chk, severity: qtyOnly ? "mid" : severity(ctx, money), certainty: "calc",
    title: chk === "delta-qty" ? "변경 전 수량 + 증감이 변경 후 수량과 다릅니다" : "변경 전 금액 + 증감이 변경 후 금액과 다릅니다",
    message: `${l.sheet} ${l.row + 1}행 '${l.name}': ${msg}`,
    amount: qtyOnly ? undefined : Math.abs(Math.round(money)),
    evidence: [evidence(ctx, l, keys, "base")],
    calc: { expr: "변경 전 + 증감 − 변경 후", inputs },
  };
}

function amountFinding(ctx: DetectCtx, doc: ParsedDoc, sheet: string, t: Line, chk: string, value: number, target: number, what: string, targetLabel: string, keys: string[]): Finding {
  const diff = value - target;
  return {
    key: findingKey(["D03", chk, docTag(doc), t.fp]),
    detector: "D03", check: chk, severity: severity(ctx, diff), certainty: "calc",
    title: chk === "change-prev" ? "변경 문서의 변경 전 합계가 직전 계약금액과 다릅니다" : "변경 문서의 합계가 변경 계약금액과 다릅니다",
    message: `${sheet} ${t.row + 1}행 '${t.name}' ${what} ${fmt(value)} / ${targetLabel} ${fmt(target)} / 차이 ${fmt(diff)}`,
    amount: Math.abs(diff),
    evidence: [evidence(ctx, t, keys, "base")],
    calc: { expr: `${what} − ${targetLabel}`, inputs: { value, target } },
    caveat: "변경 합의 금액을 문서와 다르게 정했을 수 있습니다. 변경 계약서의 금액을 확인해 보세요.",
  };
}

function beforeVsContract(out: Finding[], ctx: DetectCtx, doc: ParsedDoc, contract: ParsedDoc) {
  const links = ctx.links.get(doc.docId) ?? [];
  const P = ctx.pack.params;
  const index = (d: ParsedDoc) => { const m = new Map<string, Line>(); for (const s of d.sheets) for (const l of s.lines) m.set(`${s.sheet}|${l.row}`, l); return m; };
  const ci = index(contract), di = index(doc);
  const lineAt = (d: ParsedDoc, sheet: string, row: number) => (d === contract ? ci : di).get(`${sheet}|${row}`);
  for (const lk of links) {
    if (lk.state !== "auto" && lk.state !== "confirmed") continue;
    const c = lineAt(contract, lk.a.sheet, lk.a.row);
    const x = lineAt(doc, lk.b.sheet, lk.b.row);
    if (!c || !x || !x.groups.before) continue;
    const bq = x.groups.before.qty, ba = x.groups.before.amount;
    const qtyDiff = bq !== undefined && c.qty !== undefined && Math.abs(bq - c.qty) > 1e-6 * Math.max(1, Math.abs(c.qty));
    const amtDiff = ba !== undefined && c.amount !== undefined && Math.abs(ba - c.amount) > lineTol(c.amount, P.lineAbsTol, P.lineRelTol) + 1;
    if (!qtyDiff && !amtDiff) continue;
    const money = amtDiff ? ba! - c.amount! : (bq! - c.qty!) * (c.unitPrice ?? 0);
    out.push({
      key: findingKey(["D03", "before-vs-contract", docTag(doc), x.fp, c.fp]),
      detector: "D03", check: "before-vs-contract", severity: severity(ctx, money), certainty: lk.state === "confirmed" ? "linked" : "inferred",
      title: "변경 문서의 '변경 전' 값이 계약 문서와 다릅니다",
      message: `'${x.name}': 변경 문서 ${x.sheet} ${x.row + 1}행 변경 전 수량 ${fmt(bq)} · 금액 ${fmt(ba)} / 계약 문서 ${c.sheet} ${c.row + 1}행 수량 ${fmt(c.qty)} · 금액 ${fmt(c.amount)}`,
      amount: Math.abs(Math.round(money)),
      evidence: [evidence(ctx, x, ["name", "before.qty", "before.amount"], "base"), evidence(ctx, c, ["name", "qty", "amount"], "compare")],
      calc: { expr: "변경 문서의 변경 전 값 − 계약 문서 값", inputs: { beforeQty: bq ?? 0, contractQty: c.qty ?? 0, beforeAmount: ba ?? 0, contractAmount: c.amount ?? 0 } },
      caveat: lk.state === "auto" ? "두 줄의 연결은 자동으로 정한 것입니다. 같은 항목이 맞는지 먼저 확인해 주세요." : "이전 차수의 변경이 이미 반영된 값일 수 있습니다.",
    });
  }
}

import type { CaseMeta, DetectorKey, DocKind } from "../engine/types";
import { CATALOG } from "./catalog";
import { makeChange, makeLargeProject, makeProject, makeSettlement, rng, vary, type Project, type Rng, type Transform } from "./model";
import { BOQ_TEMPLATES, COMPARE_TEMPLATES, SETTLE_TEMPLATES, renderBoq, renderCompare, renderSettlement, type Anchors, type BoqTpl, type DocLine, type DocModel, type GtSheet, type Injections, type SettleSection, type SheetOut } from "./render";
import { writeXlsx } from "./xlsx-write";

/**
 * 합성 현장 한 건 = 계약 문서 + (변경 문서) + (정산서) + 계약 정보 + 정답.
 * 정답: 시트마다 열 역할 · 줄 종류 · 값, 문서 사이의 같은 항목 쌍(이름을 어떻게 바꿔 적었는지 포함), 주입한 오류의 위치.
 * 모든 이름 · 금액은 지어낸 것이다(실제 기업 자료 아님).
 */

export interface GtError {
  id: string;
  type: string;
  detector: DetectorKey;
  check: string;
  docId: string;
  anchor: { sheet: string; row: number };
  /** 이 오류 때문에 함께 생기는 것이 맞는 결과(같은 문서 안) — 정답도 오탐도 아닌 "따라온 결과"로 센다 */
  consequences: { detector: DetectorKey; check: string; docId?: string }[];
  note: string;
}
export interface GtLink { a: { docId: string; sheet: string; row: number }; b: { docId: string; sheet: string; row: number }; iid: string; transforms: Transform[] }
export interface SynthDoc { docId: string; kind: DocKind; round?: number; template: string; fileName: string; bytes: Uint8Array; sheets: SheetOut[]; gt: GtSheet[] }
export interface SynthCase { seed: number; split: "dev" | "eval"; title: string; docs: SynthDoc[]; meta: CaseMeta; errors: GtError[]; links: GtLink[] }

const sectionAlt = (r: Rng, key: string, name: string) => {
  const cs = CATALOG.find((c) => c.key === key);
  return cs && cs.alts.length && r.chance(0.3) ? r.pick(cs.alts) : name;
};

function canonicalModel(p: Project): DocModel {
  return {
    title: p.title, overheadRate: p.overheadRate, profitRate: p.profitRate,
    sections: p.sections.map((s) => ({ key: s.key, name: s.name, lines: s.items.map((it) => ({ iid: it.iid, cat: it.cat, sec: s.key, name: it.cat.name, spec: it.cat.spec, unit: it.cat.unit, transforms: [], qty: it.qty, price: it.price, parts: it.parts })) })),
  };
}

function wrongAmount(r: Rng, truth: number): number {
  const opts = [Math.floor(truth / 10), truth + 10000, truth + 100000, truth - 50000, Math.floor(truth * 0.8)];
  let w = r.pick(opts);
  if (w <= 0 || Math.abs(w - truth) <= Math.max(10, truth * 0.0001) + 2) w = truth + 10000;
  return w;
}

/**
 * 머리글 흔들기 — 실제 문서처럼 머리글 이름을 사전에 없는 말로 바꾸거나 군더더기 열(코드 · 산출근거)을 끼운다.
 * 한 줄 머리글 양식에만 적용하고, 적용한 시트는 양식 이름 뒤에 * 를 붙여 따로 센다.
 */
const LABEL_VARIANTS: Record<string, string[]> = {
  name: ["품명", "품 명", "명칭", "품목", "자재명", "내역", "적요", "공종 및 품명"],
  spec: ["규격", "규 격", "사양", "SIZE", "규격(mm)"],
  unit: ["단위", "단 위", "UNIT"],
  qty: ["수량", "수 량", "물량", "Q'TY", "산출수량"],
  price: ["단가", "단 가", "단가(원)", "U/P", "적용단가"],
  amount: ["금액", "금 액", "금액(원)", "공급가", "AMT", "공사비"],
  note: ["비고", "비 고", "REMARK", "특기사항"],
};
export function noisyTemplate(r: Rng, t: BoqTpl): BoqTpl {
  if (t.headerRows !== 1 || !r.chance(0.5)) return t;
  const labels = { ...t.labels };
  for (const k of Object.keys(LABEL_VARIANTS)) if (t.cols.includes(k as BoqTpl["cols"][number]) && r.chance(0.6)) (labels as Record<string, string>)[k] = r.pick(LABEL_VARIANTS[k]);
  let cols = [...t.cols];
  if (r.chance(0.3)) { cols = ["code", ...cols]; labels.code = r.pick(["코드", "공종코드", "CODE"]); }
  if (r.chance(0.25)) { const i = cols.indexOf("unit"); cols.splice(i + 1, 0, "basis"); labels.basis = r.pick(["산출근거", "산출식", "비고(산출)"]); }
  return { ...t, id: `${t.id}*`, labels, cols };
}

export interface CaseOptions { split: "dev" | "eval"; inject?: boolean; contractTemplate?: string; forceErrors?: string[]; noChange?: boolean; noSettlement?: boolean }

export function generateCase(seed: number, opts: CaseOptions): SynthCase {
  const r = rng(seed * 7919 + 13);
  const p = makeProject(seed);
  const pool = BOQ_TEMPLATES.filter((t) => opts.split === "eval" || !t.heldOut);
  const ctpl: BoqTpl = opts.contractTemplate ? BOQ_TEMPLATES.find((t) => t.id === opts.contractTemplate)! : noisyTemplate(r, r.pick(pool));
  const hasChange = !opts.noChange && r.chance(0.8);
  const changeShape: "compare" | "full" = r.chance(0.5) ? "compare" : "full";
  const hasSettle = !opts.noSettlement && r.chance(0.7);
  const ch = hasChange ? makeChange(r, p) : null;

  // 오류 계획
  const applicable: string[] = ["E1", "E4", "E6"];
  if (ctpl.split) applicable.push("E2");
  if (ctpl.subtotal || ctpl.sectionStyle === "rowAmount") applicable.push("E3");
  if (ctpl.summarySheet) applicable.push("E5");
  if (ctpl.coverSheet) applicable.push("E7");
  if (hasChange) applicable.push("E10");
  if (hasChange && changeShape === "compare") applicable.push("E8", "E9", "E11");
  if (hasChange && changeShape === "full") applicable.push("E1b");
  if (hasSettle) applicable.push("E1c");
  const inject = opts.inject ?? r.chance(0.75);
  const plan: string[] = opts.forceErrors ?? (inject ? r.shuffle(applicable).slice(0, r.int(1, 3)) : []);

  const errors: GtError[] = [];
  const pending: { type: string; docId: string; anchorKey: string; detector: DetectorKey; check: string; consequences: GtError["consequences"]; note: string }[] = [];
  const cm = canonicalModel(p);
  const allLines = cm.sections.flatMap((s) => s.lines);
  const cInj: Injections = { amount: new Map(), part: new Map(), subtotal: new Map(), summary: new Map(), hidden: new Set() };
  const compareExists = hasChange && changeShape === "compare";
  const prevCons = compareExists ? [{ detector: "D03" as DetectorKey, check: "change-prev", docId: "change1" }] : [];
  const trueAmt = (ln: DocLine, t: BoqTpl) => {
    if (!t.split) return Math.floor(ln.qty * ln.price);
    const pp = t.split === "mle" ? ln.parts : [ln.parts[0] + ln.parts[2], ln.parts[1]];
    return pp.reduce((s, x) => s + Math.floor(ln.qty * x), 0);
  };
  for (const e of plan) {
    if (e === "E1") {
      const ln = r.pick(allLines);
      if (cInj.amount!.has(ln.iid)) continue;
      cInj.amount!.set(ln.iid, wrongAmount(r, trueAmt(ln, ctpl)));
      pending.push({ type: e, docId: "contract", anchorKey: `item:${ln.iid}`, detector: "D01", check: "line", note: "계약 내역서 줄 금액 오기",
        consequences: [...prevCons, ...(compareExists ? [{ detector: "D03" as DetectorKey, check: "before-vs-contract", docId: "change1" }] : []), ...(ctpl.split ? [{ detector: "D01" as DetectorKey, check: "parts-sum" }] : [])] });
    } else if (e === "E2") {
      const ln = r.pick(allLines);
      const pp = ctpl.split === "mle" ? ln.parts : [ln.parts[0] + ln.parts[2], ln.parts[1]];
      const truth = Math.floor(ln.qty * pp[0]);
      if (truth < 100) continue;
      cInj.part!.set(ln.iid, wrongAmount(r, truth));
      pending.push({ type: e, docId: "contract", anchorKey: `item:${ln.iid}`, detector: "D01", check: "part:mat", note: "재료비 금액 오기",
        consequences: [{ detector: "D01", check: "line" }, ...prevCons, ...(compareExists ? [{ detector: "D03" as DetectorKey, check: "before-vs-contract", docId: "change1" }] : [])] });
    } else if (e === "E3") {
      const hiddenSecs = new Set(cm.sections.filter((x) => x.lines.some((ln) => cInj.hidden!.has(ln.iid))).map((x) => x.key));
      const free = cm.sections.filter((x) => !hiddenSecs.has(x.key));
      if (!free.length) continue;
      const s = r.pick(free);
      const sum = s.lines.reduce((a, ln) => a + trueAmt(ln, ctpl), 0);
      cInj.subtotal!.set(s.key, sum + r.pick([10000, -10000, 100000, -90000, 1000000]));
      const rowAmount = ctpl.sectionStyle === "rowAmount";
      pending.push({ type: e, docId: "contract", anchorKey: rowAmount ? `secrow:${s.key}` : `sub:${s.key}`, detector: "D02", check: rowAmount ? "section" : "subtotal", note: "소계 오기", consequences: [...prevCons] });
    } else if (e === "E4") {
      // 소계 오기(E3)와 같은 구간에 겹치면 숨긴 행을 판단할 수 없으므로 다른 구간에
      const free = cm.sections.filter((x) => !cInj.subtotal!.has(x.key));
      if (!free.length) continue;
      const s = r.pick(free);
      const ln = r.pick(s.lines);
      cInj.hidden!.add(ln.iid);
      const key = ctpl.subtotal ? `sub:${s.key}` : ctpl.sectionStyle === "rowAmount" ? `secrow:${s.key}` : "detailtotal";
      pending.push({ type: e, docId: "contract", anchorKey: key, detector: "D02", check: "hidden-included", note: "숨긴 행이 소계에 포함", consequences: [] });
    } else if (e === "E5") {
      const s = r.pick(cm.sections);
      cInj.summary!.set(s.key, -1); // 값은 그린 뒤에 정한다(구간 금액 + 차이)
      pending.push({ type: e, docId: "contract", anchorKey: `sumrow:${s.key}`, detector: "D02", check: "summary-section", note: "집계표 구간 금액 오기", consequences: [...prevCons] });
    } else if (e === "E6") {
      pending.push({ type: e, docId: "contract", anchorKey: "pretax", detector: "D02", check: "contract-amount", note: "계약금액과 문서 합계 불일치", consequences: [...prevCons] });
    } else if (e === "E7") {
      pending.push({ type: e, docId: "contract", anchorKey: "cover", detector: "D02", check: "cover", note: "표지 금액 오기", consequences: [] });
    }
  }
  // E5: 요약 금액 = 구간 금액 + 차이 — 먼저 한 번 그려 구간 금액을 얻는다
  if ([...cInj.summary!.values()].includes(-1)) {
    const probe = renderBoq(cm, ctpl, { ...cInj, summary: new Map() });
    for (const [k] of cInj.summary!) cInj.summary!.set(k, (probe.sectionAmounts.get(k) ?? 0) + r.pick([100000, -100000, 1000000, 50000]));
  }
  if (plan.includes("E7")) {
    const probe = renderBoq(cm, ctpl, cInj);
    cInj.cover = probe.preTax + r.pick([1000000, -1000000, 100000, 9000000]);
  }
  const contract = renderBoq(cm, ctpl, cInj);
  const contractAmount = plan.includes("E6") ? contract.preTax + r.pick([-500000, -1200000, 300000, -37000]) : contract.preTax;
  const meta: CaseMeta = { contractAmount, vat: "excluded", changes: [] };
  const docs: SynthDoc[] = [{ docId: "contract", kind: "contract", template: ctpl.id, fileName: `synthetic-${seed}-contract.xlsx`, bytes: writeXlsx(contract.sheets), sheets: contract.sheets, gt: contract.gt }];
  const anchorsByDoc = new Map<string, Anchors>([["contract", contract.anchors]]);
  const namesByDoc = new Map<string, Map<string, Transform[]>>();

  // 변경 문서
  if (ch) {
    const names = new Map<string, Transform[]>();
    namesByDoc.set("change1", names);
    const named = (it: { iid: string; cat: DocLine["cat"] }) => { const v = vary(r, it.cat, 1); names.set(it.iid, v.transforms); return v; };
    const changeInj: Injections = { amount: new Map(), delta: new Map(), deltaQty: new Map() };
    const bump = new Map<string, number>();
    if (changeShape === "compare") {
      const model: DocModel = { title: p.title, overheadRate: p.overheadRate, profitRate: p.profitRate, sections: ch.sections.map((s) => ({ key: s.key, name: sectionAlt(r, s.key, s.name), lines: s.lines.map((l) => { const v = named(l.inst); return { iid: l.inst.iid, cat: l.inst.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: l.after, price: l.inst.price, parts: l.inst.parts, before: l.status === "added" ? undefined : l.before }; }) })) };
      const withBefore = model.sections.flatMap((s) => s.lines).filter((l) => l.before !== undefined && l.before > 0);
      for (const e of plan) {
        if (!withBefore.length) break;
        if (e === "E8") {
          const ln = r.pick(withBefore);
          const da = Math.floor(ln.qty * ln.price) - Math.floor((ln.before ?? 0) * ln.price);
          changeInj.delta!.set(ln.iid, da + r.pick([10000, -50000, 120000]));
          pending.push({ type: e, docId: "change1", anchorKey: `item:${ln.iid}`, detector: "D03", check: "delta-amount", note: "증감 금액 오기", consequences: [{ detector: "D03", check: "delta-amount" }, { detector: "D02", check: "subtotal" }] });
        } else if (e === "E9") {
          const ln = r.pick(withBefore);
          changeInj.deltaQty!.set(ln.iid, Math.round((ln.qty - (ln.before ?? 0)) * 1000) / 1000 + r.pick([1, 5, -2]));
          pending.push({ type: e, docId: "change1", anchorKey: `item:${ln.iid}`, detector: "D03", check: "delta-qty", note: "증감 수량 오기", consequences: [] });
        } else if (e === "E11") {
          const ln = r.pick(withBefore);
          if (bump.has(ln.iid)) continue;
          const b = Math.max(1, Math.round((ln.before ?? 0) * 0.1));
          bump.set(ln.iid, b);
          ln.before = (ln.before ?? 0) + b;
          pending.push({ type: e, docId: "change1", anchorKey: `item:${ln.iid}`, detector: "D03", check: "before-vs-contract", note: "변경 전 수량이 계약과 다름(옛 판 사용)", consequences: [{ detector: "D03", check: "change-prev" }] });
        }
      }
      const tpl = r.pick(COMPARE_TEMPLATES);
      const res = renderCompare(model, tpl, changeInj, ctpl.summarySheet ? p : { overheadRate: 0, profitRate: 0, simple: true });
      let newAmount = res.afterTotal;
      if (plan.includes("E10")) { newAmount += r.pick([500000, -300000, 2000000]); pending.push({ type: "E10", docId: "change1", anchorKey: "cmptotal", detector: "D03", check: "change-amount", note: "변경 계약금액과 문서 합계 불일치", consequences: [] }); }
      meta.changes!.push({ round: 1, prevAmount: contractAmount, newAmount });
      docs.push({ docId: "change1", kind: "change", round: 1, template: tpl.id, fileName: `synthetic-${seed}-change1.xlsx`, bytes: writeXlsx([res.sheet]), sheets: [res.sheet], gt: [res.gt] });
      anchorsByDoc.set("change1", res.anchors);
    } else {
      const model: DocModel = { title: p.title, overheadRate: p.overheadRate, profitRate: p.profitRate, sections: ch.sections.map((s) => ({ key: s.key, name: sectionAlt(r, s.key, s.name), lines: s.lines.filter((l) => l.after > 0).map((l) => { const v = named(l.inst); return { iid: l.inst.iid, cat: l.inst.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: l.after, price: l.inst.price, parts: l.inst.parts }; }) })).filter((s) => s.lines.length) };
      const tpl = r.chance(0.5) ? ctpl : noisyTemplate(r, r.pick(pool));
      if (plan.includes("E1b")) {
        const ln = r.pick(model.sections.flatMap((s) => s.lines));
        changeInj.amount!.set(ln.iid, wrongAmount(r, trueAmt(ln, tpl)));
        pending.push({ type: "E1b", docId: "change1", anchorKey: `item:${ln.iid}`, detector: "D01", check: "line", note: "변경 내역서 줄 금액 오기", consequences: tpl.split ? [{ detector: "D01", check: "parts-sum" }] : [] });
      }
      const res = renderBoq(model, tpl, changeInj, { sheetPrefix: "변경" });
      let newAmount = res.preTax;
      if (plan.includes("E10")) { newAmount += r.pick([500000, -300000, 2000000]); pending.push({ type: "E10", docId: "change1", anchorKey: "pretax", detector: "D03", check: "change-amount", note: "변경 계약금액과 문서 합계 불일치", consequences: [] }); }
      meta.changes!.push({ round: 1, prevAmount: contractAmount, newAmount });
      docs.push({ docId: "change1", kind: "change", round: 1, template: tpl.id, fileName: `synthetic-${seed}-change1.xlsx`, bytes: writeXlsx(res.sheets), sheets: res.sheets, gt: res.gt });
      anchorsByDoc.set("change1", res.anchors);
    }
  }
  // 정산서
  if (hasSettle) {
    const st = makeSettlement(r, ch, p);
    const names = new Map<string, Transform[]>();
    namesByDoc.set("settlement", names);
    const secs: SettleSection[] = st.sections.map((s) => ({ key: s.key, name: sectionAlt(r, s.key, s.name), lines: s.lines.map((l) => { const v = vary(r, l.inst.cat, 1); names.set(l.inst.iid, v.transforms); return { iid: l.inst.iid, cat: l.inst.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: l.settledQty, price: l.inst.price, parts: l.inst.parts, contractQty: l.contractQty }; }) })).filter((s) => s.lines.length);
    const sInj: Injections = { amount: new Map() };
    if (plan.includes("E1c")) {
      const ln = r.pick(secs.flatMap((s) => s.lines));
      sInj.amount!.set(ln.iid, wrongAmount(r, Math.floor(ln.qty * ln.price)));
      pending.push({ type: "E1c", docId: "settlement", anchorKey: `item:${ln.iid}`, detector: "D01", check: "line", note: "정산서 줄 금액 오기", consequences: [] });
    }
    const tpl = r.pick(SETTLE_TEMPLATES);
    const res = renderSettlement(secs, tpl, sInj);
    docs.push({ docId: "settlement", kind: "settlement", template: tpl.id, fileName: `synthetic-${seed}-settlement.xlsx`, bytes: writeXlsx([res.sheet]), sheets: [res.sheet], gt: [res.gt] });
    anchorsByDoc.set("settlement", res.anchors);
  }
  pending.forEach((pe, i) => {
    const a = anchorsByDoc.get(pe.docId)?.get(pe.anchorKey);
    if (!a) return;
    errors.push({ id: `${seed}-${i}`, type: pe.type, detector: pe.detector, check: pe.check, docId: pe.docId, anchor: a, consequences: pe.consequences, note: pe.note });
  });
  // 같은 항목 쌍
  const links: GtLink[] = [];
  for (const d of docs) {
    if (d.docId === "contract") continue;
    const an = anchorsByDoc.get(d.docId)!;
    for (const [k, b] of an) {
      if (!k.startsWith("item:")) continue;
      const a = contract.anchors.get(k);
      if (!a) continue;
      const iid = k.slice(5);
      links.push({ a: { docId: "contract", ...a }, b: { docId: d.docId, ...b }, iid, transforms: namesByDoc.get(d.docId)?.get(iid) ?? [] });
    }
  }
  return { seed, split: opts.split, title: p.title, docs, meta, errors, links };
}

/** 처리 시간 시험용 큰 현장(문서 5개) */
export function generateLargeCase(seed: number, lines: number): SynthCase {
  const r = rng(seed);
  const p = makeLargeProject(seed, lines);
  const cm = canonicalModel(p);
  const tpl = BOQ_TEMPLATES[0];
  const contract = renderBoq(cm, tpl);
  const ch = makeChange(r, p);
  const vary1 = (l: { inst: { iid: string; cat: DocLine["cat"]; price: number; parts: [number, number, number] } }) => vary(r, l.inst.cat, 1);
  const full: DocModel = { ...cm, sections: ch.sections.map((s) => ({ key: s.key, name: s.name, lines: s.lines.filter((l) => l.after > 0).map((l) => { const v = vary1(l); return { iid: l.inst.iid, cat: l.inst.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: l.after, price: l.inst.price, parts: l.inst.parts }; }) })) };
  const cmpModel: DocModel = { ...cm, sections: ch.sections.map((s) => ({ key: s.key, name: s.name, lines: s.lines.map((l) => { const v = vary1(l); return { iid: l.inst.iid, cat: l.inst.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: l.after, price: l.inst.price, parts: l.inst.parts, before: l.status === "added" ? undefined : l.before }; }) })) };
  const st = makeSettlement(r, ch, p);
  const secs: SettleSection[] = st.sections.map((s) => ({ key: s.key, name: s.name, lines: s.lines.map((l) => { const v = vary(r, l.inst.cat, 1); return { iid: l.inst.iid, cat: l.inst.cat, sec: s.key, name: v.name, spec: v.spec, unit: v.unit, transforms: v.transforms, qty: l.settledQty, price: l.inst.price, parts: l.inst.parts, contractQty: l.contractQty }; }) }));
  const fullR = renderBoq(full, tpl, {}, { sheetPrefix: "변경" });
  const cmpR = renderCompare(cmpModel, COMPARE_TEMPLATES[0], {}, p);
  const s1 = renderSettlement(secs, SETTLE_TEMPLATES[0], {});
  const s2 = renderSettlement(secs, SETTLE_TEMPLATES[1], {});
  const docs: SynthDoc[] = [
    { docId: "contract", kind: "contract", template: tpl.id, fileName: "synthetic-large-contract.xlsx", bytes: writeXlsx(contract.sheets), sheets: contract.sheets, gt: contract.gt },
    { docId: "change1", kind: "change", round: 1, template: tpl.id, fileName: "synthetic-large-change1.xlsx", bytes: writeXlsx(fullR.sheets), sheets: fullR.sheets, gt: fullR.gt },
    { docId: "change2", kind: "change", round: 2, template: "C1", fileName: "synthetic-large-change2.xlsx", bytes: writeXlsx([cmpR.sheet]), sheets: [cmpR.sheet], gt: [cmpR.gt] },
    { docId: "settlement", kind: "settlement", template: "S1", fileName: "synthetic-large-settlement.xlsx", bytes: writeXlsx([s1.sheet]), sheets: [s1.sheet], gt: [s1.gt] },
    { docId: "settlement2", kind: "settlement", template: "S2", fileName: "synthetic-large-settlement2.xlsx", bytes: writeXlsx([s2.sheet]), sheets: [s2.sheet], gt: [s2.gt] },
  ];
  return { seed, split: "dev", title: p.title, docs, meta: { contractAmount: contract.preTax, vat: "excluded", changes: [{ round: 1, prevAmount: contract.preTax, newAmount: fullR.preTax }] }, errors: [], links: [] };
}

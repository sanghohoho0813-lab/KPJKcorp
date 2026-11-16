import type { GroupKey, LeafRole, LineKind, Merge, SheetKind } from "../engine/types";
import type { CatItem } from "./catalog";
import type { Transform } from "./model";

/**
 * 합성 문서 그리기 — 양식(템플릿)마다 머리글 · 열 순서 · 병합 · 구간 표기 · 합계 줄이 다르다.
 * 그리면서 정답(열 역할 · 줄 종류 · 값 · 오류 위치)을 함께 남긴다.
 * 값은 "엑셀 수식이 다시 계산된 상태"를 흉내 낸다: 덮어쓴(주입한) 칸만 틀리고, 그 칸을 더하는 합계는 틀린 값으로 다시 계산된다.
 */

export type Cell = string | number | null;
export interface SheetOut { name: string; hidden?: boolean; rows: Cell[][]; merges: Merge[]; hiddenRows: number[]; widths: number[] }
export interface GtColumn { col: number; role: LeafRole; group?: GroupKey }
export type GtKind = LineKind | "header" | "blank" | "title" | "repeat" | "info";
export interface GtRow { row: number; kind: GtKind; iid?: string; name?: string; spec?: string; unit?: string; qty?: number; unitPrice?: number; amount?: number; transforms?: Transform[]; sec?: string }
export interface GtSheet { name: string; kind: SheetKind; headerRows: number[]; columns: GtColumn[]; rows: GtRow[]; template: string }
export type Anchors = Map<string, { sheet: string; row: number }>;

export interface DocLine { iid: string; cat: CatItem; sec: string; name: string; spec: string; unit: string; transforms: Transform[]; qty: number; price: number; parts: [number, number, number]; before?: number }
export interface DocSection { key: string; name: string; lines: DocLine[] }
export interface DocModel { title: string; sections: DocSection[]; overheadRate: number; profitRate: number }

export interface Injections {
  amount?: Map<string, number>;       // 항목 금액 덮어쓰기(분할 양식이면 합계 금액)
  part?: Map<string, number>;         // 분할 양식: 재료비 금액 덮어쓰기
  subtotal?: Map<string, number>;     // 구간 소계 덮어쓰기
  summary?: Map<string, number>;      // 요약 시트 구간 금액 덮어쓰기
  hidden?: Set<string>;               // 숨길 항목
  cover?: number;                     // 표지 금액 덮어쓰기
  delta?: Map<string, number>;        // 비교 양식: 증감 금액 덮어쓰기
  deltaQty?: Map<string, number>;     // 비교 양식: 증감 수량 덮어쓰기
}

export interface BoqTpl {
  id: string;
  heldOut: boolean;
  split: false | "mle" | "ml";
  headerRows: 1 | 2;
  cols: ("no" | "name" | "spec" | "unit" | "qty" | "price" | "amount" | "note" | "code" | "basis")[];
  labels: Partial<Record<"no" | "name" | "spec" | "unit" | "qty" | "price" | "amount" | "note" | "gMat" | "gLab" | "gExp" | "gSum" | "gNum" | "sub" | "code" | "basis", string>>;
  blankNumericLabels?: boolean;
  sectionStyle: "row" | "rowAmount";
  subtotal: boolean;
  numbering: "dot" | "roman" | "hangul" | "nested" | "none";
  itemNo: "seq" | "dash" | "none";
  repeatHeaderEvery: number;
  blankBetween: boolean;
  notes: boolean;
  numbersAsText: boolean;
  infoBlock: boolean;
  title: string;
  subtotalLabel: string;
  totalLabel: string;
  detailSheet: string;
  summarySheet: string | null;
  coverSheet: string | null;
}

const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"];
const HANGUL = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타"];

export const BOQ_TEMPLATES: BoqTpl[] = [
  { id: "V1", heldOut: false, split: false, headerRows: 1, cols: ["no", "name", "spec", "unit", "qty", "price", "amount", "note"],
    labels: { no: "번호", name: "품명", spec: "규격", unit: "단위", qty: "수량", price: "단가", amount: "금액", note: "비고" },
    sectionStyle: "row", subtotal: true, numbering: "dot", itemNo: "none", repeatHeaderEvery: 0, blankBetween: false, notes: false, numbersAsText: false, infoBlock: false,
    title: "내 역 서", subtotalLabel: "소 계", totalLabel: "총 계", detailSheet: "내역서", summarySheet: "집계표", coverSheet: "표지" },
  { id: "V2", heldOut: false, split: "mle", headerRows: 2, cols: ["name", "spec", "unit", "qty", "note"],
    labels: { name: "품 명", spec: "규 격", unit: "단 위", qty: "수 량", gMat: "재료비", gLab: "노무비", gExp: "경 비", gSum: "합 계", note: "비 고", price: "단 가", amount: "금 액" },
    sectionStyle: "row", subtotal: true, numbering: "dot", itemNo: "none", repeatHeaderEvery: 0, blankBetween: false, notes: false, numbersAsText: false, infoBlock: false,
    title: "공 사 내 역 서", subtotalLabel: "[ 소 계 ]", totalLabel: "합 계", detailSheet: "을지", summarySheet: "공종별집계표", coverSheet: "갑지" },
  { id: "V3", heldOut: false, split: false, headerRows: 1, cols: ["name", "unit", "qty", "spec", "amount", "price", "note"],
    labels: { name: "명 칭", unit: "단위", qty: "수 량", spec: "규 격", amount: "금 액", price: "단 가", note: "비고" },
    sectionStyle: "row", subtotal: true, numbering: "none", itemNo: "none", repeatHeaderEvery: 0, blankBetween: true, notes: false, numbersAsText: false, infoBlock: false,
    title: "세 부 내 역", subtotalLabel: "소계", totalLabel: "합계", detailSheet: "내역", summarySheet: "집계", coverSheet: null },
  { id: "V4", heldOut: false, split: false, headerRows: 1, cols: ["no", "name", "spec", "unit", "qty", "price", "amount", "note"],
    labels: { no: "NO", name: "ITEM", spec: "SIZE", unit: "UNIT", qty: "Q'TY", price: "U-PRICE", amount: "AMOUNT", note: "REMARK" },
    sectionStyle: "row", subtotal: true, numbering: "roman", itemNo: "seq", repeatHeaderEvery: 0, blankBetween: false, notes: false, numbersAsText: false, infoBlock: false,
    title: "BILL OF QUANTITIES", subtotalLabel: "소 계", totalLabel: "총 계", detailSheet: "BOQ", summarySheet: "SUMMARY", coverSheet: null },
  { id: "V5", heldOut: false, split: false, headerRows: 1, cols: ["no", "name", "spec", "unit", "qty", "price", "amount", "note"],
    labels: { no: "번호", name: "공종 및 품명", spec: "규격", unit: "단위", qty: "수량", price: "단가", amount: "금액", note: "비고" },
    sectionStyle: "rowAmount", subtotal: false, numbering: "dot", itemNo: "none", repeatHeaderEvery: 0, blankBetween: false, notes: false, numbersAsText: false, infoBlock: false,
    title: "견 적 내 역", subtotalLabel: "소 계", totalLabel: "총 계", detailSheet: "내역서", summarySheet: "원가계산서", coverSheet: null },
  { id: "V6", heldOut: false, split: false, headerRows: 1, cols: ["no", "name", "spec", "unit", "qty", "price", "amount", "note"],
    labels: { no: "순번", name: "품 명", spec: "규 격", unit: "단 위", qty: "수 량", price: "단 가", amount: "금 액", note: "비 고" },
    sectionStyle: "row", subtotal: true, numbering: "none", itemNo: "none", repeatHeaderEvery: 22, blankBetween: true, notes: true, numbersAsText: true, infoBlock: true,
    title: "세 부 내 역 서", subtotalLabel: "소   계", totalLabel: "합   계", detailSheet: "세부내역", summarySheet: "총괄표", coverSheet: "견적서" },
  { id: "V7", heldOut: true, split: "ml", headerRows: 2, cols: ["no", "name", "spec", "unit", "qty", "note"],
    labels: { no: "번호", name: "품명", spec: "규격", unit: "단위", qty: "수량", gMat: "자재비", gLab: "인건비", gSum: "계", note: "비고", price: "단가", amount: "금액" },
    sectionStyle: "row", subtotal: true, numbering: "nested", itemNo: "dash", repeatHeaderEvery: 0, blankBetween: false, notes: false, numbersAsText: false, infoBlock: false,
    title: "내 역 서", subtotalLabel: "소 계", totalLabel: "총 계", detailSheet: "내역서(을)", summarySheet: "집계표", coverSheet: "갑지" },
  { id: "V8", heldOut: true, split: false, headerRows: 2, cols: ["no", "name", "spec", "unit", "qty", "price", "amount", "note"],
    labels: { no: "번호", name: "내 용", spec: "규 격", unit: "단 위", gNum: "산 출 내 역", note: "비 고" }, blankNumericLabels: true,
    sectionStyle: "row", subtotal: true, numbering: "hangul", itemNo: "none", repeatHeaderEvery: 0, blankBetween: false, notes: false, numbersAsText: false, infoBlock: true,
    title: "공 사 비 내 역", subtotalLabel: "소     계", totalLabel: "총 계", detailSheet: "Sheet1", summarySheet: null, coverSheet: null },
];

const fmtNum = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

class SheetBuilder {
  rows: Cell[][] = [];
  merges: Merge[] = [];
  hiddenRows: number[] = [];
  gt: GtRow[] = [];
  constructor(public name: string, public width: number, public asText = false) {}
  get r() { return this.rows.length; }
  add(cells: Cell[], gt: Omit<GtRow, "row">, hidden = false): number {
    const row = this.rows.length;
    this.rows.push(cells.map((c) => (typeof c === "number" && this.asText ? fmtNum(c) : c)));
    this.gt.push({ ...gt, row });
    if (hidden) this.hiddenRows.push(row);
    return row;
  }
  merge(r1: number, c1: number, r2: number, c2: number) { if (r2 > r1 || c2 > c1) this.merges.push({ r1, c1, r2, c2 }); }
  out(hidden = false): SheetOut { return { name: this.name, hidden, rows: this.rows, merges: this.merges, hiddenRows: this.hiddenRows, widths: Array.from({ length: this.width }, (_, i) => (i === 1 ? 28 : 12)) }; }
}

interface Layout { keys: string[]; width: number; columns: GtColumn[]; at: (k: string) => number }

function boqLayout(t: BoqTpl): Layout {
  const keys: string[] = [];
  for (const k of t.cols) {
    if (k === "note" && t.split) {
      keys.push("mat.p", "mat.a", "lab.p", "lab.a");
      if (t.split === "mle") keys.push("exp.p", "exp.a");
      keys.push("sum.p", "sum.a");
    }
    keys.push(k);
  }
  const columns: GtColumn[] = [];
  keys.forEach((k, col) => {
    if (k === "code" || k === "basis") return;
    const map: Record<string, [LeafRole, GroupKey?]> = {
      no: ["no"], name: ["name"], spec: ["spec"], unit: ["unit"], qty: ["qty"], price: ["unitPrice"], amount: ["amount"], note: ["note"],
      "mat.p": ["unitPrice", "mat"], "mat.a": ["amount", "mat"], "lab.p": ["unitPrice", "lab"], "lab.a": ["amount", "lab"], "exp.p": ["unitPrice", "exp"], "exp.a": ["amount", "exp"], "sum.p": ["unitPrice", "sum"], "sum.a": ["amount", "sum"],
    };
    const [role, group] = map[k];
    columns.push({ col, role, group });
  });
  return { keys, width: keys.length, columns, at: (k) => keys.indexOf(k) };
}

function headerRowsBoq(b: SheetBuilder, t: BoqTpl, L: Layout): number[] {
  const lb = t.labels;
  const leafLabel = (k: string) => (k === "price" ? lb.price : k === "amount" ? lb.amount : (lb as Record<string, string | undefined>)[k]) ?? "";
  if (t.headerRows === 1) {
    return [b.add(L.keys.map(leafLabel), { kind: "header" })];
  }
  const top: Cell[] = new Array(L.width).fill(null);
  const bottom: Cell[] = new Array(L.width).fill(null);
  const r0 = b.r;
  const groups: Record<string, string | undefined> = { mat: lb.gMat, lab: lb.gLab, exp: lb.gExp, sum: lb.gSum };
  const spans: [number, number][] = [];
  L.keys.forEach((k, c) => {
    if (k.includes(".")) {
      const [g, leaf] = k.split(".");
      if (leaf === "p") { top[c] = groups[g] ?? ""; spans.push([c, c + 1]); }
      bottom[c] = leaf === "p" ? lb.price ?? "단가" : lb.amount ?? "금액";
    } else if (t.blankNumericLabels && (k === "qty" || k === "price" || k === "amount")) {
      if (k === "qty") { top[c] = lb.gNum ?? ""; spans.push([c, c + 2]); }
    } else {
      top[c] = leafLabel(k);
    }
  });
  const a = b.add(top, { kind: "header" });
  const z = b.add(bottom, { kind: "header" });
  L.keys.forEach((k, c) => { if (!k.includes(".") && !(t.blankNumericLabels && (k === "qty" || k === "price" || k === "amount"))) b.merge(r0, c, r0 + 1, c); });
  for (const [c1, c2] of spans) b.merge(r0, c1, r0, c2);
  return [a, z];
}

export interface BoqResult { sheets: SheetOut[]; gt: GtSheet[]; anchors: Anchors; preTax: number; detailTotal: number; sectionAmounts: Map<string, number> }

/** 내역 시트 + 요약(집계) 시트 + 표지 */
export function renderBoq(m: DocModel, t: BoqTpl, inj: Injections = {}, opts: { sheetPrefix?: string } = {}): BoqResult {
  const L = boqLayout(t);
  const prefix = opts.sheetPrefix ?? "";
  const b = new SheetBuilder(prefix + t.detailSheet, L.width, t.numbersAsText);
  const anchors: Anchors = new Map();
  const at = (k: string) => L.at(k);
  const blank = () => new Array<Cell>(L.width).fill(null);
  if (t.infoBlock) {
    b.add([`공 사 명 : ${m.title}`, ...new Array(L.width - 1).fill(null)], { kind: "info" });
    b.add(["현    장 : [가상] 서울시 ○○구", ...new Array(L.width - 1).fill(null)], { kind: "info" });
    b.add([], { kind: "blank" });
  }
  const tr = b.add([t.title, ...new Array(L.width - 1).fill(null)], { kind: "title" });
  b.merge(tr, 0, tr, L.width - 1);
  b.add([], { kind: "blank" });
  const headerRows = headerRowsBoq(b, t, L);
  const headerCopy = headerRows.map((r) => [...b.rows[r]]);
  let sinceHeader = 0;
  const maybeRepeat = () => {
    if (!t.repeatHeaderEvery || sinceHeader < t.repeatHeaderEvery) return;
    for (const h of headerCopy) b.add([...h], { kind: "repeat" });
    sinceHeader = 0;
  };
  const nested = t.numbering === "nested";
  const groupsOf = (secs: DocSection[]): { name: string; secs: DocSection[] }[] => {
    if (!nested) return [{ name: "", secs }];
    const mechE = secs.filter((s) => s.key.startsWith("elec") || s.key.startsWith("mech"));
    const arch = secs.filter((s) => !mechE.includes(s));
    return [{ name: "건축공사", secs: arch }, { name: "기계 · 전기공사", secs: mechE }].filter((g) => g.secs.length);
  };
  const sectionAmounts = new Map<string, number>();
  const subtotalsTop: number[] = [];
  let grandItems = 0;
  let secIndex = 0;
  const lineValues = (ln: DocLine) => {
    const q = ln.qty;
    if (!t.split) {
      const amt = inj.amount?.get(ln.iid) ?? Math.floor(q * ln.price);
      return { price: ln.price, amount: amt, parts: undefined as undefined | { p: number[]; a: number[] } };
    }
    const pp = t.split === "mle" ? [...ln.parts] : [ln.parts[0] + ln.parts[2], ln.parts[1]];
    const pa = pp.map((p) => Math.floor(q * p));
    const pOverride = inj.part?.get(ln.iid);
    if (pOverride !== undefined) pa[0] = pOverride;
    const sumP = pp.reduce((s, x) => s + x, 0);
    const sumA = inj.amount?.get(ln.iid) ?? pa.reduce((s, x) => s + x, 0);
    return { price: sumP, amount: sumA, parts: { p: pp, a: pa } };
  };
  groupsOf(m.sections).forEach((grp, gi) => {
    let grpSum = 0;
    if (nested) {
      const row = blank();
      row[at("no") >= 0 ? at("no") : at("name")] = `${ROMAN[gi]}.`;
      row[at("name")] = grp.name;
      b.add(row, { kind: "section", name: grp.name });
    }
    grp.secs.forEach((s) => {
      if (t.blankBetween && secIndex > 0) b.add([], { kind: "blank" });
      const numbering = t.numbering === "dot" || nested ? `${secIndex + 1}.` : t.numbering === "roman" ? `${ROMAN[secIndex]}.` : t.numbering === "hangul" ? `${HANGUL[secIndex]}.` : "";
      secIndex++;
      const vals = s.lines.map((ln) => ({ ln, v: lineValues(ln) }));
      const secSum = vals.reduce((acc, x) => acc + x.v.amount, 0);
      const secRow = blank();
      if (at("no") >= 0 && numbering) { secRow[at("no")] = numbering; secRow[at("name")] = s.name; }
      else secRow[at("name")] = numbering ? `${numbering} ${s.name}` : s.name;
      const secAmount = inj.subtotal?.get(s.key) ?? secSum;
      const amountKey = t.split ? "sum.a" : "amount";
      if (t.sectionStyle === "rowAmount") secRow[at(amountKey)] = secAmount;
      const sr = b.add(secRow, { kind: "section", name: s.name, sec: s.key, amount: t.sectionStyle === "rowAmount" ? secAmount : undefined });
      anchors.set(`secrow:${s.key}`, { sheet: b.name, row: sr });
      vals.forEach(({ ln, v }, ii) => {
        maybeRepeat();
        const row = blank();
        if (at("no") >= 0) row[at("no")] = t.itemNo === "seq" ? String(ii + 1) : t.itemNo === "dash" ? `${secIndex}-${ii + 1}` : null;
        if (at("code") >= 0) row[at("code")] = `${s.key.slice(0, 2).toUpperCase()}-${String(ii + 1).padStart(3, "0")}`;
        if (at("basis") >= 0) row[at("basis")] = ln.cat.unit === "㎡" ? `${(ii % 5) + 2}.${ii % 10}×${(ii % 3) + 3}.${(ii * 7) % 10}` : ln.cat.unit === "식" ? "1식" : null;
        row[at("name")] = ln.name;
        if (at("spec") >= 0) row[at("spec")] = ln.spec || null;
        row[at("unit")] = ln.unit;
        row[at("qty")] = ln.qty;
        if (!t.split) { row[at("price")] = v.price; row[at("amount")] = v.amount; }
        else if (v.parts) {
          const gs = t.split === "mle" ? ["mat", "lab", "exp"] : ["mat", "lab"];
          gs.forEach((g, gi2) => { row[at(`${g}.p`)] = v.parts!.p[gi2]; row[at(`${g}.a`)] = v.parts!.a[gi2]; });
          row[at("sum.p")] = v.price; row[at("sum.a")] = v.amount;
        }
        if (t.notes && ln.cat.unit === "식" && at("note") >= 0) row[at("note")] = "실비 정산";
        const hidden = !!inj.hidden?.has(ln.iid);
        const rr = b.add(row, { kind: "item", iid: ln.iid, name: ln.name, spec: ln.spec, unit: ln.unit, qty: ln.qty, unitPrice: v.price, amount: v.amount, transforms: ln.transforms, sec: s.key }, hidden);
        anchors.set(`item:${ln.iid}`, { sheet: b.name, row: rr });
        sinceHeader++;
      });
      grandItems += secSum;
      sectionAmounts.set(s.key, secAmount);
      if (t.subtotal) {
        const row = blank();
        row[at("name")] = t.subtotalLabel;
        row[at(amountKey)] = secAmount;
        if (t.split) {
          const gs = t.split === "mle" ? ["mat", "lab", "exp"] : ["mat", "lab"];
          gs.forEach((g, gi2) => { row[at(`${g}.a`)] = vals.reduce((acc, x) => acc + (x.v.parts?.a[gi2] ?? 0), 0); });
        }
        const r2 = b.add(row, { kind: "subtotal", name: t.subtotalLabel, amount: secAmount, sec: s.key });
        anchors.set(`sub:${s.key}`, { sheet: b.name, row: r2 });
      }
      grpSum += secAmount;
      if (t.notes && secIndex === 2) b.add([null, "※ 폐기물 처리비는 실제 반출량으로 정산함", ...new Array(Math.max(0, L.width - 2)).fill(null)], { kind: "note" });
    });
    if (nested) {
      const row = blank();
      row[at("name")] = `${grp.name} 소계`;
      row[at(t.split ? "sum.a" : "amount")] = grpSum;
      b.add(row, { kind: "subtotal", name: `${grp.name} 소계`, amount: grpSum });
    }
    subtotalsTop.push(grpSum);
  });
  const detailTotal = subtotalsTop.reduce((a, x) => a + x, 0);
  const totRow = blank();
  totRow[at("name")] = t.totalLabel;
  totRow[at(t.split ? "sum.a" : "amount")] = detailTotal;
  const totR = b.add(totRow, { kind: "total", name: t.totalLabel, amount: detailTotal });
  anchors.set("detailtotal", { sheet: b.name, row: totR });
  void grandItems;
  const detailGt: GtSheet = { name: b.name, kind: "detail", headerRows, columns: L.columns, rows: b.gt, template: t.id };
  const sheets: SheetOut[] = [];
  const gts: GtSheet[] = [];
  let preTax = detailTotal;

  if (t.summarySheet) {
    const S = new SheetBuilder(prefix + t.summarySheet, 4, t.numbersAsText);
    const sr = S.add(["공 종 별 집 계 표", null, null, null], { kind: "title" });
    S.merge(sr, 0, sr, 3);
    S.add([], { kind: "blank" });
    const sh = S.add(["번호", t.id === "V4" ? "DESCRIPTION" : "공 종", t.id === "V4" ? "AMOUNT" : "금 액", "비 고"], { kind: "header" });
    let direct = 0;
    m.sections.forEach((s, i) => {
      const v = inj.summary?.get(s.key) ?? sectionAmounts.get(s.key) ?? 0;
      direct += v;
      const r = S.add([String(i + 1), s.name, v, null], { kind: "item", name: s.name, amount: v, sec: s.key });
      anchors.set(`sumrow:${s.key}`, { sheet: S.name, row: r });
    });
    S.add([null, "직접공사비 계", direct, null], { kind: "total", name: "직접공사비 계", amount: direct });
    const oh = Math.floor(direct * m.overheadRate);
    const pf = Math.floor(direct * m.profitRate);
    S.add([null, `공과잡비 (${Math.round(m.overheadRate * 100)}%)`, oh, null], { kind: "item", name: `공과잡비 (${Math.round(m.overheadRate * 100)}%)`, amount: oh });
    S.add([null, `기업이윤 (${Math.round(m.profitRate * 100)}%)`, pf, null], { kind: "item", name: `기업이윤 (${Math.round(m.profitRate * 100)}%)`, amount: pf });
    const x = direct + oh + pf;
    const adj = -(x % 1000);
    if (adj !== 0) S.add([null, "단수정리", adj, null], { kind: "adjust", name: "단수정리", amount: adj });
    preTax = x + adj;
    const pr = S.add([null, "합 계", preTax, "부가세 별도"], { kind: "total", name: "합 계", amount: preTax });
    anchors.set("pretax", { sheet: S.name, row: pr });
    const vat = Math.floor(preTax / 10);
    S.add([null, "부가가치세", vat, null], { kind: "tax", name: "부가가치세", amount: vat });
    S.add([null, "총 공사금액", preTax + vat, null], { kind: "total", name: "총 공사금액", amount: preTax + vat });
    sheets.push(S.out());
    gts.push({ name: S.name, kind: "summary", headerRows: [sh], columns: [{ col: 0, role: "no" }, { col: 1, role: "name" }, { col: 2, role: "amount" }, { col: 3, role: "note" }], rows: S.gt, template: t.id + "-S" });
  } else {
    anchors.set("pretax", { sheet: b.name, row: totR });
  }
  if (t.coverSheet) {
    const C = new SheetBuilder(prefix + t.coverSheet, 6);
    const tr2 = C.add(["견   적   서", null, null, null, null, null], { kind: "title" });
    C.merge(tr2, 0, tr2, 5);
    C.add([], { kind: "blank" });
    C.add(["수    신", ":", "[가상] ○○ 귀중", null, null, null], { kind: "info" });
    C.add(["공 사 명", ":", m.title, null, null, null], { kind: "info" });
    C.add([], { kind: "blank" });
    const amt = inj.cover ?? preTax;
    const cr = C.add(["견적금액", ":", amt, "원 (부가가치세 별도)", null, null], { kind: "info", amount: amt });
    anchors.set("cover", { sheet: C.name, row: cr });
    C.add([], { kind: "blank" });
    C.add(["[가상] 가나실내건축", null, null, null, null, null], { kind: "info" });
    sheets.unshift(C.out());
    gts.unshift({ name: C.name, kind: "cover", headerRows: [], columns: [], rows: C.gt, template: t.id + "-C" });
  }
  sheets.splice(t.coverSheet ? 1 : 0, 0, b.out());
  gts.splice(t.coverSheet ? 1 : 0, 0, detailGt);
  // 시트 순서: 표지 → 요약 → 내역 이 흔하다
  if (t.summarySheet) {
    const di = sheets.findIndex((s) => s.name === b.name);
    const si = sheets.findIndex((s) => s.name === prefix + t.summarySheet);
    if (si > di) { const [s] = sheets.splice(si, 1); sheets.splice(di, 0, s); const [g] = gts.splice(si, 1); gts.splice(di, 0, g); }
  }
  return { sheets, gt: gts, anchors, preTax, detailTotal, sectionAmounts };
}

// ── 변경 전 · 후 · 증감 비교 양식 ─────────────────────────────────────
export interface CompareTpl { id: string; heldOut: boolean; groups: [string, string, string]; nameLabel: string; numbering: "dot" | "none"; subtotal: boolean; sheet: string }
export const COMPARE_TEMPLATES: CompareTpl[] = [
  { id: "C1", heldOut: false, groups: ["변경전", "변경후", "증감"], nameLabel: "품명", numbering: "dot", subtotal: true, sheet: "변경내역서" },
  { id: "C2", heldOut: false, groups: ["당 초", "변 경", "증 감"], nameLabel: "공종 및 품명", numbering: "none", subtotal: false, sheet: "변경 내역" },
];

export interface CompareResult { sheet: SheetOut; gt: GtSheet; anchors: Anchors; beforeTotal: number; afterTotal: number }

export function renderCompare(m: DocModel, t: CompareTpl, inj: Injections, rates: { overheadRate: number; profitRate: number; simple?: boolean }): CompareResult {
  // 열: 품명 규격 단위 단가 [전 수량 금액] [후 수량 금액] [증감 수량 금액] 비고
  const W = 11;
  const b = new SheetBuilder(t.sheet, W);
  const anchors: Anchors = new Map();
  const tr = b.add(["변 경 내 역 서", ...new Array(W - 1).fill(null)], { kind: "title" });
  b.merge(tr, 0, tr, W - 1);
  b.add([], { kind: "blank" });
  const r0 = b.r;
  const top: Cell[] = [t.nameLabel, "규격", "단위", "단가", t.groups[0], null, t.groups[1], null, t.groups[2], null, "비고"];
  const bot: Cell[] = [null, null, null, null, "수량", "금액", "수량", "금액", "수량", "금액", null];
  const h1 = b.add(top, { kind: "header" });
  const h2 = b.add(bot, { kind: "header" });
  for (const c of [0, 1, 2, 3, 10]) b.merge(r0, c, r0 + 1, c);
  for (const c of [4, 6, 8]) b.merge(r0, c, r0, c + 1);
  const columns: GtColumn[] = [
    { col: 0, role: "name" }, { col: 1, role: "spec" }, { col: 2, role: "unit" }, { col: 3, role: "unitPrice" },
    { col: 4, role: "qty", group: "before" }, { col: 5, role: "amount", group: "before" }, { col: 6, role: "qty", group: "after" }, { col: 7, role: "amount", group: "after" },
    { col: 8, role: "qty", group: "delta" }, { col: 9, role: "amount", group: "delta" }, { col: 10, role: "note" },
  ];
  let B = 0, A = 0, D = 0;
  m.sections.forEach((s, si) => {
    const secRow: Cell[] = new Array(W).fill(null);
    secRow[0] = t.numbering === "dot" ? `${si + 1}. ${s.name}` : s.name;
    b.add(secRow, { kind: "section", name: s.name, sec: s.key });
    let sb = 0, sa = 0, sd = 0;
    for (const ln of s.lines) {
      const bq = ln.before ?? 0;
      const ba = Math.floor(bq * ln.price);
      const aq = ln.qty;
      const aa = Math.floor(aq * ln.price);
      const dq = inj.deltaQty?.get(ln.iid) ?? Math.round((aq - bq) * 1000) / 1000;
      const da = inj.delta?.get(ln.iid) ?? aa - ba;
      const added = ln.before === undefined;
      const row: Cell[] = [ln.name, ln.spec || null, ln.unit, ln.price, added ? null : bq, added ? null : ba, aq, aa, dq, da, added ? "추가" : null];
      const r = b.add(row, { kind: "item", iid: ln.iid, name: ln.name, spec: ln.spec, unit: ln.unit, qty: aq, unitPrice: ln.price, amount: aa, transforms: ln.transforms, sec: s.key });
      anchors.set(`item:${ln.iid}`, { sheet: b.name, row: r });
      sb += ba; sa += aa; sd += da;
    }
    if (t.subtotal) {
      const r = b.add(["소 계", null, null, null, null, sb, null, sa, null, sd, null], { kind: "subtotal", name: "소 계", amount: sa, sec: s.key });
      anchors.set(`sub:${s.key}`, { sheet: b.name, row: r });
    }
    B += sb; A += sa; D += sd;
  });
  const blk = (label: string, kind: GtKind, bv: number, av: number, dv: number) => b.add([label, null, null, null, null, bv, null, av, null, dv, null], { kind, name: label, amount: av });
  blk("직접공사비 계", "total", B, A, D);
  // 계약 문서에 집계표(간접비 · 단수정리)가 없으면 변경 문서도 직접비만 더한다
  const ohB = rates.simple ? 0 : Math.floor(B * rates.overheadRate), ohA = rates.simple ? 0 : Math.floor(A * rates.overheadRate);
  const pfB = rates.simple ? 0 : Math.floor(B * rates.profitRate), pfA = rates.simple ? 0 : Math.floor(A * rates.profitRate);
  if (!rates.simple) {
    blk(`공과잡비 (${Math.round(rates.overheadRate * 100)}%)`, "item", ohB, ohA, ohA - ohB);
    blk(`기업이윤 (${Math.round(rates.profitRate * 100)}%)`, "item", pfB, pfA, pfA - pfB);
  }
  const xb = B + ohB + pfB, xa = A + ohA + pfA;
  const adjB = rates.simple ? 0 : -(xb % 1000), adjA = rates.simple ? 0 : -(xa % 1000);
  if (adjB !== 0 || adjA !== 0) blk("단수정리", "adjust", adjB, adjA, adjA - adjB);
  const beforeTotal = xb + adjB, afterTotal = xa + adjA;
  const tr2 = blk("합 계", "total", beforeTotal, afterTotal, afterTotal - beforeTotal);
  anchors.set("cmptotal", { sheet: b.name, row: tr2 });
  return { sheet: b.out(), gt: { name: b.name, kind: "detail", headerRows: [h1, h2], columns, rows: b.gt, template: t.id }, anchors, beforeTotal, afterTotal };
}

// ── 정산서 ────────────────────────────────────────────────────────────
export interface SettleTpl { id: string; heldOut: boolean; twoRow: boolean; sheet: string }
export const SETTLE_TEMPLATES: SettleTpl[] = [
  { id: "S1", heldOut: false, twoRow: false, sheet: "정산서" },
  { id: "S2", heldOut: false, twoRow: true, sheet: "정산내역" },
];
export interface SettleSection { key: string; name: string; lines: (DocLine & { contractQty: number })[] }

export function renderSettlement(secs: SettleSection[], t: SettleTpl, inj: Injections): { sheet: SheetOut; gt: GtSheet; anchors: Anchors; total: number } {
  const anchors: Anchors = new Map();
  const W = t.twoRow ? 9 : 9;
  const b = new SheetBuilder(t.sheet, W);
  const tr = b.add(["정 산 서", ...new Array(W - 1).fill(null)], { kind: "title" });
  b.merge(tr, 0, tr, W - 1);
  b.add([], { kind: "blank" });
  let headerRows: number[];
  let columns: GtColumn[];
  if (!t.twoRow) {
    headerRows = [b.add(["번호", "품명", "규격", "단위", "단가", "계약수량", "정산수량", "정산금액", "비고"], { kind: "header" })];
    columns = [{ col: 0, role: "no" }, { col: 1, role: "name" }, { col: 2, role: "spec" }, { col: 3, role: "unit" }, { col: 4, role: "unitPrice" }, { col: 5, role: "qty", group: "before" }, { col: 6, role: "qty", group: "after" }, { col: 7, role: "amount", group: "after" }, { col: 8, role: "note" }];
  } else {
    const r0 = b.r;
    headerRows = [b.add(["품명", "규격", "단위", "단가", "계약", null, "정산", null, "비고"], { kind: "header" }), b.add([null, null, null, null, "수량", "금액", "수량", "금액", null], { kind: "header" })];
    for (const c of [0, 1, 2, 3, 8]) b.merge(r0, c, r0 + 1, c);
    b.merge(r0, 4, r0, 5); b.merge(r0, 6, r0, 7);
    columns = [{ col: 0, role: "name" }, { col: 1, role: "spec" }, { col: 2, role: "unit" }, { col: 3, role: "unitPrice" }, { col: 4, role: "qty", group: "before" }, { col: 5, role: "amount", group: "before" }, { col: 6, role: "qty", group: "after" }, { col: 7, role: "amount", group: "after" }, { col: 8, role: "note" }];
  }
  let total = 0;
  secs.forEach((s, si) => {
    const row: Cell[] = new Array(W).fill(null);
    if (!t.twoRow) { row[0] = `${si + 1}.`; row[1] = s.name; } else row[0] = `${si + 1}. ${s.name}`;
    b.add(row, { kind: "section", name: s.name, sec: s.key });
    let sum = 0;
    s.lines.forEach((ln, ii) => {
      const amt = inj.amount?.get(ln.iid) ?? Math.floor(ln.qty * ln.price);
      const camt = Math.floor(ln.contractQty * ln.price);
      const cells: Cell[] = !t.twoRow
        ? [String(ii + 1), ln.name, ln.spec || null, ln.unit, ln.price, ln.contractQty, ln.qty, amt, null]
        : [ln.name, ln.spec || null, ln.unit, ln.price, ln.contractQty, camt, ln.qty, amt, null];
      const r = b.add(cells, { kind: "item", iid: ln.iid, name: ln.name, spec: ln.spec, unit: ln.unit, qty: ln.qty, unitPrice: ln.price, amount: amt, transforms: ln.transforms, sec: s.key });
      anchors.set(`item:${ln.iid}`, { sheet: b.name, row: r });
      sum += amt;
    });
    const sub: Cell[] = new Array(W).fill(null);
    sub[t.twoRow ? 0 : 1] = "소 계";
    sub[7] = sum;
    const r = b.add(sub, { kind: "subtotal", name: "소 계", amount: sum, sec: s.key });
    anchors.set(`sub:${s.key}`, { sheet: b.name, row: r });
    total += sum;
  });
  const tot: Cell[] = new Array(W).fill(null);
  tot[t.twoRow ? 0 : 1] = "합 계";
  tot[7] = total;
  const tr3 = b.add(tot, { kind: "total", name: "합 계", amount: total });
  anchors.set("detailtotal", { sheet: b.name, row: tr3 });
  return { sheet: b.out(), gt: { name: b.name, kind: "detail", headerRows, columns, rows: b.gt, template: t.id }, anchors, total };
}

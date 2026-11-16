import type { EvidenceRef, Finding, IndustryPack, LedgerRecord, LedgerRole, ParsedLedger, RawWorkbook } from "../types";
import { compactText } from "../normalize/text";
import { findingKey, fmt } from "./common";

/**
 * D10 중복 매입 · 지급 "가능성" — 한 장부(시트) 안에서 같은 거래가 두 번 적혔을 수 있는 곳을 찾는다.
 * 확정하지 않는다: 결과는 항상 certainty "inferred", 심각도는 "높음"이 될 수 없고, 제목에 "가능성"을 쓴다.
 *
 * 정상 반복 거래와 구분하는 규칙(시험 설계: test/d10.test.ts)
 *  1. 취소(마이너스) 거래는 같은 거래처 · 같은 금액의 앞선 거래 하나와 상계한 뒤 본다(취소 후 재발행).
 *  2. 같은 거래처 · 같은 금액(· 같은 품목)이 3번 이상이고 간격이 규칙적(주 · 2주 · 월 · 분기)이면 "정기 반복"으로 보고,
 *     그 안에서 주기의 절반보다 가까운 두 거래만 "정기 반복 중 같은 주기에 두 번"(period-extra)으로 낸다.
 *  3. 그 밖에는: 같은 문서번호(same-docno) > 같은 날(same-day) > 가까운 날(near-days, 업종 묶음의 dupWindowDays 이내).
 *  4. 품목 열이 있고 두 거래의 품목이 다르면 같은 거래로 보지 않는다. 거래처가 다르면 보지 않는다.
 */
type Check = "same-docno" | "same-day" | "near-days" | "period-extra";

const PERIODS = [
  { days: 7, tol: 1, label: "매주" },
  { days: 14, tol: 2, label: "격주" },
  { days: 30.4, tol: 4, label: "매달" },
  { days: 91, tol: 10, label: "분기" },
];

const TITLE: Record<Check, string> = {
  "same-docno": "같은 문서번호가 두 번 적혀 있습니다 — 중복 매입 · 지급 가능성",
  "same-day": "같은 날 같은 거래처 · 같은 금액 거래가 두 번 있습니다 — 중복 매입 · 지급 가능성",
  "near-days": "며칠 사이 같은 거래처 · 같은 금액 거래가 두 번 있습니다 — 중복 매입 · 지급 가능성",
  "period-extra": "정기 거래인데 같은 주기에 두 번 있습니다 — 중복 매입 · 지급 가능성",
};
const CAVEAT: Record<Check, string> = {
  "same-docno": "같은 거래를 장부에 두 번 옮겨 적은 것일 수 있습니다(이 경우 실제 지급은 한 번). 지급 내역과 세금계산서 원본으로 확인하세요.",
  "same-day": "같은 날 같은 자재를 두 번 주문 · 납품받은 정상 거래일 수 있습니다. 거래명세서 · 납품 확인서로 확인하세요.",
  "near-days": "짧은 간격의 추가 주문이나 나눠서 받은 청구일 수 있습니다. 거래명세서 · 납품 확인서로 확인하세요.",
  "period-extra": "정기 거래에 추가 사용분 · 정산분이 따로 청구된 것일 수 있습니다. 계약 조건과 청구 내역으로 확인하세요.",
};

const sameItem = (a: LedgerRecord, b: LedgerRecord) => !a.item || !b.item || compactText(a.item) === compactText(b.item);

function periodOf(recs: LedgerRecord[]): (typeof PERIODS)[number] | undefined {
  const days = recs.map((r) => r.day).filter((d): d is number => d !== undefined).sort((a, b) => a - b);
  if (days.length < 3) return undefined;
  const gaps = days.slice(1).map((d, i) => d - days[i]);
  for (const p of PERIODS) {
    const regular = gaps.filter((g) => Math.abs(g - p.days) <= p.tol).length;
    const short = gaps.filter((g) => g < p.days / 2).length;
    // 규칙적인 간격이 (짧은 간격을 뺀) 나머지의 70% 이상이고, 적어도 2개
    if (regular >= 2 && regular >= 0.7 * (gaps.length - short)) return p;
  }
  return undefined;
}

export function detectD10(ledgers: ParsedLedger[], raw: Map<string, RawWorkbook>, pack: IndustryPack): Finding[] {
  const out: Finding[] = [];
  const W = pack.params.dupWindowDays;
  for (const L of ledgers) {
    const wb = raw.get(L.docId);
    const sheet = wb?.sheets[L.sheetIndex];
    const ev = (r: LedgerRecord, role: EvidenceRef["role"]): EvidenceRef => {
      const cols: Record<string, number> = {}, values: Record<string, string> = {};
      for (const k of ["date", "docNo", "vendor", "item", "supply", "total"] as LedgerRole[]) {
        const c = r.cols[k];
        if (c === undefined) continue;
        cols[k] = c;
        values[k] = sheet?.rows[r.row]?.[c]?.v ?? "";
      }
      return { docId: L.docId, fileName: L.fileName, sheet: L.sheet, row: r.row, cols, values, role };
    };
    const emit = (check: Check, a: LedgerRecord, b: LedgerRecord, extra: string) => {
      const gap = a.day !== undefined && b.day !== undefined ? Math.abs(b.day - a.day) : undefined;
      out.push({
        key: findingKey(["D10", check, L.docId, L.sheet, a.fp, b.fp]),
        detector: "D10", check, severity: check === "same-docno" ? "mid" : "low", certainty: "inferred",
        title: TITLE[check],
        message: `${L.sheet} — ${a.vendor}${a.item ? ` · ${a.item}` : ""} · ${fmt(a.amount)}원: ${a.date ?? "날짜 없음"}(${a.row + 1}행) / ${b.date ?? "날짜 없음"}(${b.row + 1}행)${extra}`,
        amount: Math.abs(b.amount),
        evidence: [ev(a, "base"), ev(b, "compare")],
        calc: { expr: `같은 거래처 · 같은 금액${a.item ? " · 같은 품목" : ""}${gap !== undefined ? ` · 날짜 차이 ${gap}일` : ""}${extra ? " ·" + extra : ""}`, inputs: { amount: a.amount, ...(gap !== undefined ? { days: gap } : {}) } },
        caveat: CAVEAT[check],
      });
    };

    // 1) 취소 상계: 같은 거래처 · |금액| 같은 양(+) 거래 하나(취소일 이전 중 가장 늦은 것, 없으면 가장 이른 것)를 지운다
    const live = L.records.filter((r) => r.amount > 0);
    const cancelled = new Set<string>();
    for (const neg of L.records.filter((r) => r.amount < 0)) {
      const cands = live.filter((r) => !cancelled.has(r.fp) && compactText(r.vendor) === compactText(neg.vendor) && r.amount === -neg.amount && sameItem(r, neg));
      if (!cands.length) continue;
      // 취소일보다 앞선 거래 중 가장 늦은 것 → 같은 날 취소 줄보다 위에 적힌 것 → 그 밖에는 가장 이른 것
      const earlier = cands.filter((r) => r.day !== undefined && neg.day !== undefined && r.day < neg.day);
      const sameDayAbove = cands.filter((r) => (r.day === undefined || neg.day === undefined || r.day === neg.day) && r.row < neg.row);
      const pick = earlier.length ? earlier[earlier.length - 1] : sameDayAbove.length ? sameDayAbove[sameDayAbove.length - 1] : cands[0];
      cancelled.add(pick.fp);
    }
    const recs = live.filter((r) => !cancelled.has(r.fp));

    // 2) 같은 거래처 · 같은 금액 묶음
    const groups = new Map<string, LedgerRecord[]>();
    for (const r of recs) {
      const k = `${compactText(r.vendor)}|${r.amount}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const paired = new Set<string>();
      // 같은 문서번호
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const a = g[i], b = g[j];
        if (a.docNo && a.docNo === b.docNo && !paired.has(b.fp)) { emit("same-docno", a, b, ` · 문서번호 ${a.docNo} 같음`); paired.add(b.fp); paired.add(a.fp); }
      }
      // 품목별로 나눠 날짜 비교(품목 열이 없으면 한 묶음)
      const byItem = new Map<string, LedgerRecord[]>();
      for (const r of g) { if (paired.has(r.fp)) continue; const k = compactText(r.item); byItem.set(k, [...(byItem.get(k) ?? []), r]); }
      for (const xs0 of byItem.values()) {
        const xs = [...xs0].sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.row - b.row);
        const period = periodOf(xs);
        for (let i = 1; i < xs.length; i++) {
          const a = xs[i - 1], b = xs[i];
          if (paired.has(a.fp) || paired.has(b.fp) || a.day === undefined || b.day === undefined) continue;
          const gap = b.day - a.day;
          const docNote = a.docNo && b.docNo ? ` · 문서번호 다름(${a.docNo} / ${b.docNo})` : "";
          if (period) {
            if (gap < period.days / 2) { emit("period-extra", a, b, ` · ${period.label} 반복 거래 중 ${gap}일 간격${docNote}`); paired.add(a.fp); paired.add(b.fp); }
            continue;
          }
          if (gap === 0) { emit("same-day", a, b, docNote); paired.add(a.fp); paired.add(b.fp); }
          else if (gap <= W) { emit("near-days", a, b, docNote); paired.add(a.fp); paired.add(b.fp); }
        }
      }
    }
  }
  return out;
}

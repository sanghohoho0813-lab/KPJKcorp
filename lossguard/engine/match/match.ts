import type { IndustryPack, Line, LineageItem, Link, LinkDecision, MatchOptions, NormName } from "../types";
import { bigrams, dice, jaccard } from "../normalize/text";
import { specNumSim } from "../normalize/spec";
import type { Normalizer } from "../normalize/name";
import { makeNormalizer } from "../normalize/name";

/**
 * 문서 간 항목 정합 — 공통 번호가 없는 두 문서에서 "같은 항목"을 찾는다.
 *  1) 구간(공종) 짝짓기: 구간 이름의 글자 묶음 겹침
 *  2) 순서 정렬: 짝지은 구간 안에서 점수 가중 최장 공통 부분열(같은 파일을 고쳐 만든 문서는 줄 순서가 대부분 같다)
 *  3) 전역 배정: 남은 항목은 후보를 좁힌 뒤 점수 높은 순으로 1:1 배정
 * 점수 = 이름 · 규격 · 단위 · 단가 · 구간 일치의 가중 합(항목별 기여를 그대로 남긴다).
 * 두 문턱: tAuto 이상 자동 연결 / tReview 이상 확인 대기 / 그 아래 연결 없음.
 */

export interface Scored { score: number; parts: Record<string, number> }

/** 한쪽 이름의 낱말이 다른 쪽 이름 글자 안에 모두 들어 있는 정도(띄어쓰기 · 순서가 함께 바뀐 경우) × 길이 비 */
function containment(a: NormName, b: NormName): number {
  const one = (x: NormName, y: NormName) => {
    let tot = 0, hit = 0;
    for (const t of x.tokens) { tot += t.length; if (y.canon.includes(t)) hit += t.length; }
    return tot ? hit / tot : 0;
  };
  const la = a.canon.length, lb = b.canon.length;
  if (!la || !lb) return 0;
  return Math.max(one(a, b), one(b, a)) * (Math.min(la, lb) / Math.max(la, lb));
}

export function pairScore(a: NormName, b: NormName, pa: number | undefined, pb: number | undefined, section: number, pack: IndustryPack, opts: MatchOptions): Scored {
  // 숫자 없는 규격(원피스 · 하드보드 …)이 이름 괄호 안으로 옮겨 간 경우: 이름 + 규격 글자를 이어서도 비교
  const aw = a.canon + a.specWords.join(""), bw = b.canon + b.specWords.join("");
  const name = Math.max(
    dice(a.bigrams, b.bigrams),
    jaccard(a.tokens, b.tokens),
    a.canon && a.canon === b.canon ? 1 : 0,
    aw && aw === bw ? 1 : (a.specWords.length || b.specWords.length) ? dice(bigrams(aw), bigrams(bw)) : 0,
    containment(a, b),
    // 오타(비슷한 글자 · 받침 차이)는 자모 단위로 비교 — 같은 이름보다는 낮게 친다
    a.jamo.length && b.jamo.length ? 0.95 * dice(a.jamo, b.jamo) : 0,
  );
  const ov = specNumSim(a.specNums, b.specNums);
  let spec = ov === undefined ? 0.5 : ov;
  if (ov === undefined && (a.specWords.length || b.specWords.length)) {
    const inOther = (x: NormName, y: NormName) => x.specWords.length > 0 && x.specWords.every((w) => y.specWords.includes(w) || y.tokens.includes(w) || y.canon.includes(w));
    spec = inOther(a, b) || inOther(b, a) ? 1 : a.specWords.length && b.specWords.length ? jaccard(a.specWords, b.specWords) : 0.5;
  }
  let unit = 0.5;
  if (a.unit && b.unit) {
    if (a.unit === b.unit) unit = 1;
    else if (pack.unitConversions.some((c) => (c.a === a.unit && c.b === b.unit) || (c.a === b.unit && c.b === a.unit))) unit = 0.6;
    else unit = 0;
  }
  let price = 0.5;
  if (pa && pb && pa > 0 && pb > 0) {
    const r = Math.min(pa, pb) / Math.max(pa, pb);
    price = r >= 0.98 ? 1 : Math.max(0, (r - 0.6) / 0.38);
  }
  const useSP = opts.specPrice !== false;
  let score = useSP
    ? 0.5 * name + 0.2 * spec + 0.1 * unit + 0.1 * price + 0.1 * section
    : 0.75 * name + 0.1 * unit + 0.15 * section;
  if (useSP && ov === 0) score = Math.min(score, 0.5);
  if (unit === 0) score = Math.min(score, 0.6);
  // 환산이 필요한 단위(평 ↔ ㎡ 등)는 사람이 환산을 확인할 때까지 자동 연결하지 않는다
  if (unit === 0.6) score = Math.min(score, 0.7);
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return { score: r3(score), parts: { name: r3(name), spec: r3(spec), unit: r3(unit), price: r3(price), section: r3(section) } };
}

interface Item { line: Line; norm: NormName; sec: string; idx: number }

function lastSection(l: Line, norm: Normalizer): string {
  return l.path.length ? norm.section(l.path[l.path.length - 1]) : "";
}

const ref = (l: Line) => ({ docId: l.docId, sheet: l.sheet, row: l.row, fp: l.fp });

export function matchLines(base: Line[], other: Line[], pack: IndustryPack, norm: Normalizer, opts: MatchOptions = {}, decisions: LinkDecision[] = []): Link[] {
  const useAlign = opts.align !== false;
  const plain = opts.synonyms === false ? makeNormalizer(pack, { synonyms: false }) : undefined;
  const renorm = (l: Line): NormName => (plain ? plain.name(l.name, l.spec, l.unit) : l.norm);
  const A: Item[] = base.map((line, idx) => ({ line, norm: renorm(line), sec: lastSection(line, norm), idx }));
  const B: Item[] = other.map((line, idx) => ({ line, norm: renorm(line), sec: lastSection(line, norm), idx }));
  const P = pack.params;
  const links: Link[] = [];
  const usedA = new Set<number>(), usedB = new Set<number>();
  const forbid = new Set<string>();
  // 사람의 판단이 먼저
  for (const d of decisions) {
    if (!d.same) { forbid.add(`${d.a}|${d.b}`); continue; }
    const a = A.find((x) => x.line.fp === d.a && !usedA.has(x.idx));
    const b = B.find((x) => x.line.fp === d.b && !usedB.has(x.idx));
    if (!a || !b) continue;
    usedA.add(a.idx); usedB.add(b.idx);
    links.push({ a: ref(a.line), b: ref(b.line), score: 1, state: "confirmed", parts: { decision: 1 }, via: "decision" });
  }
  // 1) 구간 짝짓기 — 같은 이름 먼저, 남은 것끼리 글자 묶음 겹침
  const secA = [...new Set(A.map((x) => x.sec))];
  const secB = [...new Set(B.map((x) => x.sec))];
  const secPair = new Map<string, string>();
  const secScores: [number, string, string][] = [];
  const setB = new Set(secB);
  for (const sa of secA) if (setB.has(sa)) secScores.push([1, sa, sa]);
  const exactA = new Set(secScores.map((x) => x[1]));
  const restA = secA.filter((s) => !exactA.has(s)), restB = secB.filter((s) => !exactA.has(s));
  if (restA.length * restB.length <= 40000) for (const sa of restA) for (const sb of restB) {
    const s = dice(bigrams(sa), bigrams(sb));
    if (s >= 0.5) secScores.push([s, sa, sb]);
  }
  secScores.sort((x, y) => y[0] - x[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0) || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0));
  const pairedB = new Set<string>();
  for (const [, sa, sb] of secScores) { if (secPair.has(sa) || pairedB.has(sb)) continue; secPair.set(sa, sb); pairedB.add(sb); }
  // 구간 구성이 서로 대응할 때만 구간 일치를 근거로 쓴다(층 · 구역으로 다시 묶은 문서처럼 대응하지 않으면 중립)
  const pairedShare = (xs: Item[], has: (sec: string) => boolean) => (xs.length ? xs.filter((x) => x.sec && has(x.sec)).length / xs.length : 0);
  const sectionsCorrespond = pairedShare(A, (sec) => secPair.has(sec)) >= 0.5 && pairedShare(B, (sec) => pairedB.has(sec)) >= 0.5;
  const secSim = (a: Item, b: Item) => {
    if (!sectionsCorrespond || !a.sec || !b.sec) return 0.5;
    const pa = secPair.get(a.sec);
    if (pa === b.sec) return 1;
    // 두 구간 모두 다른 짝이 있을 때만 "다른 구간"으로 본다 — 짝이 없는 구간은 근거가 없으므로 중립
    return pa !== undefined && pairedB.has(b.sec) ? 0 : 0.5;
  };
  const score = (a: Item, b: Item) => pairScore(a.norm, b.norm, a.line.unitPrice, b.line.unitPrice, secSim(a, b), pack, opts);
  const allowed = (a: Item, b: Item) => !forbid.has(`${a.line.fp}|${b.line.fp}`);

  /** 순서 증거: 서로 가장 잘 맞는 강한 짝(0.9 이상)들의 순서가 80% 이상 보존되면 참. 짝이 3개 미만이면 판단 불가 → 참 */
  const orderEvidence = (xs: Item[], ys: Item[]): boolean => {
    const bestOf = (x: Item, pool: Item[]) => { let b: Item | undefined, bs = 0; for (const y of pool) { const sc = pairScore(x.norm, y.norm, x.line.unitPrice, y.line.unitPrice, 1, pack, opts).score; if (sc > bs) { bs = sc; b = y; } } return [b, bs] as const; };
    const strong: [number, number][] = [];
    for (const x of xs) {
      const [y, sc] = bestOf(x, ys);
      if (!y || sc < 0.9) continue;
      const [x2] = bestOf(y, xs);
      if (x2 === x) strong.push([xs.indexOf(x), ys.indexOf(y)]);
    }
    if (strong.length < 3) return true;
    // 최장 증가 부분열 길이
    const seq = strong.sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    const tails: number[] = [];
    for (const v of seq) { let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < v) lo = mid + 1; else hi = mid; } tails[lo] = v; }
    return tails.length / seq.length >= 0.8;
  };

  // 2) 순서 정렬
  if (useAlign) {
    for (const [sa, sb] of secPair) {
      const xs = A.filter((x) => x.sec === sa && !usedA.has(x.idx));
      const ys = B.filter((y) => y.sec === sb && !usedB.has(y.idx));
      if (!xs.length || !ys.length || xs.length * ys.length > 250000) continue;
      if (!orderEvidence(xs, ys)) continue;
      const S: (Scored | null)[][] = xs.map((x) => ys.map((y) => { if (!allowed(x, y)) return null; const s = score(x, y); return s.score >= P.tAlign ? s : null; }));
      const n = xs.length, m = ys.length;
      const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        const s = S[i - 1][j - 1];
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], s ? dp[i - 1][j - 1] + s.score : -1);
      }
      let i = n, j = m;
      const pairs: [number, number][] = [];
      while (i > 0 && j > 0) {
        const s = S[i - 1][j - 1];
        if (s && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + s.score)) < 1e-9) { pairs.push([i - 1, j - 1]); i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
        else j--;
      }
      for (const [pi, pj] of pairs.reverse()) {
        const s = S[pi][pj]!;
        const sc = Math.min(1, Math.round((s.score + 0.05) * 1000) / 1000);
        if (sc < P.tReview) continue;
        usedA.add(xs[pi].idx); usedB.add(ys[pj].idx);
        links.push({ a: ref(xs[pi].line), b: ref(ys[pj].line), score: sc, state: sc >= P.tAuto ? "auto" : "review", parts: { ...s.parts, align: 1 }, via: "align" });
      }
    }
  }

  // 3) 전역 배정 — 글자 묶음 색인으로 후보를 좁힌다(겹치는 글자 묶음이 많은 상위 후보만 점수 계산)
  const index = new Map<string, number[]>();
  A.forEach((a, k) => { if (usedA.has(a.idx)) return; for (const g of new Set([...a.norm.bigrams, ...a.norm.specWords])) { const arr = index.get(g); if (arr) arr.push(k); else index.set(g, [k]); } });
  const MAX_CAND = 40;
  const cand: { s: Scored; a: Item; b: Item }[] = [];
  for (const b of B) {
    if (usedB.has(b.idx)) continue;
    const counts = new Map<number, number>();
    for (const g of new Set([...b.norm.bigrams, ...b.norm.specWords])) for (const k of index.get(g) ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
    const seen = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, MAX_CAND).map((x) => x[0]);
    for (const k of seen) {
      const a = A[k];
      if (usedA.has(a.idx) || !allowed(a, b)) continue;
      const s = score(a, b);
      if (s.score >= P.tReview) cand.push({ s, a, b });
    }
  }
  cand.sort((x, y) => y.s.score - x.s.score || x.a.idx - y.a.idx || x.b.idx - y.b.idx);
  for (const c of cand) {
    if (usedA.has(c.a.idx) || usedB.has(c.b.idx)) continue;
    usedA.add(c.a.idx); usedB.add(c.b.idx);
    links.push({ a: ref(c.a.line), b: ref(c.b.line), score: c.s.score, state: c.s.score >= P.tAuto ? "auto" : "review", parts: c.s.parts, via: "global" });
  }
  links.sort((x, y) => (x.a.sheet < y.a.sheet ? -1 : x.a.sheet > y.a.sheet ? 1 : 0) || x.a.row - y.a.row || x.b.row - y.b.row);
  return links;
}

/** 변경 계보 — 기준 문서 항목이 다음 문서에서 어떻게 바뀌었나 */
export function lineage(base: Line[], next: Line[], links: Link[], docId: string): LineageItem[] {
  const byA = new Map<string, Link>();
  const byB = new Set<string>();
  for (const l of links) { if (l.state === "rejected") continue; byA.set(`${l.a.sheet}|${l.a.row}`, l); byB.add(`${l.b.sheet}|${l.b.row}`); }
  const nextAt = new Map(next.map((l) => [`${l.sheet}|${l.row}`, l]));
  const out: LineageItem[] = [];
  for (const a of base) {
    const lk = byA.get(`${a.sheet}|${a.row}`);
    if (!lk) { out.push({ docId, status: "removed", base: ref(a), name: a.name, qtyBefore: a.qty, amountBefore: a.amount }); continue; }
    const b = nextAt.get(`${lk.b.sheet}|${lk.b.row}`);
    if (!b) continue;
    const same = (a.qty ?? 0) === (b.qty ?? 0) && Math.abs((a.amount ?? 0) - (b.amount ?? 0)) < 1;
    out.push({ docId, status: same ? "same" : "changed", base: ref(a), next: ref(b), name: a.name, qtyBefore: a.qty, qtyAfter: b.qty, amountBefore: a.amount, amountAfter: b.amount, linkState: lk.state });
  }
  for (const b of next) if (!byB.has(`${b.sheet}|${b.row}`)) out.push({ docId, status: "added", next: ref(b), name: b.name, qtyAfter: b.qty, amountAfter: b.amount });
  return out;
}

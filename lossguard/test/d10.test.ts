// D10 중복 매입 · 지급 "가능성" — 시험을 먼저 설계했다(2026-11-16). 표는 합성 생성기와 다른 방식(손으로 쓴 CSV)으로 만든다.
//
// 설계 원칙
//  · 같은 거래처 · 같은 금액 · 가까운 날짜라는 이유만으로 "중복 지급"이라 하지 않는다 — 결과는 항상 "중복 가능성 · 확인 필요"(certainty: inferred)
//  · 정상인데 비슷해 보이는 거래(정기 임대료 · 주간 납품 · 분할 납품 · 계약금/중도금 · 같은 날 다른 품목 · 취소 후 재발행)는 내지 않는다
//  · 근거가 강한 순서: 같은 문서번호 두 번(same-docno) > 같은 날 · 같은 품목 · 같은 금액(same-day) > 며칠 안(near-days) > 정기 반복 중 같은 주기에 두 번(period-extra)
//  · 정상 반복 거래와 중복을 구분하는 것은 "간격의 규칙성"과 "취소 거래" 두 가지뿐이다 — 이 밖의 정상 사유(같은 날 같은 자재 추가 주문 등)는 사람만 안다 → 주의 문구로 남긴다
import { readWorkbook } from "../engine/io/read";
import { analyze } from "../engine/analyze";
import pack from "../packs/construction-interior/index";
import type { Finding } from "../engine/types";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const enc = (s: string) => new TextEncoder().encode(s);

const HEAD = "거래일자,승인번호,거래처,품목,수량,단가,공급가액,세액,합계";
const HEAD_NO_DOC = "일자,거래처명,품명,공급가액,부가세";

interface Case { id: string; why: string; head: string; rows: string[]; expect: { check: string; rows: number[] }[] }

const CASES: Case[] = [
  // ── 정상(결과 없어야 함) ─────────────────────────────────────────
  { id: "N1", why: "매달 같은 날 같은 금액 임대료(5회)", head: HEAD, rows: ["2024-01-25,A1,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-02-25,A2,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-03-25,A3,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-04-25,A4,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-05-24,A5,가상임대,장비 임대,1,1000000,1000000,100000,1100000"], expect: [] },
  { id: "N2", why: "매주 같은 금액 정기 납품(6회)", head: HEAD, rows: ["2024-03-04,B1,가상자재,골재,10,35000,350000,35000,385000", "2024-03-11,B2,가상자재,골재,10,35000,350000,35000,385000", "2024-03-18,B3,가상자재,골재,10,35000,350000,35000,385000", "2024-03-25,B4,가상자재,골재,10,35000,350000,35000,385000", "2024-04-01,B5,가상자재,골재,10,35000,350000,35000,385000", "2024-04-08,B6,가상자재,골재,10,35000,350000,35000,385000"], expect: [] },
  { id: "N3", why: "같은 날 같은 금액이지만 거래처가 다름", head: HEAD, rows: ["2024-04-02,C1,가상상사,철물,1,500000,500000,50000,550000", "2024-04-02,C2,다른상사,철물,1,500000,500000,50000,550000"], expect: [] },
  { id: "N4", why: "같은 거래처 같은 날, 금액이 다름", head: HEAD, rows: ["2024-04-02,D1,가상상사,철물,1,500000,500000,50000,550000", "2024-04-02,D2,가상상사,철물,1,520000,520000,52000,572000"], expect: [] },
  { id: "N5", why: "계약금 · 중도금 같은 금액, 두 달 간격(2회 — 반복으로도 중복으로도 보지 않음)", head: HEAD, rows: ["2024-01-10,E1,가상설비,설비 공사 계약금,1,3000000,3000000,300000,3300000", "2024-03-12,E2,가상설비,설비 공사 중도금,1,3000000,3000000,300000,3300000"], expect: [] },
  { id: "N6", why: "같은 품목 분할 납품(수량 · 금액 다름)", head: HEAD, rows: ["2024-05-02,F1,가상자재,석고보드,100,6800,680000,68000,748000", "2024-05-03,F2,가상자재,석고보드,60,6800,408000,40800,448800"], expect: [] },
  { id: "N7", why: "발행 → 취소(마이너스) → 재발행(같은 금액)", head: HEAD, rows: ["2024-06-03,G1,가상자재,타일,1,900000,900000,90000,990000", "2024-06-05,G2,가상자재,타일,1,-900000,-900000,-90000,-990000", "2024-06-05,G3,가상자재,타일,1,900000,900000,90000,990000"], expect: [] },
  { id: "N8", why: "같은 날 같은 금액이지만 품목이 다름(다른 자재 두 건)", head: HEAD, rows: ["2024-06-10,H1,가상자재,문틀,1,400000,400000,40000,440000", "2024-06-10,H2,가상자재,도어록,1,400000,400000,40000,440000"], expect: [] },
  { id: "N9", why: "합계 줄은 거래가 아님", head: HEAD, rows: ["2024-06-10,I1,가상자재,문틀,1,400000,400000,40000,440000", ",,합계,,,,400000,40000,440000"], expect: [] },
  // ── 중복 가능성(결과가 나와야 함) ─────────────────────────────────
  { id: "P1", why: "같은 승인번호가 두 번(같은 행을 두 번 옮겨 적음)", head: HEAD, rows: ["2024-07-01,J1,가상자재,합판,20,15000,300000,30000,330000", "2024-07-01,J1,가상자재,합판,20,15000,300000,30000,330000"], expect: [{ check: "same-docno", rows: [1, 2] }] },
  { id: "P2", why: "문서번호 열이 없는 장부 — 같은 날 · 같은 거래처 · 같은 품목 · 같은 금액", head: HEAD_NO_DOC, rows: ["2024-07-03,가상자재,실리콘,120000,12000", "2024-07-03,가상자재,실리콘,120000,12000"], expect: [{ check: "same-day", rows: [1, 2] }] },
  { id: "P3", why: "같은 거래처 · 같은 품목 · 같은 금액이 3일 간격(정기 반복 아님)", head: HEAD, rows: ["2024-07-08,K1,가상설비,배관 자재,1,780000,780000,78000,858000", "2024-07-11,K2,가상설비,배관 자재,1,780000,780000,78000,858000"], expect: [{ check: "near-days", rows: [1, 2] }] },
  { id: "P4", why: "매달 임대료인데 3월에만 두 번", head: HEAD, rows: ["2024-01-25,L1,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-02-26,L2,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-03-25,L3,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-03-28,L4,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-04-25,L5,가상임대,장비 임대,1,1000000,1000000,100000,1100000", "2024-05-27,L6,가상임대,장비 임대,1,1000000,1000000,100000,1100000"], expect: [{ check: "period-extra", rows: [3, 4] }] },
  { id: "P5", why: "같은 날 같은 금액 · 같은 품목, 승인번호만 다름(두 장 발행 가능성 — 정상일 수도 있음)", head: HEAD, rows: ["2024-08-01,M1,가상전기,전선,1,250000,250000,25000,275000", "2024-08-01,M2,가상전기,전선,1,250000,250000,25000,275000"], expect: [{ check: "same-day", rows: [1, 2] }] },
  { id: "P6", why: "취소 한 건 + 같은 금액 세 건(취소로 하나만 상계, 하나는 남음)", head: HEAD, rows: ["2024-08-05,N1,가상자재,타일,1,900000,900000,90000,990000", "2024-08-06,N2,가상자재,타일,1,-900000,-900000,-90000,-990000", "2024-08-06,N3,가상자재,타일,1,900000,900000,90000,990000", "2024-08-07,N4,가상자재,타일,1,900000,900000,90000,990000"], expect: [{ check: "near-days", rows: [3, 4] }] },
];

const run = async (c: Case) => {
  const wb = await readWorkbook(enc([c.head, ...c.rows].join("\n")), `${c.id}.csv`);
  return analyze({ docs: [{ docId: "cost", kind: "cost", workbook: wb }], meta: { vat: "excluded" }, pack });
};
const rowsOf = (f: Finding) => f.evidence.map((e) => e.row).sort((a, b) => a - b);

(async () => {
  let normalFp = 0, normalN = 0, dupHit = 0, dupN = 0;
  for (const c of CASES) {
    const res = await run(c);
    const d10 = res.findings.filter((f) => f.detector === "D10");
    if (!c.expect.length) {
      normalN++;
      if (d10.length) normalFp++;
      ok(d10.length === 0, `${c.id} 정상 — ${c.why} (결과 ${d10.length}건${d10.length ? ": " + d10.map((f) => f.check + "@" + rowsOf(f).join("/")).join(", ") : ""})`);
      continue;
    }
    for (const e of c.expect) {
      dupN++;
      const hit = d10.find((f) => f.check === e.check && rowsOf(f).join(",") === e.rows.join(","));
      if (hit) dupHit++;
      ok(!!hit && d10.length === c.expect.length, `${c.id} 가능성 — ${c.why} → ${e.check} 행 ${e.rows.map((r) => r + 1).join("·")} (실제: ${d10.map((f) => f.check + "@" + rowsOf(f).map((r) => r + 1).join("·")).join(", ") || "없음"})`);
    }
  }
  // 표현 · 확실함: 확정 표현 금지
  const all = (await Promise.all(CASES.map(run))).flatMap((r) => r.findings.filter((f) => f.detector === "D10"));
  ok(all.length > 0 && all.every((f) => f.certainty === "inferred" && f.severity !== "high"), "D10 결과는 모두 '추정'(inferred)이며 심각도 '높음'이 없다");
  ok(all.every((f) => /가능성/.test(f.title) && !/중복 지급(입니다|됨|확인)/.test(f.title + f.message) && !!f.caveat), "제목은 '가능성', 확정 문구 없음, 문제가 아닐 수 있는 경우를 함께 적음");
  ok(all.every((f) => f.evidence.length >= 2 && f.evidence.every((e) => Object.keys(e.cols).length >= 2)), "근거: 두 거래 이상의 원본 행 · 칸");

  // 읽기: 날짜 표기 · 엑셀 날짜 숫자 · 머리글 위 제목 줄
  const odd = ["매입 내역(가상)", "", "일자,거래처,품목,금액", "2024.7.1,가상자재,합판,300000", "20240701,가상자재,합판,300000"].join("\n");
  const r2 = await analyze({ docs: [{ docId: "cost", kind: "cost", workbook: await readWorkbook(enc(odd), "odd.csv") }], meta: { vat: "excluded" }, pack });
  ok(r2.findings.some((f) => f.detector === "D10" && f.check === "same-day"), "날짜 표기가 달라도(2024.7.1 · 20240701) 같은 날로 읽음 · 제목 줄 건너뜀");
  const serial = { fileName: "s.xlsx", sheets: [{ name: "매입", hidden: false, merges: [], hiddenRows: [], hiddenCols: [], rows: [
    [{ v: "거래일자", t: "text" as const }, { v: "거래처", t: "text" as const }, { v: "품목", t: "text" as const }, { v: "공급가액", t: "text" as const }],
    [{ v: "45474", t: "num" as const, n: 45474 }, { v: "가상자재", t: "text" as const }, { v: "합판", t: "text" as const }, { v: "300000", t: "num" as const, n: 300000 }],
    [{ v: "45474", t: "num" as const, n: 45474 }, { v: "가상자재", t: "text" as const }, { v: "합판", t: "text" as const }, { v: "300000", t: "num" as const, n: 300000 }],
  ] }] };
  const r3 = analyze({ docs: [{ docId: "cost", kind: "cost", workbook: serial }], meta: { vat: "excluded" }, pack });
  ok(r3.findings.some((f) => f.detector === "D10" && f.check === "same-day") && r3.ledgers[0]?.records[0]?.date === "2024-07-01", `엑셀 날짜 숫자(45474 → 2024-07-01) 읽음 (${r3.ledgers[0]?.records[0]?.date})`);
  const noLedger = await analyze({ docs: [{ docId: "cost", kind: "cost", workbook: await readWorkbook(enc("가나다,라마\n1,2\n"), "x.csv") }], meta: { vat: "excluded" }, pack });
  ok(noLedger.findings.length === 0 && noLedger.skipped.some((s) => s.detector === "D10"), "거래처 · 금액 열을 못 찾으면 D10 을 돌리지 않고 '자료 부족'으로 알림");

  console.log(`요약: 정상 사례 ${normalN}개 중 결과가 나온 사례 ${normalFp}개 · 중복 가능성 ${dupN}건 중 찾은 것 ${dupHit}건`);
  process.exit(fail ? 1 : 0);
})();

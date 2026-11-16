// 반례 시험 — 합성 생성기를 쓰지 않고 손으로 쓴 표. 생성기가 만들지 않는 모양에서 엔진이 "맞게 읽거나, 최소한 틀린 결과를 내지 않는지" 본다.
// 기대가 "맞게 읽음"인 것과 "안전하게 물러섬(확인 대기 · 보류)"인 것을 나눠 적는다.
import type { RawCell, RawSheet, RawWorkbook, AnalyzeResult } from "../engine/types";
import { analyze } from "../engine/analyze";
import pack from "../packs/construction-interior/index";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const cell = (v: string | number | null): RawCell => (v === null || v === "" ? { v: "", t: "empty" } : typeof v === "number" ? { v: String(v), t: "num", n: v } : { v, t: "text" });
const sheet = (name: string, rows: (string | number | null)[][], merges: RawSheet["merges"] = []): RawSheet => ({ name, hidden: false, rows: rows.map((r) => r.map(cell)), merges, hiddenRows: [], hiddenCols: [] });
const book = (name: string, ...sheets: RawSheet[]): RawWorkbook => ({ fileName: name, sheets });
const run = (docs: { id: string; kind: "contract" | "change" | "settlement"; wb: RawWorkbook }[]): AnalyzeResult => analyze({ docs: docs.map((d) => ({ docId: d.id, kind: d.kind, workbook: d.wb })), meta: { vat: "excluded" }, pack });
const items = (r: AnalyzeResult, docId: string) => r.docs.find((d) => d.docId === docId)!.sheets.flatMap((s) => s.lines.filter((l) => l.kind === "item"));
const roleAt = (r: AnalyzeResult, docId: string, col: number) => r.docs.find((d) => d.docId === docId)!.sheets.find((s) => s.kind === "detail")?.columns.find((c) => c.col === col);

// C1 표지 글 뒤 14행에 머리글, 열 순서가 금액 · 단가 · 수량 · 단위 · 규격 · 품명(거꾸로)
{
  const rows: (string | number | null)[][] = [["공 사 내 역 서"], [], ["공사명: (가상) 사무실 개보수"], ["발주처: (가상)"], [], [], [], [], [], [], [], [], [], [],
    ["금액", "단가", "수량", "단위", "규격", "품명"],
    [1360000, 6800, 200, "장", "9.5T", "석고보드"], [450000, 15000, 30, "장", "12T", "합판"], [96000, 2400, 40, "개", "", "실리콘"], [520000, 26000, 20, "m2", "600x600", "포세린 타일"]];
  const r = run([{ id: "c", kind: "contract", wb: book("c1.xlsx", sheet("내역", rows)) }]);
  const it = items(r, "c");
  ok(it.length === 4 && it.every((l) => l.qty! * l.unitPrice! === l.amount) && it[0].name === "석고보드" && r.findings.length === 0, `C1 머리글이 15행 · 열 순서 거꾸로 → 항목 ${it.length}줄을 바르게 읽음, 결과 ${r.findings.length}건`);
}

// C2 숫자 표기: 수량에 단위 글자(12개) · ₩ · 원 · 괄호 음수 · △
{
  const rows = [["품명", "규격", "단위", "수량", "단가", "금액"], ["문손잡이", "", "", "12개", "₩45,000", "540,000원"], ["도어스토퍼", "", "", "30개", "₩8,000", "240,000원"], ["경첩", "", "", "24개", "₩3,500", "84,000원"],
    ["단수정리", "", "", "", "", "(4,000)"], ["합계", "", "", "", "", "860,000"]];
  const r = run([{ id: "c", kind: "contract", wb: book("c2.xlsx", sheet("내역", rows)) }]);
  const it = items(r, "c");
  ok(it.length === 3 && it[0].qty === 12 && it[0].unitPrice === 45000 && it[0].amount === 540000 && r.findings.length === 0, `C2 '12개' · '₩45,000' · '540,000원' · '(4,000)' 단수정리 → 바르게 읽고 합계 검산도 맞음(결과 ${r.findings.length}건)`);
}

// C3 같은 품명이 두 구간(벽체 · 천장)에 — 정산서에서 천장 쪽 수량만 바뀜: 구간을 건너 엇갈려 잇지 않아야 함
{
  const c = [["품명", "규격", "단위", "수량", "단가", "금액"], ["1. 벽체공사"], ["석고보드", "9.5T", "장", 200, 6800, 1360000], ["경량철골 스터드", "65형", "m", 300, 4200, 1260000], ["2. 천장공사"], ["석고보드", "9.5T", "장", 120, 6800, 816000], ["천장틀 M-BAR", "", "m2", 80, 15000, 1200000]];
  const s = [["품명", "규격", "단위", "수량", "단가", "금액"], ["1. 벽체공사"], ["석고보드", "9.5T", "장", 200, 6800, 1360000], ["경량철골 스터드", "65형", "m", 300, 4200, 1260000], ["2. 천장공사"], ["석고보드", "9.5T", "장", 150, 6800, 1020000], ["천장틀 M-BAR", "", "m2", 80, 15000, 1200000]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", c)) }, { id: "s", kind: "settlement", wb: book("s.xlsx", sheet("정산", s)) }]);
  const pairs = r.links.filter((l) => l.state !== "review").map((l) => `${l.a.row}->${l.b.row}`).sort();
  ok(pairs.includes("2->2") && pairs.includes("5->5") && !pairs.includes("2->5") && !pairs.includes("5->2"), `C3 같은 이름이 두 구간에 → 구간끼리 짝(벽체 3행↔3행, 천장 6행↔6행): ${pairs.join(", ")}`);
}

// C4 한 구간에 똑같은 줄이 두 개(실리콘 두 번) — 순서대로 1:1
{
  const c = [["품명", "규격", "단위", "수량", "단가", "금액"], ["실리콘", "투명", "개", 40, 2400, 96000], ["실리콘", "투명", "개", 10, 2400, 24000], ["코킹 건", "", "개", 2, 15000, 30000]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", c)) }, { id: "s", kind: "settlement", wb: book("s.xlsx", sheet("정산", c)) }]);
  const pairs = r.links.map((l) => `${l.a.row}->${l.b.row}`).sort();
  ok(pairs.join(",") === "1->1,2->2,3->3", `C4 똑같은 줄 두 개 → 순서대로 1:1 (${pairs.join(", ")})`);
}

// C5 사전에 없는 다른 이름(랜선 ↔ UTP 케이블) — 자동으로 잇지 않음(안전하게 물러섬)
{
  const c = [["품명", "규격", "단위", "수량", "단가", "금액"], ["랜선", "CAT.6", "m", 300, 900, 270000], ["콘센트", "2구", "개", 20, 6000, 120000], ["스위치", "1구", "개", 15, 4500, 67500]];
  const s = [["품명", "규격", "단위", "수량", "단가", "금액"], ["UTP 케이블", "CAT.6", "m", 300, 900, 270000], ["콘센트", "2구", "개", 20, 6000, 120000], ["스위치", "1구", "개", 15, 4500, 67500]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", c)) }, { id: "s", kind: "settlement", wb: book("s.xlsx", sheet("정산", s)) }]);
  const l = r.links.find((x) => x.a.row === 1);
  ok(!l || l.state === "review", `C5 랜선 ↔ UTP 케이블 → 자동 연결하지 않음(${l ? "확인 필요" : "연결 안 됨"} — 사람이 확인)`);
}

// C6 규격만 다른 다른 항목(600x600 ↔ 300x600) — 자동으로 잇지 않음
{
  const c = [["품명", "규격", "단위", "수량", "단가", "금액"], ["포세린 타일", "600x600", "m2", 100, 26000, 2600000], ["타일 줄눈", "", "m2", 100, 3000, 300000]];
  const s = [["품명", "규격", "단위", "수량", "단가", "금액"], ["포세린 타일", "300x600", "m2", 100, 24000, 2400000], ["타일 줄눈", "", "m2", 100, 3000, 300000]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", c)) }, { id: "s", kind: "settlement", wb: book("s.xlsx", sheet("정산", s)) }]);
  const l = r.links.find((x) => x.a.row === 1);
  ok(!l || l.state === "review", `C6 600x600 ↔ 300x600 → 자동 연결하지 않음(${l ? "확인 필요" : "연결 안 됨"})`);
}

// C7 머리글 칸 안의 줄바꿈("수\n량")
{
  const rows = [["품\n명", "규\n격", "단\n위", "수\n량", "단\n가", "금\n액"], ["석고보드", "9.5T", "장", 200, 6800, 1360000], ["합판", "12T", "장", 30, 15000, 450000], ["실리콘", "", "개", 40, 2400, 96000]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", rows)) }]);
  ok(roleAt(r, "c", 3)?.role === "qty" && roleAt(r, "c", 4)?.role === "unitPrice" && items(r, "c").length === 3, "C7 머리글 칸 안 줄바꿈('수\\n량') → 머리글로 알아봄");
}

// C8 병합 없이 두 줄로 적은 '변경 전 | 변경 후' 묶음 머리글
{
  const rows = [["품명", "규격", "단위", "단가", "변경 전", "", "변경 후", ""], ["", "", "", "", "수량", "금액", "수량", "금액"],
    ["석고보드", "9.5T", "장", 6800, 200, 1360000, 230, 1564000], ["합판", "12T", "장", 15000, 30, 450000, 30, 450000], ["실리콘", "", "개", 2400, 40, 96000, 50, 120000]];
  const r = run([{ id: "c", kind: "change", wb: book("c.xlsx", sheet("변경내역", rows)) }]);
  const cols = r.docs[0].sheets[0].columns.map((c) => `${c.col}:${c.group ?? ""}.${c.role}`).join(" ");
  ok(/4:before\.qty/.test(cols) && /5:before\.amount/.test(cols) && /6:after\.qty/.test(cols) && /7:after\.amount/.test(cols), `C8 병합 없는 두 줄 묶음 머리글 → 변경 전 · 후 열을 나눠 읽음 (${cols})`);
}

// C9 인쇄 쪽 나눔으로 표 중간에 머리글이 다시 나옴 · 빈 줄
{
  const rows = [["품명", "규격", "단위", "수량", "단가", "금액"], ["석고보드", "9.5T", "장", 200, 6800, 1360000], ["합판", "12T", "장", 30, 15000, 450000], [], ["품명", "규격", "단위", "수량", "단가", "금액"], ["실리콘", "", "개", 40, 2400, 96000], ["몰딩", "30x30", "m", 120, 1500, 180000], ["합계", "", "", "", "", 2086000]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", rows)) }]);
  ok(items(r, "c").length === 4 && r.findings.length === 0, `C9 표 중간에 머리글이 다시 나옴 → 항목 4줄, 합계 검산 맞음(결과 ${r.findings.length}건)`);
}

// C10 수량 · 단가 머리글이 사전에 없고 크기도 비슷한 경우(알려진 한계: 곱이 같아 바뀌어도 모름) — 엔진이 결과를 '틀리게 확정'하지 않는지
{
  const rows = [["품명", "규격", "단위", "가", "나", "금액"], ["타일 시공", "", "m2", 120, 85, 10200], ["줄눈", "", "m2", 120, 30, 3600], ["보양", "", "m2", 140, 20, 2800], ["청소", "", "m2", 140, 10, 1400]];
  const r = run([{ id: "c", kind: "contract", wb: book("c.xlsx", sheet("내역", rows)) }]);
  const it = items(r, "c");
  ok(it.length === 4 && r.findings.length === 0 && it.every((l) => (l.qty ?? 0) * (l.unitPrice ?? 0) === l.amount), `C10 수량 · 단가 머리글 없음 → 줄 계산은 맞게 읽음, 틀린 결과 0건(어느 열이 수량인지는 사람이 확인 — 알려진 한계)`);
}

process.exit(fail ? 1 : 0);

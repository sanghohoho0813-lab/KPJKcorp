// 엔진 — 양식 8종의 구조 인식, 오류 종류별 탐지(정답 위치), 틀린 경고 없음, 근거 칸, 재현성, 사람 판단 반영
// 시험 자료는 전부 합성(가상) 현장이다.
import { readXlsx } from "../engine/io/xlsx";
import { analyze } from "../engine/analyze";
import type { AnalyzeResult, DocInput } from "../engine/types";
import pack from "../packs/construction-interior/index";
import { generateCase, type SynthCase } from "../synth/index";
import { BOQ_TEMPLATES } from "../synth/render";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };

async function run(c: SynthCase, extra: Partial<Parameters<typeof analyze>[0]> = {}): Promise<{ res: AnalyzeResult; docs: DocInput[] }> {
  const docs: DocInput[] = [];
  for (const d of c.docs) docs.push({ docId: d.docId, kind: d.kind, round: d.round, workbook: await readXlsx(d.bytes, d.fileName) });
  return { res: analyze({ docs, meta: c.meta, pack, ...extra }), docs };
}

function classify(c: SynthCase, res: AnalyzeResult) {
  let tp = 0, cons = 0, fp = 0;
  const found = new Set<string>();
  const fps: string[] = [];
  for (const f of res.findings) {
    const hit = c.errors.find((e) => e.detector === f.detector && e.check === f.check && f.evidence.some((x) => x.docId === e.docId && x.sheet === e.anchor.sheet && x.row === e.anchor.row));
    if (hit) { tp++; found.add(hit.id); continue; }
    if (c.errors.some((e) => e.consequences.some((q) => q.detector === f.detector && q.check === f.check && f.evidence[0]?.docId === (q.docId ?? e.docId)))) { cons++; continue; }
    fp++; fps.push(`${f.detector}/${f.check}: ${f.message.slice(0, 100)}`);
  }
  return { tp, cons, fp, found, fps };
}

(async () => {
  // 1) 양식마다 깨끗한 현장: 결과 0건, 핵심 열 · 항목 값이 정답과 같다
  for (const t of BOQ_TEMPLATES) {
    const c = generateCase(500 + t.id.charCodeAt(1), { split: "eval", contractTemplate: t.id, inject: false });
    const { res } = await run(c);
    const sh = res.docs[0].sheets.find((s) => s.kind === "detail")!;
    const gt = c.docs[0].gt.find((g) => g.name === sh.sheet)!;
    const colsOk = gt.columns.filter((g) => g.role !== "no" && g.role !== "note").every((g) => sh.columns.some((e) => e.col === g.col && e.role === g.role && e.group === g.group));
    const items = gt.rows.filter((r) => r.kind === "item");
    const valsOk = items.every((r) => { const l = sh.lines.find((x) => x.row === r.row); return l && l.kind === "item" && l.name === r.name && l.qty === r.qty && l.unitPrice === r.unitPrice && l.amount === r.amount; });
    ok(colsOk && valsOk && sh.confidence >= pack.params.confidenceThreshold, `양식 ${t.id}${t.heldOut ? "(개발 중 미사용)" : ""}: 열 ${colsOk ? "맞음" : "틀림"} · 항목 ${items.length}줄 값 ${valsOk ? "맞음" : "틀림"} · 신뢰도 ${sh.confidence}`);
    ok(res.findings.length === 0, `양식 ${t.id} 깨끗한 현장에서 결과 0건 (실제 ${res.findings.length})${res.findings.length ? " — " + res.findings[0].message.slice(0, 80) : ""}`);
  }

  // 2) 오류 종류마다: 정답 위치에서 찾고, 틀린 경고가 없다
  const wanted: [string, string | undefined][] = [["E1", "V1"], ["E1", "V2"], ["E2", "V2"], ["E3", "V1"], ["E3", "V5"], ["E3", "V7"], ["E4", "V1"], ["E4", "V5"], ["E5", "V1"], ["E6", "V3"], ["E7", "V6"], ["E8", undefined], ["E9", undefined], ["E10", undefined], ["E11", undefined], ["E1b", undefined], ["E1c", undefined]];
  for (const [type, tpl] of wanted) {
    let done = false;
    for (let seed = 700; seed < 760 && !done; seed++) {
      const c = generateCase(seed, { split: "eval", contractTemplate: tpl, forceErrors: [type] });
      if (!c.errors.some((e) => e.type === type)) continue;
      done = true;
      const { res } = await run(c);
      const k = classify(c, res);
      const e = c.errors.find((x) => x.type === type)!;
      ok(k.found.has(e.id) && k.fp === 0, `${type}${tpl ? " · " + tpl : ""} (씨앗 ${seed}): 찾음 ${k.found.has(e.id)} · 함께 생긴 결과 ${k.cons} · 틀린 경고 ${k.fp}${k.fps.length ? " — " + k.fps[0] : ""}`);
    }
    ok(done, `${type} 시험 현장을 만들 수 있음`);
  }

  // 3) 근거 칸 = 원본 글자, 재현성(10번 · 문서 순서 뒤집기), 행 지문
  const c = generateCase(42, { split: "dev", forceErrors: ["E1", "E3", "E5"] });
  const { res, docs } = await run(c);
  let evN = 0, evOk = 0;
  for (const f of res.findings) for (const ev of f.evidence) for (const [k, col] of Object.entries(ev.cols)) {
    evN++;
    const sheet = docs.find((d) => d.docId === ev.docId)!.workbook.sheets.find((s) => s.name === ev.sheet)!;
    if ((sheet.rows[ev.row]?.[col]?.v ?? "") === ev.values[k]) evOk++;
  }
  ok(evN > 0 && evOk === evN, `근거 칸 ${evOk}/${evN} 이 원본 파일의 글자와 같음`);
  const j0 = JSON.stringify(res.findings) + JSON.stringify(res.links);
  let same = true;
  for (let i = 0; i < 10; i++) { const r = analyze({ docs: i % 2 ? [...docs].reverse() : docs, meta: c.meta, pack }); if (JSON.stringify(r.findings) + JSON.stringify(r.links) !== j0) same = false; }
  ok(same, "같은 입력 10번(문서 순서 뒤집기 포함) — 결과 글자 하나까지 같음");
  ok(res.versions.engine.length > 0 && res.versions.inputHash.length === 16, "결과에 엔진 판 · 입력 지문");

  // 4) 사람 판단 — 연결 "다르다"는 연결하지 않고, "같다"는 확정 연결
  const c2 = generateCase(9, { split: "dev", inject: false, noSettlement: true });
  const r2 = (await run(c2)).res;
  const first = r2.links.find((l) => l.state === "auto");
  if (first) {
    const r3 = (await run(c2, { decisions: { links: [{ a: first.a.fp, b: first.b.fp, same: false }] } })).res;
    ok(!r3.links.some((l) => l.a.fp === first.a.fp && l.b.fp === first.b.fp), "연결 판단 '다르다' → 그 쌍은 연결하지 않음");
    const other = r2.links.find((l) => l !== first && l.b.docId === first.b.docId);
    if (other) {
      const r4 = (await run(c2, { decisions: { links: [{ a: first.a.fp, b: other.b.fp, same: true }] } })).res;
      ok(r4.links.some((l) => l.a.fp === first.a.fp && l.b.fp === other.b.fp && l.state === "confirmed"), "연결 판단 '같다' → 확정 연결");
    }
  } else ok(false, "연결 판단 시험용 자동 연결이 있음");

  // 5) 열 지정(사람 교정) — 금액 · 단가 열을 바꿔 지정하면 신뢰도가 떨어진다
  const c3 = generateCase(510, { split: "dev", contractTemplate: "V1", inject: false });
  const { docs: d3 } = await run(c3);
  const r5 = analyze({ docs: d3, meta: c3.meta, pack });
  const det = r5.docs[0].sheets.find((s) => s.kind === "detail")!;
  const swapped = det.columns.map((x) => ({ col: x.col, role: x.role === "amount" ? "unitPrice" as const : x.role === "unitPrice" ? "amount" as const : x.role, group: x.group }));
  const r6 = analyze({ docs: d3, meta: c3.meta, pack, decisions: { columns: [{ docId: "contract", sheet: det.sheet, columns: swapped }] } });
  const det6 = r6.docs[0].sheets.find((s) => s.sheet === det.sheet)!;
  ok(det6.columns.every((x) => x.via === "decision") && det6.confidence < pack.params.confidenceThreshold, `틀린 열 지정 → 신뢰도 ${det6.confidence} (문턱 ${pack.params.confidenceThreshold} 미만)`);

  process.exit(fail ? 1 : 0);
})();

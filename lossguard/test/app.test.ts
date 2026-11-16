// 제품 로직(app/) — 현장 · 파일 · 분석 기록 · 사람 판단(판 · 출처) · 회사 규칙 재사용 · 결과 처리 흐름 · 재분석 비교 · 보고서
import { generateCase } from "../synth/index";
import pack from "../packs/construction-interior/index";
import { MemoryRepo } from "../app/store";
import { LossGuardService } from "../app/service";
import { intake } from "../app/ingest";
import { diffIsEmpty, diffRuns } from "../app/diff";
import { linkOrigin, unlinked, candidates } from "../app/analysis";
import { buildReport } from "../app/report";
import { reflectedTotal, WorkflowError } from "../app/workflow";
import { detailItems } from "../engine/analyze";
import type { Clock } from "../app/model";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
let t = 0, n = 0;
const clock: Clock = { now: () => new Date(Date.UTC(2026, 10, 16, 9, 0, t++)).toISOString(), id: () => `id-${String(++n).padStart(4, "0")}` };

async function siteFrom(svc: LossGuardService, seed: number, name: string) {
  const c = generateCase(seed, { split: "dev", inject: true });
  const site = await svc.createSite({ name, status: "completed", contractAmount: c.meta.contractAmount, vat: c.meta.vat, changes: c.meta.changes ?? [] });
  for (const d of c.docs) await svc.addFile(site, await intake(new Uint8Array(d.bytes), d.fileName), d.kind as "contract" | "change" | "settlement", d.round, "시험자");
  return { site, c };
}

(async () => {
  const repo = new MemoryRepo();
  const svc = new LossGuardService(repo, pack, clock);
  // 확인 대기 연결이 있는 합성 현장을 고른다
  let picked: Awaited<ReturnType<typeof siteFrom>> | undefined;
  for (const seed of [4, 5, 6, 7, 8, 9, 11, 12, 13]) {
    const s = await siteFrom(svc, seed, `가상 현장 ${seed}`);
    const r = await svc.analyze(s.site.id, "시험자");
    if (r.view.snapshot.counts.review >= 1 && r.view.result.findings.length >= 1 && s.c.docs.length >= 2) { picked = s; break; }
  }
  ok(!!picked, "확인 대기 연결과 결과가 있는 합성 현장");
  if (!picked) process.exit(1);
  const site = picked.site;
  let d = await svc.load(site.id);
  const run1 = d.runs[d.runs.length - 1];
  ok(d.cases.length === run1.snapshot.findings.length && d.cases.every((c) => c.status === "open" && c.present), `분석 1: 결과 ${d.cases.length}건이 모두 '검토 필요'로 생김`);

  // 같은 입력이면 같은 결과(재분석 일관성)
  const again = await svc.analyze(site.id, "시험자");
  ok(again.diff !== undefined && diffIsEmpty(again.diff) && again.run.inputHash === run1.inputHash, "판단 없이 다시 분석 → 결과 · 연결 · 열 모두 같음");

  // 연결 판단: 확인 대기 → 같다(현장)
  let view = again.view;
  const rv = view.result.links.find((l) => linkOrigin(view, l) === "review")!;
  const lineAt = (docId: string, sheet: string, row: number) => view.result.docs.find((x) => x.docId === docId)!.sheets.find((s) => s.sheet === sheet)!.lines.find((l) => l.row === row)!;
  d = await svc.load(site.id);
  const [j1] = await svc.judgeLink(d, { fileId: rv.a.docId, line: lineAt(rv.a.docId, rv.a.sheet, rv.a.row) }, { fileId: rv.b.docId, line: lineAt(rv.b.docId, rv.b.sheet, rv.b.row) }, true, "김대표", true, "같은 자재(거래처 확인)");
  ok(j1.version === 1 && j1.status === "active" && j1.by === "김대표" && j1.source.siteName === site.name && j1.source.engine.length > 0 && !!j1.source.fileHash, "사람 판단에 확인자 · 시각 · 출처(현장 · 파일 지문 · 엔진 판) 기록");
  const r3 = await svc.analyze(site.id, "김대표");
  view = r3.view;
  const now = view.result.links.find((l) => l.a.fp === rv.a.fp && l.b.fp === rv.b.fp && l.b.docId === rv.b.docId);
  ok(!!now && linkOrigin(view, now) === "person" && now.state === "confirmed", "다시 분석 → 그 연결은 '사람 확인'(자동 판단과 구분)");
  ok(!!r3.diff && r3.diff.links.changed.some((c) => c.before === "review" && c.after === "person"), "재분석 비교: 확인 필요 → 사람 확인 변화가 보임");

  // 자동 연결 거부 → 사라지고 '다르다' 판단으로 남음
  const au = view.result.links.find((l) => linkOrigin(view, l) === "auto")!;
  d = await svc.load(site.id);
  await svc.judgeLink(d, { fileId: au.a.docId, line: lineAt(au.a.docId, au.a.sheet, au.a.row) }, { fileId: au.b.docId, line: lineAt(au.b.docId, au.b.sheet, au.b.row) }, false, "김대표", false);
  const r4 = await svc.analyze(site.id, "김대표");
  ok(!r4.view.result.links.some((l) => l.a.fp === au.a.fp && l.b.fp === au.b.fp) && r4.run.snapshot.counts.rejected >= 1, "자동 연결을 '다르다'로 거부 → 다시 분석하면 그 연결이 없음");

  // 판 올리기 · 거두기: 같은 쌍을 다시 판단하면 2판, 이전 판은 '바뀜'
  d = await svc.load(site.id);
  const [j2] = await svc.judgeLink(d, { fileId: au.a.docId, line: lineAt(au.a.docId, au.a.sheet, au.a.row) }, { fileId: au.b.docId, line: lineAt(au.b.docId, au.b.sheet, au.b.row) }, true, "이실무", false, "다시 보니 같음");
  const all = await repo.listJudgments(site.companyId);
  const hist = all.filter((j) => j.subject === j2.subject);
  ok(j2.version === 2 && hist.length === 2 && hist.some((j) => j.version === 1 && j.status === "superseded"), "같은 대상의 새 판단 → 2판, 1판은 지우지 않고 '새 판으로 바뀜'");
  d = await svc.load(site.id);
  await svc.withdraw(d, j2, "이실무");
  const r5 = await svc.analyze(site.id, "이실무");
  ok(r5.view.result.links.some((l) => l.a.fp === au.a.fp && l.b.fp === au.b.fp && linkOrigin(r5.view, l) === "auto"), "판단을 거두면 다시 자동 판단으로 돌아감(거둔 기록은 남음)");
  ok((await repo.listJudgments(site.companyId)).filter((j) => j.subject === j2.subject).length === 3, "거두기도 판으로 남음(1 바뀜 · 2 바뀜 · 3 거둠)");

  // 열 지정: 수량 ↔ 단가를 일부러 바꿔 지정 → 결과가 바뀌고, 거두면 처음 결과로 돌아감
  const contractDoc = r5.view.result.docs.find((x) => x.kind === "contract")!;
  const sh = contractDoc.sheets.find((s) => s.kind === "detail" && s.columns.some((c) => c.role === "qty") && s.columns.some((c) => c.role === "unitPrice"))!;
  const before = sh.columns.map((c) => ({ col: c.col, role: c.role, group: c.group }));
  const qc = before.find((x) => x.role === "qty")!.col, pc = before.find((x) => x.role === "unitPrice")!.col;
  const swapped = before.map((c) => (c.col === qc ? { ...c, col: pc } : c.col === pc ? { ...c, col: qc } : c));
  d = await svc.load(site.id);
  const jc = await svc.judgeColumns(d, contractDoc.docId, sh.sheet, swapped, before, "김대표", "시험: 일부러 바꿈");
  const r6 = await svc.analyze(site.id, "김대표");
  ok(!!r6.diff && r6.diff.columns.some((c) => c.sheet === sh.sheet), "열 지정을 바꾸면 재분석 비교에 열 변화가 보임");
  const sh6 = r6.view.result.docs.find((x) => x.kind === "contract")!.sheets.find((s) => s.sheet === sh.sheet)!;
  ok(sh6.columns.every((c) => c.via === "decision"), "사람이 지정한 열은 '사람 지정'(via decision)으로 표시");
  d = await svc.load(site.id);
  await svc.withdraw(d, (await repo.listJudgments(site.companyId)).find((j) => j.id === jc.id)!, "김대표");
  const r7 = await svc.analyze(site.id, "김대표");
  ok(!!r7.diff && diffRuns(r5.run.snapshot, r7.run.snapshot).findings.added.length === 0 && diffRuns(r5.run.snapshot, r7.run.snapshot).findings.removed.length === 0 && diffRuns(r5.run.snapshot, r7.run.snapshot).columns.length === 0, "열 지정을 거두면 결과가 그 전 분석과 같아짐");
  const casesNow = await repo.listCases(site.id);
  ok(casesNow.some((c) => c.history.some((h) => h.type === "auto" && /나오지 않음|다시 나타남/.test(h.text ?? ""))) || r6.diff!.findings.added.length + r6.diff!.findings.removed.length === 0, "결과가 사라지거나 다시 나오면 사건 기록에 자동으로 남음");

  // 결과 처리 흐름
  const key = r7.view.result.findings[0].key;
  let threw = 0;
  for (const [to, s] of [["confirmed", { by: "김대표" }], ["checking", { by: " " }]] as const) { try { await svc.step(site.id, key, to, s); } catch (e) { if (e instanceof WorkflowError) threw++; } }
  ok(threw === 2, "건너뛰기(검토 필요 → 실제 문제) · 확인자 없음은 거절");
  await svc.step(site.id, key, "checking", { by: "이실무" });
  await svc.step(site.id, key, "confirmed", { by: "김대표", note: "계산 오류 맞음" });
  try { await svc.step(site.id, key, "action", { by: "김대표" }); } catch (e) { if (e instanceof WorkflowError) threw++; }
  await svc.step(site.id, key, "action", { by: "김대표", action: "발주처에 정정 요청" });
  try { await svc.step(site.id, key, "done", { by: "김대표" }); } catch (e) { if (e instanceof WorkflowError) threw++; }
  ok(threw === 4, "조치 내용 없이 '조치' · 반영 금액 입력 없이 '완료'는 거절");
  ok(reflectedTotal(await repo.listCases(site.id)).total === null, "반영 금액을 입력하기 전에는 반영 금액 합계가 없음(임의로 만들지 않음)");
  const done = await svc.step(site.id, key, "done", { by: "김대표", reflected: { amount: 120000, note: "정정 견적서 수령" } });
  ok(done.status === "done" && done.history.filter((h) => h.type === "status").length === 4 && done.reflected?.amount === 120000, "검토 필요 → 확인 중 → 실제 문제 → 조치 → 완료, 이력 4단계 · 반영 금액 기록");
  ok(reflectedTotal(await repo.listCases(site.id)).total === 120000, "반영 금액 합계 = 사용자가 입력한 값만");

  // 보고서
  d = await svc.load(site.id);
  const last = d.runs[d.runs.length - 1];
  const rep = buildReport(d.site, d.files, last, svc.preview(d, last.judgmentIds), d.cases, d.judgments, clock.now());
  const text = JSON.stringify(rep);
  ok(rep.items.length === last.snapshot.findings.length && rep.reflected.total === 120000 && rep.limits.length >= 3, "보고서: 결과 · 반영 금액(입력값) · 한계 고지");
  ok(!/손실이 확정|손실 확정됨|절감 성과|받을 돈 \d/.test(text) && /손실이나 받을 돈을 확정하지 않습니다/.test(text), "보고서에 손실 확정 · 절감 성과 표현 없음");
  ok(rep.judgments.length >= 4 && rep.judgments.some((j) => j.scope === "회사 규칙"), "보고서에 사람 판단 기록(판 · 출처 · 범위)");

  // 회사 규칙 재사용: 같은 회사의 다른 현장(같은 파일을 새 현장으로) — 현장 판단 없이 규칙으로 연결
  const s2 = await svc.createSite({ name: "가상 현장 B", status: "completed", contractAmount: site.contractAmount, vat: site.vat, changes: site.changes });
  for (const f of d.files.filter((x) => x.active)) await svc.addFile(s2, { fileName: f.fileName, size: f.size, sha256: f.sha256, format: f.format, workbook: d.books.get(f.id)!, pii: { fileName: f.fileName, level: "none", counts: {}, hits: [] } }, f.kind, f.round, "시험자");
  const r8 = await svc.analyze(s2.id, "시험자");
  const ruled = r8.view.result.links.filter((l) => linkOrigin(r8.view, l) === "rule");
  ok(r8.view.rules.applied.length >= 1 && ruled.length >= 1, `다른 현장에서 회사 규칙으로 연결(규칙 적용 ${r8.view.rules.applied.length}건 · '회사 규칙' 연결 ${ruled.length}건)`);
  ok(ruled.every((l) => l.state === "confirmed"), "회사 규칙 연결은 자동 연결과 구분(confirmed · 출처 회사 규칙)");

  // 연결 안 됨 · 후보
  const u = unlinked(r8.view.result).find((x) => x.other.length);
  if (u) {
    const contract = r8.view.result.docs.find((x) => x.kind === "contract")!;
    const cs = candidates(u.other[0], detailItems(contract), pack, 3);
    ok(cs.length === 3 && cs[0].score >= cs[1].score && cs[1].score >= cs[2].score, "연결 안 된 줄에 후보 3개(점수 순)를 보여 줄 수 있음");
  } else ok(true, "연결 안 된 줄 없음(후보 시험 생략)");

  process.exit(fail ? 1 : 0);
})();

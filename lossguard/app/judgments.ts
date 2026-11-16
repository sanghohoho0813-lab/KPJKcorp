import type { ColumnDecision, Decisions, IndustryPack, Line, LinkDecision } from "../engine/types";
import { makeNormalizer } from "../engine/normalize/name";
import type { Clock, Judgment, JudgmentPayload, LineSnap, Site } from "./model";

/**
 * 사람 판단 — 만들기 · 판 올리기 · 거두기 · 엔진 입력으로 바꾸기.
 * 판단은 지우지 않는다: 같은 대상(subject)에 새 판단을 내리면 이전 판은 "superseded", 거두면 "withdrawn" 으로 남는다.
 */

/** 회사 규칙의 이름 열쇠 — 품명(같은 뜻 낱말 정리) · 규격 숫자 · 단위. 업종 묶음의 정규화를 그대로 쓴다 */
export function nameKey(pack: IndustryPack, name: string, spec: string, unit: string): string {
  const n = makeNormalizer(pack).name(name, spec, unit);
  return `${n.canon}|${n.specNums.join(",")}|${n.unit}`;
}

export function subjectOf(p: JudgmentPayload): string {
  if (p.type === "column") return `column|${p.fileId}|${p.sheet}`;
  if (p.type === "link") return `link|${p.a.fp}|${p.b.fp}`;
  return `rule|${p.aKey}|${p.bKey}`;
}

export function lineSnap(fileId: string, l: Line): LineSnap {
  return { fileId, sheet: l.sheet, row: l.row, fp: l.fp, name: l.name, spec: l.spec, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, amount: l.amount };
}

/** 새 판단 — 같은 대상의 이전 판(active)은 superseded 로 바꾼 목록과 함께 돌려준다 */
export function addJudgment(
  all: Judgment[], site: Site, payload: JudgmentPayload, scope: Judgment["scope"], by: string, source: Judgment["source"], clock: Clock, note?: string,
): { judgment: Judgment; superseded: Judgment[] } {
  if (!by.trim()) throw new Error("확인자 이름을 적어 주세요(누가 판단했는지 남깁니다).");
  const subject = subjectOf(payload);
  const same = all.filter((j) => j.subject === subject && j.companyId === site.companyId && (scope === "company" || j.siteId === site.id));
  const version = same.reduce((m, j) => Math.max(m, j.version), 0) + 1;
  const superseded = same.filter((j) => j.status === "active").map((j) => ({ ...j, status: "superseded" as const }));
  const judgment: Judgment = { id: clock.id(), companyId: site.companyId, siteId: site.id, scope, subject, version, status: "active", payload, by: by.trim(), at: clock.now(), note, source };
  return { judgment, superseded };
}

export function withdraw(j: Judgment): Judgment { return { ...j, status: "withdrawn" }; }

/** 이 현장의 분석에 쓰는 판단: 이 현장의 현장 판단 + 회사의 회사 규칙(활성만) */
export function activeFor(all: Judgment[], site: Site): { site: Judgment[]; rules: Judgment[] } {
  const act = all.filter((j) => j.status === "active" && j.companyId === site.companyId);
  return { site: act.filter((j) => j.scope === "site" && j.siteId === site.id), rules: act.filter((j) => j.scope === "company" && j.payload.type === "nameRule") };
}

/** 현장 판단 → 엔진 입력(열 지정 · 연결 같다/다르다) */
export function siteDecisions(js: Judgment[]): Decisions {
  const columns: ColumnDecision[] = [];
  const links: LinkDecision[] = [];
  for (const j of js) {
    const p = j.payload;
    if (p.type === "column") columns.push({ docId: p.fileId, sheet: p.sheet, columns: p.columns });
    else if (p.type === "link") links.push({ a: p.a.fp, b: p.b.fp, same: p.same });
  }
  // 같은 결과를 위해 순서를 고정한다(판단을 내린 순서와 무관)
  links.sort((x, y) => (x.a + x.b < y.a + y.b ? -1 : x.a + x.b > y.a + y.b ? 1 : 0));
  columns.sort((x, y) => (x.docId + x.sheet < y.docId + y.sheet ? -1 : 1));
  return { columns, links };
}

import type { CaseEvent, CaseStatus, Clock, FindingCase, FindingSnap, RunSnapshot } from "./model";
import { STATUS } from "./explain";

/**
 * 결과 처리 흐름 — 검토 필요 → 확인 중 → (실제 문제 확인 · 문제 아님 · 판단 보류) → 조치 → 완료.
 * 모든 단계는 확인자 이름을 남긴다. 기록은 지우지 않고 덧붙인다.
 */
export class WorkflowError extends Error {}

export const NEXT: Record<CaseStatus, CaseStatus[]> = {
  open: ["checking"],
  checking: ["confirmed", "not_issue", "on_hold"],
  on_hold: ["checking"],
  confirmed: ["action"],
  not_issue: ["done", "checking"],
  action: ["done"],
  done: ["checking"],
};

export interface StepInput { by: string; note?: string; action?: string; reflected?: { amount: number | null; note: string } }

export function transition(c: FindingCase, to: CaseStatus, s: StepInput, clock: Clock): FindingCase {
  const by = s.by.trim();
  if (!by) throw new WorkflowError("확인자 이름을 적어 주세요.");
  if (!NEXT[c.status].includes(to)) throw new WorkflowError(`'${STATUS[c.status].label}'에서 '${STATUS[to].label}'(으)로 바로 갈 수 없습니다.`);
  if (to === "not_issue" && !s.note?.trim()) throw new WorkflowError("문제가 아니라고 본 이유를 적어 주세요(예: 네고 금액, 다음 회차 청구 예정).");
  if (to === "on_hold" && !s.note?.trim()) throw new WorkflowError("보류하는 이유를 적어 주세요(예: 발주처 자료 필요).");
  if (to === "action" && !s.action?.trim()) throw new WorkflowError("어떤 조치를 하는지 적어 주세요(예: 발주처에 변경 정산 요청).");
  if (to === "done" && c.status === "action" && !s.reflected) throw new WorkflowError("실제 반영 금액을 적거나 '반영 금액 없음'을 골라 주세요.");
  if (to === "checking" && c.status === "done" && !s.note?.trim()) throw new WorkflowError("다시 여는 이유를 적어 주세요.");
  if (s.reflected && s.reflected.amount !== null && (!Number.isFinite(s.reflected.amount) || s.reflected.amount < 0)) throw new WorkflowError("반영 금액은 0 이상의 숫자로 적어 주세요.");
  const at = clock.now();
  const events: CaseEvent[] = [{ at, by, type: "status", from: c.status, to, text: s.note?.trim() || undefined }];
  const next: FindingCase = { ...c, status: to };
  if (s.action?.trim()) { next.action = s.action.trim(); events.push({ at, by, type: "action", text: next.action }); }
  if (s.reflected) {
    next.reflected = { amount: s.reflected.amount, note: s.reflected.note.trim(), by, at };
    events.push({ at, by, type: "reflected", amount: s.reflected.amount, text: s.reflected.note.trim() || undefined });
  }
  next.history = [...c.history, ...events];
  return next;
}

export function addNote(c: FindingCase, by: string, text: string, clock: Clock): FindingCase {
  if (!by.trim()) throw new WorkflowError("확인자 이름을 적어 주세요.");
  if (!text.trim()) throw new WorkflowError("메모를 적어 주세요.");
  return { ...c, history: [...c.history, { at: clock.now(), by: by.trim(), type: "note", text: text.trim() }] };
}

/**
 * 분석 결과가 바뀐 뒤 사건 목록 맞추기 — 새 결과는 "검토 필요"로 만들고, 사라진 결과는 상태를 그대로 두고 "이번 분석에 없음"을 기록한다.
 * 결과 열쇠는 행 번호를 쓰지 않으므로 행이 밀려도 같은 결과로 이어진다.
 */
export function reconcile(cases: FindingCase[], siteId: string, snap: RunSnapshot, runNo: number, clock: Clock): FindingCase[] {
  const byKey = new Map(cases.filter((c) => c.siteId === siteId).map((c) => [c.key, c]));
  const now = clock.now();
  const out: FindingCase[] = [];
  const present = new Set<string>();
  for (const f of snap.findings) {
    present.add(f.key);
    const c = byKey.get(f.key);
    if (!c) { out.push(newCase(siteId, f, runNo, now)); continue; }
    const ev: CaseEvent[] = c.present ? [] : [{ at: now, by: "자동", type: "auto", text: `${runNo}번째 분석에서 다시 나타남` }];
    out.push({ ...c, present: true, lastRun: runNo, snapshot: f, history: [...c.history, ...ev] });
  }
  for (const c of byKey.values()) {
    if (present.has(c.key)) continue;
    out.push(c.present ? { ...c, present: false, history: [...c.history, { at: now, by: "자동", type: "auto", text: `${runNo}번째 분석에서 나오지 않음(열 지정 · 연결 판단 · 자료가 바뀐 뒤)` }] } : c);
  }
  return out;
}

function newCase(siteId: string, f: FindingSnap, runNo: number, at: string): FindingCase {
  return { siteId, key: f.key, status: "open", history: [{ at, by: "자동", type: "auto", text: `${runNo}번째 분석에서 처음 나옴` }], firstRun: runNo, lastRun: runNo, present: true, snapshot: f };
}

/** 사용자가 입력한 실제 반영 금액의 합 — 입력이 없으면 null(임의로 만들지 않는다) */
export function reflectedTotal(cases: FindingCase[]): { total: number | null; entered: number; noneChosen: number } {
  let total = 0, entered = 0, noneChosen = 0;
  for (const c of cases) {
    if (!c.reflected) continue;
    if (c.reflected.amount === null) { noneChosen++; continue; }
    total += c.reflected.amount; entered++;
  }
  return { total: entered ? total : null, entered, noneChosen };
}

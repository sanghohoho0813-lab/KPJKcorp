import type { Consultation, DocumentRequest, Task } from "./types";
import { guessTaskType } from "./quick-task";

/**
 * 상담 기록 → 후속 업무 · 자료 요청.
 * 상담에서 정한 것(다음 Action · 우리가 약속한 것 · 필요 자료)이 업무로 넘어가지 않으면 결국 기억에 의존한다.
 * 한 번 만든 것은 다시 만들지 않는다 — 업무는 ruleKey("cs:상담id:종류:글자지문"), 자료는 같은 이름의 열린 요청으로 가린다.
 */
export type FollowKind = "next" | "promise" | "doc";
export interface FollowItem {
  /** 화면 체크박스 열쇠 = 업무 ruleKey (자료는 같은 규칙으로 만든 열쇠) */
  key: string;
  kind: FollowKind;
  text: string;
  /** 업무일 때 고른 유형 */
  type?: Task["type"];
  /** 이미 만들어져 있음 — 다시 만들지 않는다 */
  done: boolean;
}

/** 글자 지문 — 같은 문장이면 같은 열쇠 (띄어쓰기 차이는 무시) */
export function textHash(s: string): string {
  let h = 5381;
  for (const ch of s.replace(/\s+/g, "")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
export const followKey = (consultationId: string, kind: FollowKind, text: string) => `cs:${consultationId}:${kind}:${textHash(text)}`;
export const isConsultTask = (t: Pick<Task, "ruleKey">) => !!t.ruleKey?.startsWith("cs:");

/** 상담 요약에서 만들 수 있는 후속 항목. consultationId가 없으면(새 기록) 아직 만든 것이 없다 */
export function followItems(
  summary: Pick<Consultation["summary"], "nextAction" | "promises" | "documents">,
  consultationId: string | undefined,
  ctx: { tasks: Pick<Task, "ruleKey">[]; docRequests: Pick<DocumentRequest, "companyId" | "name" | "status">[]; companyId: string },
): FollowItem[] {
  const id = consultationId ?? "new";
  const made = new Set(consultationId ? ctx.tasks.map((t) => t.ruleKey).filter(Boolean) as string[] : []);
  const norm = (s: string) => s.replace(/\s+/g, "");
  const openDoc = (name: string) => ctx.docRequests.some((d) => d.companyId === ctx.companyId && d.status !== "done" && norm(d.name) === norm(name));
  const out: FollowItem[] = [];
  const seen = new Set<string>();
  const push = (kind: FollowKind, raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const key = followKey(id, kind, text);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, kind, text, type: kind === "doc" ? undefined : guessTaskType(text) === "기타" ? "후속연락" : guessTaskType(text), done: kind === "doc" ? openDoc(text) : made.has(key) });
  };
  push("next", summary.nextAction ?? "");
  for (const p of summary.promises ?? []) push("promise", p);
  for (const d of summary.documents ?? []) push("doc", d);
  return out;
}

/** 처음 열었을 때 체크 상태 — 업무는 켜 두고, 고객에게 알림이 가는 자료 요청은 꺼 둔다(직접 고른다) */
export const defaultPicked = (it: FollowItem) => !it.done && it.kind !== "doc";

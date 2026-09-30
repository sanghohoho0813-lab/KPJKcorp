import type { JournalType } from "./types";

/**
 * 업무 일기 — 기업마다 쌓이는 내부 기록. 고객에게는 보이지 않는다.
 * "할 일"은 따로 두지 않는다 — 기한이 있는 일은 업무함(업무 등록)으로 보내 한 곳에서 챙긴다.
 */
export const JOURNAL_TYPE: Record<JournalType, { label: string; placeholder: string; tone: "neutral" | "error" | "success" | "info" }> = {
  note: { label: "메모", placeholder: "무슨 일이 있었나요?", tone: "neutral" },
  call: { label: "통화", placeholder: "누구와 통화했고 무엇을 정했나요?", tone: "info" },
  decision: { label: "결정", placeholder: "무엇을, 왜 그렇게 결정했나요?", tone: "neutral" },
  blocker: { label: "막힘", placeholder: "무엇이 막혀 있고 누가 풀 수 있나요?", tone: "error" },
  win: { label: "성과", placeholder: "무엇이 잘 됐나요?", tone: "success" },
  idea: { label: "아이디어", placeholder: "다음에 제안해 볼 것", tone: "neutral" },
};
export const JOURNAL_ORDER: JournalType[] = ["note", "call", "decision", "blocker", "win", "idea"];

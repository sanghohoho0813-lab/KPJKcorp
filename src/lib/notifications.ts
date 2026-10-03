import type { Notification } from "./types";

/**
 * 이 사람에게 안 읽은 알림인가.
 * 내부 알림은 계정마다 따로 센다(대표가 읽어도 담당 컨설턴트·직원에게는 남는다).
 * 고객 알림은 회사 단위 — 그 회사 계정이 읽으면 읽음.
 */
export function isUnreadFor(n: Notification, userId?: string): boolean {
  if (n.read) return false;
  if (n.audience === "internal") return !(userId && n.readBy?.includes(userId));
  return true;
}

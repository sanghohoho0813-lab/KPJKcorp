import type { Activity, User } from "./types";
import { daysSince } from "./contact";

/**
 * 고객 Portal 사용 — 자료 제출 · 경과 보고 · 확인은 고객이 Portal 을 써야 돈다.
 * 기업마다 담당자 계정이 있는지, 들어와 본 적이 있는지, 최근에 들어왔는지를 기록(고객 Portal 접속 · 마지막 로그인)으로만 본다.
 */
export type PortalUse = "none" | "never" | "stale" | "active";
export interface PortalUsage { state: PortalUse; lastAt?: string; days?: number }

/** 이만큼 안 들어오면 '쓰지 않는' 것으로 본다 */
export const PORTAL_STALE_DAYS = 30;

export function portalUsage(companyId: string, users: Pick<User, "role" | "companyId" | "active" | "lastLoginAt">[], activities: Pick<Activity, "type" | "companyId" | "at">[], now = new Date()): PortalUsage {
  const accounts = users.filter((u) => u.role === "client" && u.companyId === companyId && u.active !== false);
  if (!accounts.length) return { state: "none" };
  let last: string | undefined;
  for (const a of activities) if (a.type === "portal_login" && a.companyId === companyId && (!last || a.at > last)) last = a.at;
  for (const u of accounts) if (u.lastLoginAt && (!last || u.lastLoginAt > last)) last = u.lastLoginAt;
  if (!last) return { state: "never" };
  const days = daysSince(last, now);
  return { state: days >= PORTAL_STALE_DAYS ? "stale" : "active", lastAt: last, days };
}

export function portalUseLabel(u: PortalUsage): string {
  if (u.state === "none") return "포털 계정 없음";
  if (u.state === "never") return "포털 접속 전";
  if (u.state === "stale") return `포털 ${u.days}일 미접속`;
  return "포털 사용 중";
}

/** 챙길 순서 — 계정 없음 → 접속 전 → 오래 안 들어온 순 */
export function portalUseRank(u: PortalUsage): number {
  return u.state === "none" ? 100000 : u.state === "never" ? 90000 : u.state === "stale" ? (u.days ?? 0) : -1;
}

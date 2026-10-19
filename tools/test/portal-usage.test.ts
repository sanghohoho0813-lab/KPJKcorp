// 고객 Portal 사용 — 계정 없음 · 접속 전 · 30일 넘게 안 들어옴 · 사용 중. 기업·계정은 지어낸 것.
import { PORTAL_STALE_DAYS, portalUsage, portalUseLabel, portalUseRank } from "../../src/lib/portal-usage";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fail++; };
const now = new Date(2026, 9, 19, 10, 0);
const at = (d: number) => new Date(2026, 9, 19 + d, 9).toISOString();
const users = [
  { role: "client" as const, companyId: "a" },
  { role: "client" as const, companyId: "b" },
  { role: "client" as const, companyId: "c", lastLoginAt: at(-40) },
  { role: "client" as const, companyId: "d", active: false },
  { role: "consultant" as const, companyId: undefined },
];
const acts = [
  { type: "portal_login" as const, companyId: "a", at: at(-3) },
  { type: "portal_login" as const, companyId: "a", at: at(-50) },
  { type: "document_uploaded" as const, companyId: "b", at: at(-1) },
];
const a = portalUsage("a", users, acts, now);
ok(a.state === "active" && a.days === 3, "최근 접속(3일 전) → 사용 중");
ok(portalUsage("b", users, acts, now).state === "never", "계정은 있지만 접속 기록 없음 → 접속 전 (다른 기록은 접속이 아님)");
const c = portalUsage("c", users, acts, now);
ok(c.state === "stale" && c.days === 40 && portalUseLabel(c) === "포털 40일 미접속", `마지막 로그인 40일 전 → ${PORTAL_STALE_DAYS}일 넘게 미접속`);
ok(portalUsage("d", users, acts, now).state === "none", "사용 중지 계정만 있으면 계정 없음");
ok(portalUsage("z", users, acts, now).state === "none" && portalUseLabel({ state: "none" }) === "포털 계정 없음", "계정 없음");
ok(portalUseRank({ state: "none" }) > portalUseRank({ state: "never" }) && portalUseRank({ state: "never" }) > portalUseRank(c) && portalUseRank(c) > portalUseRank(a), "챙길 순서: 계정 없음 → 접속 전 → 오래 안 들어온 순 → 사용 중");

console.log(fail ? `\n${fail} FAIL` : "\nALL OK");
process.exit(fail ? 1 : 0);

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { LossGuardService } from "../../app/service";
import type { Repo } from "../../app/store";
import pack from "../../packs/construction-interior/index";

/** 화면 전체가 쓰는 것: 제품 동작(service) · 확인자 이름 · 화면 이동 · 알림 */
export type Route = { page: "home" } | { page: "site"; id: string; tab?: string } | { page: "rules" };

interface Ctx {
  svc: LossGuardService;
  persistent: boolean;
  user: string;
  setUser: (s: string) => void;
  route: Route;
  go: (r: Route) => void;
  toast: (msg: string, tone?: "info" | "error" | "success") => void;
  toasts: { id: number; msg: string; tone: string }[];
}
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error("앱 문맥 없음"); return c; };

function parse(hash: string): Route {
  const [p, id, tab] = hash.replace(/^#\/?/, "").split("/");
  if (p === "site" && id) return { page: "site", id, tab };
  if (p === "rules") return { page: "rules" };
  return { page: "home" };
}
const toHash = (r: Route) => (r.page === "site" ? `#/site/${r.id}${r.tab ? "/" + r.tab : ""}` : r.page === "rules" ? "#/rules" : "#/");

/** 확인자 이름은 이 브라우저의 편의 기능으로만 기억한다(저장 실패해도 동작) */
const USER_KEY = "lossguard-demo-user";
const readUser = () => { try { return localStorage.getItem(USER_KEY) ?? ""; } catch { return ""; } };

export function AppProvider({ repo, persistent, children }: { repo: Repo; persistent: boolean; children: ReactNode }) {
  const [svc] = useState(() => new LossGuardService(repo, pack));
  const [user, setUserState] = useState(readUser);
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  const [toasts, setToasts] = useState<Ctx["toasts"]>([]);
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const setUser = useCallback((s: string) => { setUserState(s); try { localStorage.setItem(USER_KEY, s); } catch { /* 저장 못 해도 됨 */ } }, []);
  const go = useCallback((r: Route) => { location.hash = toHash(r); setRoute(r); scrollTo(0, 0); }, []);
  const toast = useCallback((msg: string, tone: "info" | "error" | "success" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);
  return <C.Provider value={{ svc, persistent, user, setUser, route, go, toast, toasts }}>{children}</C.Provider>;
}

export const won = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`);
export const num = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? "" : Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 3 }));
export const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
export function colLetter(c: number): string { let s = ""; let n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

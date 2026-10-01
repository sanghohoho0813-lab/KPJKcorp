/**
 * 지원사업 공고 — 브라우저 쪽 불러오기·남기기.
 * 공고는 (1) 서버에 저장된 것(담당자가 불러오거나 직접 추가) + (2) 기업마당 실시간(서버 경로 /api/programs, 키가 있을 때)을 합친다.
 * 가망고객은 로그인 없이 남긴다 — 서버 모드면 바로 leads 표에, 데모 모드면 이 브라우저에.
 */
import type { Lead, SupportProgram } from "./types";
import { supa } from "./server/client";
import * as M from "./server/rows";

export type LiveStatus = "ok" | "not_configured" | "error" | "loading";

export async function fetchBizinfo(fresh = false): Promise<{ status: LiveStatus; items: SupportProgram[] }> {
  try {
    const res = await fetch(`/api/programs${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
    const j = (await res.json()) as { ok: boolean; reason?: string; items?: SupportProgram[] };
    if (j.ok && j.items) return { status: "ok", items: j.items };
    return { status: j.reason === "not_configured" ? "not_configured" : "error", items: [] };
  } catch {
    return { status: "error", items: [] };
  }
}

const today = () => new Date().toISOString().slice(0, 10);
/** 끝난 공고는 담지 않는다 */
export const openOnly = (xs: SupportProgram[]) => xs.filter((p) => !p.applyEnd || p.applyEnd >= today());

/** 로그인 없이 보는 화면용 — 서버에 저장된 공고 + 기업마당 실시간 */
export async function loadPublicPrograms(local: SupportProgram[]): Promise<{ programs: SupportProgram[]; live: LiveStatus }> {
  let base = local;
  const sb = supa();
  if (sb) {
    const { data } = await sb.from("support_programs").select("*");
    if (data) base = (data as Record<string, unknown>[]).map(M.programFromRow);
  }
  const live = await fetchBizinfo();
  const ids = new Set(base.map((p) => p.id));
  return { programs: openOnly([...base, ...live.items.filter((p) => !ids.has(p.id))]), live: live.status };
}

/** 가망고객 남기기 — 서버면 leads 표에 바로(서버가 담당자 알림·업무를 만든다) */
export async function submitLeadServer(lead: Lead): Promise<{ ok: boolean; reason?: string }> {
  const sb = supa();
  if (!sb) return { ok: false, reason: "no_server" };
  const row = M.leadToRow(lead);
  let { error } = await sb.from("leads").insert(row);
  // 링크의 담당자 표시가 틀렸으면(지워진 계정 등) 담당자 없이 다시
  if (error?.code === "23503") ({ error } = await sb.from("leads").insert({ ...row, ref_user: null }));
  return error ? { ok: false, reason: error.message } : { ok: true };
}

const LAST_SYNC = "kpjk-programs-sync";
export function lastSync(): string | null { try { return window.localStorage.getItem(LAST_SYNC); } catch { return null; } }
export function markSynced() { try { window.localStorage.setItem(LAST_SYNC, new Date().toISOString()); } catch { /* 저장소 막힘 */ } }

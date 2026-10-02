import { bizinfoItems, normalizeBizinfo } from "@/lib/programs";
import type { SupportProgram } from "@/lib/types";

/**
 * 기업마당 지원사업 공고 받기 — 서버(경로 처리기)에서만 쓴다. 인증키(BIZINFO_API_KEY)는 브라우저로 나가지 않는다.
 * 최근 등록 1000건을 받아 이미 마감된 공고는 뺀다. 같은 서버 인스턴스에서는 30분 동안 받은 것을 다시 쓴다.
 */
const TTL = 30 * 60 * 1000;
const FETCH_COUNT = 1000;
let cache: { at: number; items: SupportProgram[] } | null = null;

/** 한국 날짜(YYYY-MM-DD) — Vercel 서버 시계는 UTC 다 */
const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export type BizinfoResult =
  | { ok: true; items: SupportProgram[]; cachedAt: string }
  | { ok: false; reason: "not_configured" | "upstream" | "bad_format" | "empty" | "unreachable"; status?: number };

export async function getBizinfo(fresh: boolean): Promise<BizinfoResult> {
  const key = process.env.BIZINFO_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" };
  // 누구나 부를 수 있는 주소라 "새로 받기"도 1분에 한 번까지만 기업마당에 간다(인증키 호출 한도 보호)
  const wantFresh = fresh && (!cache || Date.now() - cache.at > 60_000);
  if (cache && !wantFresh && Date.now() - cache.at < TTL) return { ok: true, items: cache.items, cachedAt: new Date(cache.at).toISOString() };
  // BIZINFO_API_BASE 는 시험용(가짜 기업마당 서버)일 때만 넣는다. 운영에서는 비워 둔다
  const base = process.env.BIZINFO_API_BASE || "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";
  const url = `${base}?crtfcKey=${encodeURIComponent(key)}&dataType=json&searchCnt=${FETCH_COUNT}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000), cache: "no-store" });
    if (!res.ok) return { ok: false, reason: "upstream", status: res.status };
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { return { ok: false, reason: "bad_format" }; }
    const now = new Date().toISOString();
    const today = todayKst();
    const items = bizinfoItems(body).map((x) => normalizeBizinfo(x, now)).filter((x): x is SupportProgram => !!x && (!x.applyEnd || x.applyEnd >= today));
    if (!items.length) return { ok: false, reason: "empty" };
    cache = { at: Date.now(), items };
    return { ok: true, items, cachedAt: now };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

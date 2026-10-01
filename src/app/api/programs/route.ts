import { bizinfoItems, normalizeBizinfo } from "@/lib/programs";
import type { SupportProgram } from "@/lib/types";

/**
 * 기업마당 지원사업 공고를 받아 앱 모양으로 돌려준다.
 * 인증키(BIZINFO_API_KEY)는 서버에만 있다 — 브라우저로 나가지 않는다. Vercel 환경변수에 넣는다(NEXT_PUBLIC_ 아님).
 * 키가 없으면 지어낸 공고를 주지 않고 "연결 안 됨"을 알린다.
 * 같은 서버 인스턴스에서는 30분 동안 받은 것을 다시 쓴다(기업마당 호출 횟수 줄이기).
 */
let cache: { at: number; items: SupportProgram[] } | null = null;
const TTL = 30 * 60 * 1000;

export async function GET(request: Request) {
  const key = process.env.BIZINFO_API_KEY;
  if (!key) return Response.json({ ok: false, reason: "not_configured" });
  // 누구나 부를 수 있는 주소라 "새로 받기"도 1분에 한 번까지만 기업마당에 간다(인증키 호출 한도 보호)
  const fresh = new URL(request.url).searchParams.get("fresh") === "1" && (!cache || Date.now() - cache.at > 60_000);
  if (cache && !fresh && Date.now() - cache.at < TTL) return Response.json({ ok: true, items: cache.items, cachedAt: new Date(cache.at).toISOString() });
  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${encodeURIComponent(key)}&dataType=json&searchCnt=300`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) return Response.json({ ok: false, reason: "upstream", status: res.status });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { return Response.json({ ok: false, reason: "bad_format" }); }
    const now = new Date().toISOString();
    const items = bizinfoItems(body).map((x) => normalizeBizinfo(x, now)).filter((x): x is SupportProgram => !!x);
    if (!items.length) return Response.json({ ok: false, reason: "empty" });
    cache = { at: Date.now(), items };
    return Response.json({ ok: true, items, cachedAt: now });
  } catch {
    return Response.json({ ok: false, reason: "unreachable" });
  }
}

import { createClient } from "@supabase/supabase-js";
import { getBizinfo } from "@/lib/server/bizinfo";

/**
 * 지원사업 공고 서버 저장 — 매일 아침 9시(Vercel Cron, vercel.json) + 담당자의 "기업마당에서 불러오기".
 *
 * 기업마당에서 받아 Supabase 의 kpjk_sync_programs 함수로 넣는다. 관리자 키(service_role)는 쓰지 않는다 —
 * "공고 저장 전용 열쇠"(CRON_SECRET)로만 그 함수 하나를 부를 수 있다(setup.sql). 바뀐 공고만 고친다.
 *
 * 부를 수 있는 쪽: Vercel Cron(Authorization: Bearer CRON_SECRET) 또는 로그인한 대표·컨설턴트(자기 로그인 토큰).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return Response.json({ ok: false, reason: "no_server" });
  if (!secret) return Response.json({ ok: false, reason: "no_sync_key" });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const fromCron = token === secret;
  if (!fromCron) {
    // 로그인한 내부 직원인지 — 그 사람 토큰으로 권한 함수를 불러 본다
    if (!token) return Response.json({ ok: false, reason: "forbidden" }, { status: 401 });
    const asUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: internal } = await asUser.rpc("kpjk_is_internal");
    if (internal !== true) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const r = await getBizinfo(true);
  if (!r.ok) return Response.json(r);
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  // 한 번에 수천 건을 보내면 요청이 너무 커진다 — 500건씩 나눠 넣는다
  let added = 0, updated = 0;
  for (let i = 0; i < r.items.length; i += 500) {
    const { data, error } = await sb.rpc("kpjk_sync_programs", { p_key: secret, p_items: r.items.slice(i, i + 500) });
    if (error) return Response.json({ ok: false, reason: error.code === "42501" ? "key_mismatch" : "db", detail: error.message, added, updated });
    const out = data as { added: number; updated: number };
    added += out.added; updated += out.updated;
  }
  return Response.json({ ok: true, total: r.items.length, added, updated, by: fromCron ? "cron" : "staff" });
}

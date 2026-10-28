"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchBizinfo, openOnly } from "@/lib/programs-client";
import type { SupportProgram } from "@/lib/types";

/**
 * 고객 화면의 공고 목록 — 지원사업 화면과 같은 방식(서버에 기업마당 공고가 있으면 그것, 없으면 기업마당 실시간).
 * all: 마감된 공고까지(직접 준비하던 공고가 마감돼도 기록 화면은 열려야 한다)
 */
export function usePortalPrograms(opts: { all?: boolean } = {}) {
  const stored = useStore((s) => s.programs);
  const [live, setLive] = useState<SupportProgram[]>([]);
  const [fetched, setFetched] = useState(false);
  const hasStored = stored.some((p) => p.source === "bizinfo");
  useEffect(() => {
    if (hasStored) return;
    let alive = true;
    void fetchBizinfo().then((r) => { if (alive) setLive(r.items); }).finally(() => { if (alive) setFetched(true); });
    return () => { alive = false; };
  }, [hasStored]);
  const loading = !hasStored && !fetched;
  const programs = useMemo(() => {
    const ids = new Set(stored.map((p) => p.id));
    const merged = [...stored, ...live.filter((p) => !ids.has(p.id))];
    return opts.all ? merged : openOnly(merged);
  }, [stored, live, opts.all]);
  return { programs, loading };
}

/** 주소의 [id] · [area] — 한글이 인코딩된 채로 올 수 있다 */
export function decodeParam(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v ?? "";
  try { return decodeURIComponent(s); } catch { return s; }
}

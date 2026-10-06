"use client";

import { CalendarClock, Radar, SearchCheck } from "lucide-react";
import type { Company } from "@/lib/types";
import type { LiveStatus } from "@/lib/programs-client";
import { profileOfCompany } from "@/lib/programs";
import { fmtRelative } from "@/lib/format";
import { cx } from "@/components/ui/ui";

/**
 * 매칭된 공고가 없을 때의 화면 — 빈 칸 대신 "시스템이 무엇을 보고 있는지"를 보여 준다.
 *  · 확인한 공고 수 (기업마당 API에서 받은 접수 중 공고)
 *  · 보고 있는 조건 (고객의 지역 · 업종 · 업력 · 인원)
 *  · 마지막 갱신 · 다음 갱신 (서버가 매일 오전 9시에 자동으로 받음)
 * 공고를 지어내 채우지 않는다. 맞는 공고가 없으면 없다고 말한다.
 */
export function MatchStatus({ checked, companies, lastAt, live, audience = "internal", className }: {
  /** 확인한 접수 중 공고 수 */
  checked: number;
  companies: Company[];
  /** 마지막으로 공고를 받은 때 (ms). 0 이면 모름 */
  lastAt: number;
  live?: LiveStatus | null;
  audience?: "internal" | "client";
  className?: string;
}) {
  const y = new Date().getFullYear();
  const conds = companies.slice(0, 6).map((c) => {
    const p = profileOfCompany(c);
    return {
      id: c.id, name: c.name,
      parts: [p.region ?? "지역 미입력", c.industry || c.bizCategory || "업종 미입력", p.foundedYear ? `업력 ${y - p.foundedYear}년` : "설립일 미입력", p.employees ? `${p.employees}명` : undefined].filter(Boolean) as string[],
    };
  });
  const title = checked > 0
    ? "현재 조건에서 매칭된 공고 없음"
    : live === "not_configured" ? "기업마당 공고 자동 수집 연결 전" : live === "loading" ? "공고를 받는 중입니다" : "아직 받은 공고가 없습니다";
  return (
    <div className={cx("card p-5", className)} data-testid="match-status">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--nav-ai)]/12 text-[color:var(--nav-ai-ink)]"><Radar size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[1.02rem] font-bold">{title}</div>
          <p className="mt-0.5 text-[0.85rem] text-ink-2">
            {checked > 0
              ? <>기업마당에서 받은 <b className="text-ink">접수 중 공고 {checked.toLocaleString("ko-KR")}건</b>을 {audience === "client" ? "우리 회사" : "고객"} 조건과 맞춰 봤지만, 지금은 검토해 볼 만큼 맞는 공고가 없습니다. 새 공고가 들어오면 같은 기준으로 다시 맞춰 봅니다.</>
              : audience === "client"
                ? <>새 공고가 들어오면 우리 회사 조건과 맞춰 보고, 맞는 공고는 담당 컨설턴트가 이 화면과 알림으로 알려 드립니다.</>
                : <>공고는 지어내지 않습니다. 기업마당 공고를 받으면 아래 조건과 자동으로 맞춰 봅니다.</>}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-line px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[0.82rem] font-bold text-ink-2"><SearchCheck size={15} /> 보고 있는 조건</div>
          {conds.length === 0 ? <div className="text-[0.82rem] text-ink-3">기업고객을 등록하면 지역 · 업종 · 업력 · 인원으로 맞춰 봅니다.</div> : (
            <ul className="space-y-1">
              {conds.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-1.5 text-[0.82rem]">
                  {audience === "internal" && <b className="mr-0.5">{c.name}</b>}
                  {c.parts.map((x) => <span key={x} className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">{x}</span>)}
                </li>
              ))}
              {companies.length > conds.length && <li className="text-[0.75rem] text-ink-3">외 {companies.length - conds.length}곳</li>}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-line px-3.5 py-3 text-[0.82rem] md:min-w-56">
          <div className="mb-1.5 flex items-center gap-1.5 font-bold text-ink-2"><CalendarClock size={15} /> 갱신</div>
          <div className="text-ink-2">마지막 · <b className="text-ink">{lastAt ? fmtRelative(new Date(lastAt).toISOString()) : "아직 없음"}</b></div>
          <div className="text-ink-2">다음 · <b className="text-ink">매일 오전 9시 자동</b></div>
          <div className="mt-1 text-[0.72rem] text-ink-3">자격 판정이 아니라 &lsquo;검토해 볼 공고&rsquo;를 찾는 기능입니다</div>
        </div>
      </div>
    </div>
  );
}

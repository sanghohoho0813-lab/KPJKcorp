"use client";

/**
 * 로그인 없는 "무료 성장 학습" — 대표가 공개한 학습 자료 · 직접 신청하는 순서 · 공식 기관 바로가기.
 * 맞는 공고는 기존 /match(지원사업 찾기)로 넘긴다. 회원가입 · 상담을 요구하지 않는다.
 */
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, ExternalLink, Search } from "lucide-react";
import { learnCategories } from "@/lib/learn";
import { LINK_BY_KEY } from "@/lib/official-links";
import { Card, EmptyState, cx } from "@/components/ui/ui";
import { LearnCard } from "@/components/domain/self/SelfParts";
import { PublicLearnShell, usePublicLearn } from "./PublicLearnShell";

const STEPS: [string, string][] = [
  ["공고 찾기", "지원사업 찾기에서 회사 조건을 고르면 검토해 볼 공고가 나옵니다."],
  ["공고문 읽기", "지원 대상 · 제외 대상 · 신청 기간 · 제출 서류를 공고문에서 직접 확인합니다."],
  ["서류 준비", "공고문에 적힌 서류만 준비합니다. 발급일 기준이 있는지도 봅니다."],
  ["공식 사이트에서 직접 신청", "신청은 각 기관 사이트에서 대표님이 직접 합니다. KPJK 가 대신 접속하거나 제출하지 않습니다."],
  ["결과 확인", "선정 여부는 기관이 정하고 기관 안내로 알려 줍니다."],
];
const SITES = ["bizinfo", "kstartup", "kosmes", "sbiz24", "smtech", "gov24", "hometax", "work24"];

export default function PublicLearnPage() {
  const res = usePublicLearn();
  const [cat, setCat] = useState<string>();
  const items = res?.items ?? [];
  const cats = learnCategories(items).filter((k) => items.some((x) => x.category === k));
  const shown = cat ? items.filter((x) => x.category === cat) : items;
  return (
    <PublicLearnShell>
      <div>
        <h1 className="text-[1.45rem] font-bold leading-tight md:text-[1.8rem]">지원사업 · 정책자금,<br className="sm:hidden" /> 스스로 준비하기</h1>
        <p className="mt-1 text-[0.9rem] text-ink-2">직접 알아보고 신청할 때 필요한 기본 안내입니다. 회원가입 없이 볼 수 있습니다.</p>
      </div>

      <Link href="/match" className="pressable card card-hover flex items-center gap-3 p-4" data-testid="learn-to-match">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft text-accent-strong"><Search size={19} /></span>
        <span className="min-w-0 flex-1"><b>우리 회사에 맞는 공고부터 보기</b><span className="block text-[0.8rem] text-ink-2">지금 접수 중인 실제 공고 중 검토해 볼 것을 근거와 함께</span></span>
        <ArrowRight size={18} className="shrink-0 text-ink-3" />
      </Link>

      <section className="space-y-2.5" data-testid="public-learn">
        <h2 className="text-[1.1rem] font-bold">학습 자료</h2>
        {!res ? <p className="text-[0.86rem] text-ink-3">불러오는 중…</p>
          : items.length === 0 ? <Card><EmptyState icon={<BookOpen size={28} />} title="아직 공개된 학습 자료가 없습니다" desc="아래 '직접 신청하는 순서'와 공식 기관 바로가기는 지금 바로 쓸 수 있습니다." /></Card>
          : (
            <>
              {cats.length > 1 && (
                <div className="hide-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="학습 분류">
                  {[undefined, ...cats].map((k) => (
                    <button key={k ?? "all"} type="button" role="tab" aria-selected={cat === k} onClick={() => setCat(k)}
                      className={cx("pressable min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[0.82rem] font-semibold", cat === k ? "border-accent bg-soft text-accent-strong" : "border-line bg-surface text-ink-2")}>{k ?? `전체 ${items.length}`}</button>
                  ))}
                </div>
              )}
              <div className="grid gap-2.5 sm:grid-cols-2">{shown.map((c) => <LearnCard key={c.id} c={c} href={`/learn/${encodeURIComponent(c.id)}`} />)}</div>
            </>
          )}
      </section>

      <Card className="p-5" data-testid="public-steps">
        <h2 className="mb-2 text-[1.05rem] font-bold">직접 신청하는 순서</h2>
        <ol className="space-y-2.5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft text-[0.82rem] font-bold text-accent-strong">{i + 1}</span>
              <span className="min-w-0"><b className="text-[0.92rem]">{t}</b><span className="block text-[0.84rem] leading-relaxed text-ink-2">{d}</span></span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-[1.05rem] font-bold">공식 기관 바로가기</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SITES.map((k) => LINK_BY_KEY[k]).filter(Boolean).map((l) => (
            <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer" className="pressable flex min-h-12 items-center gap-2 rounded-xl border border-line px-3.5 py-2 hover:border-accent">
              <span className="min-w-0 flex-1"><b className="text-[0.88rem]">{l.label}</b><span className="block truncate text-[0.75rem] text-ink-3">{l.what}</span></span>
              <ExternalLink size={14} className="shrink-0 text-ink-3" />
            </a>
          ))}
        </div>
        <p className="mt-2 text-[0.72rem] text-ink-3">각 기관의 첫 화면으로 연결합니다. 공고별 신청 화면은 해당 공고문의 안내를 따릅니다.</p>
      </Card>

      <p className="text-[0.8rem] leading-relaxed text-ink-3">KPJK 고객이시면 로그인 뒤 &lsquo;스스로 준비하기&rsquo;에서 준비 상태와 신청 결과를 저장할 수 있습니다. 직접 하다가 막히면 그때 전문가 도움을 선택하시면 됩니다. 이 화면의 안내는 일반 안내이며, 대상 · 요건 · 선정은 각 공고와 기관이 정합니다.</p>
    </PublicLearnShell>
  );
}

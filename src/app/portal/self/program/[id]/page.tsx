"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Footprints } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { deadlineOf, profileOfCompany, programRegions, programsForCompany } from "@/lib/programs";
import { learnForProgram } from "@/lib/learn";
import { OFFICIAL_LINKS, safeHttpsUrl } from "@/lib/official-links";
import { PROGRAM_CHECKS, findRun, nextStep, statusLabel } from "@/lib/self-run";
import { policyDocsFor } from "@/lib/policy-docs";
import { OPP_STATUS } from "@/lib/services";
import { fmtDate } from "@/lib/format";
import { MATCH_NOTE } from "@/components/domain/programs/ProgramCard";
import { Icon3D } from "@/components/domain/portal/Icon3D";
import { CheckList, EvidenceBox, ExpertHelp, LearnCard, PathTag, ReadOnlyNote, RunHistory, StatusPicker, Step, useCanRecord } from "@/components/domain/self/SelfParts";
import { decodeParam, usePortalPrograms } from "@/components/domain/self/hooks";
import { Badge, Button, Card, PageSkeleton } from "@/components/ui/ui";

/**
 * 지원사업 직접 준비하기 — ① 공고 이해 ② 관련 교육 ③ 준비 체크리스트 ④ 공식 사이트에서 직접 신청 ⑤ 결과 기록.
 * 매칭은 검토 후보일 뿐(자격 확정 아님). 신청은 기관 공식 사이트에서 대표님이 직접 — 자동 로그인 · 대리 제출 없음.
 */
export default function SelfProgramPage() {
  const params = useParams<{ id: string }>();
  const id = decodeParam(params.id);
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const start = useStore((s) => s.startSelfRun);
  const ask = useStore((s) => s.askProgram);
  const toast = useStore((s) => s.toast);
  const can = useCanRecord();
  const { programs, loading } = usePortalPrograms({ all: true });
  const c = st.companies.find((x) => x.id === companyId);
  if (!c) return null;
  const p = programs.find((x) => x.id === id);
  const run = findRun(st.selfRuns, c.id, "program", id);
  if (!p && !run) {
    if (loading) return <PageSkeleton />;
    return (
      <Card className="p-6 text-center">
        <div className="font-bold">공고를 찾을 수 없습니다</div>
        <p className="mt-1 text-[0.88rem] text-ink-2">마감되었거나 목록에서 내려간 공고일 수 있습니다.</p>
        <Link href="/portal/programs" className="mt-3 inline-flex min-h-10 items-center font-semibold text-accent">지원사업 목록으로 →</Link>
      </Card>
    );
  }
  const now = new Date();
  const { sent, matches } = programsForCompany(programs, c.id, profileOfCompany(c), now);
  const m = [...sent, ...matches].find((x) => x.program.id === id);
  const dl = p ? deadlineOf(p, now) : undefined;
  const learn = p ? learnForProgram(st.learnContents, p) : [];
  const learned = new Set(st.selfRuns.filter((r) => r.companyId === c.id && r.kind === "learn").map((r) => r.targetKey));
  const agencySites = p ? OFFICIAL_LINKS.filter((l) => l.key !== "bizinfo" && `${p.agency} ${p.operator ?? ""}`.includes(l.label)) : [];
  const noticeUrl = safeHttpsUrl(p?.url);
  const next = run ? nextStep(run, p, now) : undefined;
  const title = p?.title ?? run!.targetTitle;
  const opp = st.opportunities.find((o) => o.companyId === c.id && o.serviceKey === "support_program" && o.serviceName === `지원사업: ${title}`.slice(0, 120) && o.status !== "dropped");
  const regions = p ? programRegions(p) : [];

  return (
    <div className="space-y-4" data-testid="self-program">
      <Link href="/portal/self" className="pressable inline-flex min-h-10 items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> 스스로 준비하기</Link>
      <header className="flex items-start gap-3">
        <Icon3D name="funding" size="2.6rem" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><PathTag kind="self" />{dl && <Badge tone={dl.closed ? "neutral" : dl.urgent ? "error" : "info"}>{dl.closed ? "접수 마감" : dl.label}</Badge>}{p && <Badge>{p.category}</Badge>}{regions.length > 0 && <Badge>{regions.join("·")}</Badge>}</div>
          <h1 className="mt-1.5 text-[1.3rem] font-extrabold leading-snug md:text-[1.5rem]">{title}</h1>
          {p && <p className="mt-0.5 text-[0.85rem] text-ink-2">{p.agency}{p.operator && p.operator !== p.agency ? ` · ${p.operator}` : ""}</p>}
        </div>
      </header>

      {run && next && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-soft/60 px-4 py-3" data-testid="self-next">
          <Footprints size={18} className="mt-0.5 shrink-0 text-accent-strong" />
          <div className="min-w-0"><div className="text-[0.78rem] font-bold text-accent-strong">다음 할 일 · 지금 {statusLabel("program", run.status)}</div><div className="font-bold leading-snug">{next.title.replace(`${title} — `, "")}</div>{next.sub && <div className="text-[0.82rem] text-ink-2">{next.sub}</div>}</div>
        </div>
      )}
      {!run && (
        <Card className="p-4">
          <p className="text-[0.88rem] leading-relaxed text-ink-2">KPJK 에 맡기지 않아도 아래 순서대로 직접 준비할 수 있습니다. 시작하면 체크리스트와 결과가 우리 회사 기록으로 남습니다.</p>
          {can ? (
            <Button variant="accent" full className="mt-3" icon={<Footprints size={16} />} data-testid="self-start"
              onClick={() => { if (p && start({ companyId: c.id, kind: "program", targetKey: p.id, targetTitle: p.title })) toast("직접 준비를 시작했습니다. 체크리스트부터 하나씩 확인하세요."); }}>
              직접 준비 시작하기 (무료)
            </Button>
          ) : <div className="mt-3"><ReadOnlyNote /></div>}
        </Card>
      )}

      {p && (
        <Step n={1} title="공고 이해하기" sub="무엇을 지원하는지, 누가 대상인지 먼저 봅니다" done={!!run?.checks.notice}>
          <dl className="grid gap-x-4 text-[0.88rem] sm:grid-cols-[7rem_1fr]">
            {([["운영기관", [p.agency, p.operator].filter(Boolean).join(" · ")], ["지원 분야", p.category], ["신청기간", p.applyEnd ? `${p.applyStart ? `${fmtDate(p.applyStart)} ~ ` : "~ "}${fmtDate(p.applyEnd)}` : p.periodText || "상시 · 예산 소진 시"], ["대상", p.target], ["지원 내용", p.summary]] as const)
              .filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents"><dt className="pt-2 text-[0.78rem] font-semibold text-ink-3">{k}</dt><dd className="border-b border-line pb-2 pt-1 leading-relaxed sm:pt-2">{v}</dd></div>
              ))}
          </dl>
          {m && (m.reasons.length > 0 || m.cautions.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.reasons.map((r) => <span key={r} className="rounded-full bg-success-bg px-2.5 py-0.5 text-[0.75rem] font-semibold text-success">{r}</span>)}
              {m.cautions.map((r) => <span key={r} className="rounded-full bg-warning-bg px-2.5 py-0.5 text-[0.75rem] font-semibold text-warning">{r}</span>)}
            </div>
          )}
          <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-3">{MATCH_NOTE}</p>
          {noticeUrl && <a href={noticeUrl} target="_blank" rel="noopener noreferrer" className="pressable mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-4 font-semibold hover:border-accent hover:text-accent" data-testid="notice-link">공고문 원문 보기 <ExternalLink size={14} /></a>}
        </Step>
      )}

      {p && (
        <Step n={2} title="관련 교육 보기" sub="무료 학습 자료 — 처음이라면 이것부터">
          {learn.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2" data-testid="self-learn">{learn.map((x) => <LearnCard key={x.id} c={x} href={`/portal/self/learn/${encodeURIComponent(x.id)}`} done={learned.has(x.id)} />)}</div>
          ) : <p className="text-[0.86rem] text-ink-2">이 공고에 맞는 학습 자료가 아직 없습니다. <Link href="/portal/self#learn" className="font-semibold text-accent">전체 학습 자료</Link>를 보세요.</p>}
        </Step>
      )}

      <Step n={3} title="준비 체크리스트" sub="공고문과 하나씩 맞춰 보며 체크하세요 — 누르면 바로 저장됩니다">
        <CheckList run={run} items={PROGRAM_CHECKS} />
        {!run && <p className="mt-2 text-[0.78rem] text-ink-3">위에서 &lsquo;직접 준비 시작하기&rsquo;를 누르면 체크할 수 있습니다.</p>}
        <details className="group mt-3">
          <summary className="pressable flex min-h-10 cursor-pointer list-none items-center gap-1 text-[0.85rem] font-semibold text-ink-2">자주 요구되는 기업서류 · 발급처 <span className="transition-transform group-open:rotate-90">›</span></summary>
          <p className="mt-1 text-[0.75rem] text-ink-3">공고마다 다릅니다 — 실제 필요한 서류와 발급일 기준은 <b>공고문 목록</b>이 기준입니다.</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-[0.84rem]">
            {policyDocsFor(c.entityType).map(({ doc }) => <li key={doc.key} className="px-3.5 py-2"><b>{doc.label}</b><span className="block text-[0.76rem] text-ink-3">{doc.where}{doc.validText ? ` · ${doc.validText}` : ""}</span></li>)}
          </ul>
        </details>
      </Step>

      {p && (
        <Step n={4} title="공식 사이트에서 직접 신청하기" sub="신청은 기관의 공식 시스템에서 대표님이 직접 합니다">
          <ol className="space-y-1.5 text-[0.88rem]">
            {["공고문에서 신청 방법 · 접수처 확인", "기관 사이트 회원가입 · 로그인(기업 공동인증서가 필요할 수 있음)", "신청서 작성 · 공고문 서류 첨부", "접수번호 · 접수확인서 저장 → 아래 5단계에 기록"].map((t, i) => (
              <li key={t} className="flex gap-2.5"><span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.75rem] font-bold">{i + 1}</span>{t}</li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {noticeUrl && <a href={noticeUrl} target="_blank" rel="noopener noreferrer" className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 font-semibold text-accent-ink">공고문 · 신청 안내 열기 <ExternalLink size={14} /></a>}
            {agencySites.map((l) => <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer" className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-4 font-semibold hover:border-accent hover:text-accent">{l.label} <ExternalLink size={14} /></a>)}
          </div>
          <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-3">외부 기관 사이트로 이동합니다. 이 화면은 자동 로그인 · 대신 제출을 하지 않습니다. KPJK 에 의뢰하지 않아도 진행할 수 있습니다.</p>
        </Step>
      )}

      <Step n={5} title="진행 · 결과 기록" sub="신청했는지, 결과가 어떻게 됐는지 직접 남겨 두세요">
        {run ? (
          <div className="space-y-4">
            <StatusPicker run={run} />
            <EvidenceBox run={run} />
            <RunHistory run={run} />
          </div>
        ) : <p className="text-[0.86rem] text-ink-2">직접 준비를 시작하면 상태와 결과를 기록할 수 있습니다.</p>}
      </Step>

      <ExpertHelp run={run} what={title} asked={opp ? `이 공고로 담당 컨설턴트에게 물어보셨습니다 · ${OPP_STATUS[opp.status].clientLabel}` : undefined}
        onAsk={(note) => !!p && ask(p.id, c.id, user?.id ?? "", note)} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, Footprints } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { KPJK_SERVICES, OPP_STATUS } from "@/lib/services";
import { learnForArea } from "@/lib/learn";
import { findRun, guideOf, nextStep, statusLabel } from "@/lib/self-run";
import { useGrowth } from "@/components/domain/portal/GrowthBoard";
import { Icon3D } from "@/components/domain/portal/Icon3D";
import { CheckList, EvidenceBox, ExpertHelp, LearnCard, PathTag, ReadOnlyNote, RunHistory, StatusPicker, Step, useCanRecord } from "@/components/domain/self/SelfParts";
import { decodeParam } from "@/components/domain/self/hooks";
import { useOnBehalf } from "@/components/domain/portal/CancelRequest";
import { Button, Card } from "@/components/ui/ui";

/**
 * 성장과제 직접 실행 — 직접 알아보기(무료) 또는 전문가에게 묻기(선택).
 * 추천은 "검토해 볼 만한 과제"까지다. 요건을 충족하는지는 법령 · 기관 안내가 기준이며 이 화면이 판단하지 않는다.
 * 결과(완료 · 진행 안 함)는 성장과제 판에 바로 반영되고, 완료하면 이어지는 과제가 다음으로 나온다.
 */
export default function SelfGrowthPage() {
  const params = useParams<{ area: string }>();
  const area = decodeParam(params.area);
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const start = useStore((s) => s.startSelfRun);
  const raise = useStore((s) => s.raiseOpportunity);
  const toast = useStore((s) => s.toast);
  const can = useCanRecord();
  const { onBehalf } = useOnBehalf();
  const c = st.companies.find((x) => x.id === companyId);
  const board = useGrowth(c);
  const svc = KPJK_SERVICES.find((s) => s.name === area);
  if (!c || !board) return null;
  if (!svc) {
    return (
      <Card className="p-6 text-center">
        <div className="font-bold">과제를 찾을 수 없습니다</div>
        <Link href="/portal/self" className="mt-3 inline-flex min-h-10 items-center font-semibold text-accent">스스로 준비하기로 →</Link>
      </Card>
    );
  }
  const guide = guideOf(area);
  const run = findRun(st.selfRuns, c.id, "growth", area);
  const all = [...board.review, ...board.proposed, ...board.suggested, ...board.self, ...board.selfClosed, ...board.completed, ...board.active];
  const item = all.find((x) => x.area === area);
  const byConsultant = board.active.find((x) => x.area === area && !x.selfRun) ?? board.completed.find((x) => x.area === area && !x.selfRun);
  const learn = learnForArea(st.learnContents, area);
  const learned = new Set(st.selfRuns.filter((r) => r.companyId === c.id && r.kind === "learn").map((r) => r.targetKey));
  const next = run ? nextStep(run, undefined, new Date()) : undefined;
  // 완료 뒤 이어지는 과제 — 기존 규칙(이어지는 과제)이 그대로 고른 것
  const followUps = run?.status === "done" ? board.suggested.filter((x) => x.basis?.includes(`${area} 직접 완료`)) : [];
  const opp = st.opportunities.find((o) => o.companyId === c.id && o.serviceKey === svc.key && o.status !== "dropped" && o.source !== "proposal");

  return (
    <div className="space-y-4" data-testid="self-growth">
      <Link href="/portal/self" className="pressable inline-flex min-h-10 items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={15} /> 스스로 준비하기</Link>
      <header className="flex items-start gap-3">
        <Icon3D name="growth" size="2.6rem" />
        <div className="min-w-0">
          <PathTag kind="self" />
          <h1 className="mt-1.5 text-[1.3rem] font-extrabold leading-snug md:text-[1.5rem]">{area}</h1>
          <p className="mt-0.5 text-[0.86rem] leading-relaxed text-ink-2">{svc.blurb}</p>
        </div>
      </header>

      {item?.reason && (
        <div className="rounded-2xl bg-surface-2 px-4 py-3 text-[0.86rem]">
          <div className="font-semibold">왜 이 과제인가요</div>
          <div className="mt-0.5 text-ink-2">{item.reason}</div>
          {item.basis && <div className="mt-1.5 inline-flex rounded-md bg-surface px-2 py-0.5 text-[0.72rem] font-semibold text-ink-3">근거 · {item.basis}</div>}
          <div className="mt-1.5 text-[0.75rem] text-ink-3">검토해 볼 만한 과제라는 뜻입니다. 요건 충족 여부를 판단한 것이 아닙니다.</div>
        </div>
      )}
      {byConsultant && <p className="rounded-xl bg-info-bg px-4 py-2.5 text-[0.84rem] text-info">담당 컨설턴트와 진행 중(또는 완료)인 과제입니다. 직접 알아보신 내용도 따로 기록됩니다.</p>}

      {run && next && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-soft/60 px-4 py-3" data-testid="self-next">
          <Footprints size={18} className="mt-0.5 shrink-0 text-accent-strong" />
          <div className="min-w-0"><div className="text-[0.78rem] font-bold text-accent-strong">다음 할 일 · 지금 {statusLabel("growth", run.status)}</div><div className="font-bold leading-snug">{next.title}</div>{next.sub && <div className="text-[0.82rem] text-ink-2">{next.sub}</div>}</div>
        </div>
      )}
      {followUps.length > 0 && (
        <div className="rounded-2xl border border-success/30 bg-success-bg/50 px-4 py-3" data-testid="self-followups">
          <div className="text-[0.82rem] font-bold text-success">완료를 반영해 다음 과제가 생겼습니다</div>
          {followUps.map((f) => (
            <Link key={f.area} href={`/portal/self/growth/${encodeURIComponent(f.area)}`} className="pressable mt-1.5 flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3.5 py-2 font-semibold">
              <span className="min-w-0 flex-1">{f.area}<span className="block text-[0.76rem] font-normal text-ink-3">{f.reason}</span></span><ArrowRight size={16} className="shrink-0 text-ink-3" />
            </Link>
          ))}
        </div>
      )}

      {!run && (
        <Card className="p-4">
          <p className="text-[0.88rem] leading-relaxed text-ink-2">{guide.intro}</p>
          {can ? (
            <Button variant="accent" full className="mt-3" icon={<Footprints size={16} />} data-testid="self-start"
              onClick={() => { if (start({ companyId: c.id, kind: "growth", targetKey: area, targetTitle: area })) toast("직접 알아보기를 시작했습니다. 진행 상태는 언제든 바꿀 수 있습니다."); }}>
              직접 알아보기 시작 (무료)
            </Button>
          ) : <div className="mt-3"><ReadOnlyNote /></div>}
        </Card>
      )}
      {guide.expertAdvised && <p className="flex items-start gap-2 rounded-xl bg-warning-bg px-4 py-2.5 text-[0.84rem] text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{guide.expertAdvised}</p>}

      <Step n={1} title="알아보기" sub="학습 자료와 공식 안내로 먼저 봅니다">
        {run && <p className="mb-3 text-[0.86rem] leading-relaxed text-ink-2">{guide.intro}</p>}
        {learn.length > 0 && <div className="grid gap-2.5 sm:grid-cols-2" data-testid="self-learn">{learn.map((x) => <LearnCard key={x.id} c={x} href={`/portal/self/learn/${encodeURIComponent(x.id)}`} done={learned.has(x.id)} />)}</div>}
        {guide.links.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.links.map((l) => <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer" className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-4 font-semibold hover:border-accent hover:text-accent">{l.label} <ExternalLink size={14} /></a>)}
          </div>
        )}
        {!learn.length && !guide.links.length && <p className="text-[0.86rem] text-ink-2">이 분야의 학습 자료가 아직 없습니다. 아래 순서대로 정리해 보시고, 판단이 필요하면 전문가에게 물어보세요.</p>}
      </Step>

      <Step n={2} title="준비 체크리스트" sub="우리 회사 상황을 하나씩 정리합니다 — 누르면 바로 저장">
        <CheckList run={run} items={guide.checks} />
      </Step>

      <Step n={3} title="진행 상태 기록" sub={`${guide.doneLabel ? `${guide.doneLabel}했으면 '완료'로` : "끝냈으면 '완료'로"}, 지금 하지 않기로 했으면 '진행 안 함'으로 남겨 두세요`}>
        {run ? (
          <div className="space-y-4">
            <StatusPicker run={run} />
            <EvidenceBox run={run} />
            <RunHistory run={run} />
          </div>
        ) : <p className="text-[0.86rem] text-ink-2">직접 알아보기를 시작하면 상태를 기록할 수 있습니다.</p>}
      </Step>

      <ExpertHelp run={run} what={area} asked={opp ? `${area}: 담당 컨설턴트에게 요청하셨습니다 · ${OPP_STATUS[opp.status].clientLabel}` : undefined}
        onAsk={(note) => {
          if (!user || (!can && !onBehalf)) return false;
          raise({ companyId: c.id, serviceKey: svc.key, note: note.trim() || undefined, reason: item?.reason ? `${item.reason}${item.basis ? ` (근거: ${item.basis})` : ""}` : undefined, source: "portal_request", onBehalf }, user.id, can ? "client" : (st.session?.role ?? "consultant"));
          return true;
        }} />
    </div>
  );
}

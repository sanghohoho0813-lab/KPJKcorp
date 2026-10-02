"use client";

import { CancelRequestButton, OnBehalfNote, useOnBehalf } from "./CancelRequest";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, FileCheck2, FolderUp, MessageSquarePlus, Receipt, Sparkles, ThumbsUp, TrendingUp } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { growthBoard, type GrowthItem, type NowAction } from "@/lib/growth";
import { ENTITY_TYPES, yearsSince, EMPLOYEE_BANDS } from "@/lib/company-options";
import { fmtDate, fmtRelative } from "@/lib/format";
import { OPP_STATUS } from "@/lib/services";
import type { Company, DocumentRequest, InternalStage } from "@/lib/types";
import { CUSTOMER_STEPS, stageToCustomerStep } from "@/lib/stages";
import { Badge, Button, Card, Progress, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { UploadModal } from "@/components/domain/DocActions";

/** 고객 홈의 성장과제 판에 필요한 것을 한 번에 계산한다 */
export function useGrowth(c: Company | undefined) {
  const st = useStore();
  return useMemo(() => (c ? growthBoard({ company: c, projects: st.projects, opportunities: st.opportunities, docRequests: st.docRequests, quotes: st.quotes, results: st.results, schedules: st.schedules, now: new Date() }) : null),
    [c, st.projects, st.opportunities, st.docRequests, st.quotes, st.results, st.schedules]);
}

/* ------------------------------ 우리 회사 현재 상태 ------------------------------ */

export function CompanyStatusCard({ company: c, board, greeting, footer }: { company: Company; board: NonNullable<ReturnType<typeof useGrowth>>; greeting: React.ReactNode; footer?: React.ReactNode }) {
  const age = yearsSince(c.establishedAt);
  const chips = [
    c.industry || c.bizCategory,
    ENTITY_TYPES.find((e) => e.key === c.entityType)?.label,
    age !== undefined ? `업력 ${age}년` : undefined,
    c.employees ? `임직원 ${c.employees}명` : EMPLOYEE_BANDS.find((b) => b.key === c.employeeBand)?.label && `임직원 ${EMPLOYEE_BANDS.find((b) => b.key === c.employeeBand)?.label}`,
    c.region,
  ].filter(Boolean) as string[];
  const main = board.active[0];
  const tiles = [
    { label: "지금 할 일", value: board.actions.filter((a) => a.key !== "doc_more").length, hot: board.actions.length > 0 },
    { label: "진행 중 과제", value: board.active.length },
    { label: "검토 중 과제", value: board.review.length + board.proposed.length },
    { label: "완료한 과제", value: board.completed.length },
  ];
  return (
    <Card className="p-5 md:p-7" id="tut-p-progress">
      <div className="text-[0.9rem] text-ink-2">{greeting}</div>
      <h1 className="mt-1 text-[1.45rem] font-bold leading-tight md:text-[1.9rem]">{c.name} 현재 상태</h1>
      {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{chips.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.78rem] font-semibold text-ink-2">{t}</span>)}</div>}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="growth-tiles">
        {tiles.map((t) => (
          <div key={t.label} className={cx("rounded-xl px-4 py-3", t.hot ? "bg-soft" : "bg-surface-2")}>
            <div className="text-[0.75rem] font-bold text-ink-3">{t.label}</div>
            <div className={cx("tnum mt-0.5 text-[1.6rem] font-bold leading-none", t.hot && "text-accent")}>{t.value}</div>
          </div>
        ))}
      </div>
      {main && (
        <Link href={`/portal/projects?p=${main.project!.id}`} className="mt-4 block rounded-xl border border-line px-4 py-3 hover:border-accent">
          <div className="flex items-center gap-2 text-[0.85rem]"><TrendingUp size={15} className="shrink-0 text-accent" /><b className="truncate">{main.area}</b><span className="shrink-0 text-ink-3">· 지금 {main.stepLabel} 단계</span><span className="tnum ml-auto shrink-0 text-[1.05rem] font-bold text-accent">{main.progress}%</span></div>
          <Progress value={main.progress ?? 0} className="mt-2" height={8} />
        </Link>
      )}
      {footer}
    </Card>
  );
}

/* ------------------------------ 지금 해야 할 일 ------------------------------ */

const ACTION_ICON: Record<NowAction["kind"], React.ReactNode> = {
  doc: <FolderUp size={17} />, quote: <Receipt size={17} />, proposal: <Sparkles size={17} />, schedule: <CalendarDays size={17} />, result: <FileCheck2 size={17} />,
};

export function NowActions({ actions, companyId }: { actions: NowAction[]; companyId: string }) {
  const docs = useStore((s) => s.docRequests);
  const [upload, setUpload] = useState<DocumentRequest | null>(null);
  return (
    <Card className="p-5" id="tut-p-actions">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-[1.1rem] font-bold">지금 해야 할 일</h2><span className="text-[0.8rem] text-ink-3">누르면 바로 할 수 있습니다</span></div>
      {actions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-[0.9rem] font-semibold text-success"><CheckCircle2 size={18} /> 지금 하실 일은 없습니다. 담당 컨설턴트가 진행하고 있습니다.</div>
      ) : (
        <div className="space-y-2" data-testid="now-actions">
          {actions.map((a) => {
            const doc = a.kind === "doc" && a.key.startsWith("doc_d") ? docs.find((d) => `doc_${d.id}` === a.key && d.companyId === companyId) : undefined;
            const inner = (
              <>
                <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", a.urgent ? "bg-error-bg text-error" : "bg-soft text-accent")}>{ACTION_ICON[a.kind]}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{a.title}</span>{a.sub && <span className={cx("block truncate text-[0.8rem]", a.urgent ? "font-semibold text-error" : "text-ink-3")}>{a.sub}</span>}</span>
                <ChevronRight size={16} className="shrink-0 text-ink-3" />
              </>
            );
            return doc
              ? <button key={a.key} type="button" onClick={() => setUpload(doc)} className="pressable flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left hover:border-accent">{inner}</button>
              : <Link key={a.key} href={a.href} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:border-accent">{inner}</Link>;
          })}
        </div>
      )}
      <UploadModal req={upload} open={!!upload} onClose={() => setUpload(null)} />
    </Card>
  );
}

/* ------------------------------ 성장과제 ------------------------------ */

export function ActiveGrowth({ items }: { items: GrowthItem[] }) {
  if (!items.length) return null;
  return (
    <Card className="p-5" id="growth-active">
      <h2 className="mb-3 flex items-center gap-2 text-[1.1rem] font-bold"><TrendingUp size={18} className="text-accent" /> 진행 중인 성장과제</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <Link key={it.project!.id} href={`/portal/projects?p=${it.project!.id}`} className="card card-hover block p-4" data-growth-active={it.area}>
            <div className="flex items-center gap-2"><span className="font-bold">{it.area}</span><Badge tone="accent">{it.stepLabel}</Badge><span className="tnum ml-auto font-bold text-accent">{it.progress}%</span></div>
            {it.service?.blurb && <div className="mt-1 line-clamp-2 text-[0.82rem] text-ink-2">{it.service.blurb}</div>}
            <Progress value={it.progress ?? 0} className="mt-2.5" height={7} />
            {it.project?.nextMilestone?.label && <div className="mt-2 text-[0.78rem] text-ink-3">다음: {it.project.nextMilestone.label}{it.project.nextMilestone.date ? ` · ${fmtDate(it.project.nextMilestone.date)}` : ""}</div>}
          </Link>
        ))}
      </div>
    </Card>
  );
}

/** 다음으로 검토할 성장과제 — 요청한 것(진행 상황) · 담당자 제안 · 기업정보로 고른 것. 누르면 담당자에게 바로 간다 */
export function NextGrowth({ board, companyId, compact, only, title }: { board: NonNullable<ReturnType<typeof useGrowth>>; companyId: string; compact?: boolean; only?: GrowthItem["state"][]; title?: string }) {
  const st = useStore();
  const user = useCurrentUser();
  const raise = useStore((s) => s.raiseOpportunity);
  const toast = useStore((s) => s.toast);
  const [ask, setAsk] = useState<{ it: GrowthItem; kind: "interest" | "request" } | null>(null);
  const [note, setNote] = useState("");
  const { isClient, onBehalf } = useOnBehalf();
  const items = [...board.review, ...board.proposed, ...board.suggested].filter((x) => !only || only.includes(x.state));
  if (only && items.length === 0) return null;
  const submit = () => {
    if (!ask?.it.service) return;
    if (!isClient && !onBehalf) { toast("고객 계정 또는 대표·컨설턴트 계정에서만 접수할 수 있습니다.", "error"); return; }
    raise({ companyId, serviceKey: ask.it.service.key, note: note.trim() || undefined, reason: [ask.it.reason, ask.it.basis && `(근거: ${ask.it.basis})`].filter(Boolean).join(" "), source: ask.kind === "request" ? "portal_request" : "portal_interest", onBehalf }, user?.id ?? "", isClient ? "client" : (st.session?.role ?? "consultant"));
    toast(onBehalf ? "고객 대신 접수했습니다 — 담당 컨설턴트에게 업무·알림이 갔습니다." : ask.kind === "request" ? "상담 요청이 담당 컨설턴트에게 전달되었습니다." : "검토 요청이 전달되었습니다. 담당 컨설턴트가 확인 후 연락드립니다.");
    setAsk(null); setNote("");
  };
  return (
    <Card className="p-5" id={only ? "portal-suggested-growth" : "portal-next-growth"}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[1.1rem] font-bold"><Sparkles size={18} className="text-accent" /> {title ?? "다음으로 검토할 성장과제"}</h2>
        {!only && <Link href="/portal/services" className="link-more whitespace-nowrap">분야 전체 →</Link>}
      </div>
      <p className="mb-3 text-[0.8rem] text-ink-3">기업정보·진행 이력·담당자 제안을 근거로 골랐습니다. 될지 안 될지는 담당 컨설턴트가 함께 확인합니다.</p>
      {items.length === 0 ? (
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem] text-ink-2">지금 함께 검토할 과제가 없습니다. 궁금한 분야는 <Link href="/portal/services" className="font-semibold text-accent">컨설팅 분야</Link>에서 바로 요청하실 수 있습니다.</div>
      ) : (
        <div className={cx("grid gap-3", !compact && "md:grid-cols-2")}>
          {items.map((it) => (
            <div key={`${it.state}-${it.area}`} className={cx("rounded-xl border p-4", it.state === "review" ? "border-line bg-surface-2" : it.state === "proposed" ? "border-accent/40" : "border-line")} data-growth-next={it.area} data-growth-state={it.state}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{it.area}</span>
                {it.state === "review" && it.opportunity ? <Badge tone={OPP_STATUS[it.opportunity.status].tone}>{OPP_STATUS[it.opportunity.status].clientLabel}</Badge>
                  : it.state === "proposed" ? <Badge tone="accent">담당자 제안</Badge> : <Badge>검토해 볼 과제</Badge>}
              </div>
              {it.reason && <div className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-2">{it.reason}</div>}
              {it.basis && <div className="mt-1.5 inline-flex rounded-md bg-surface-2 px-2 py-0.5 text-[0.72rem] font-semibold text-ink-3">근거 · {it.basis}</div>}
              {it.state === "review" ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.8rem] text-ink-3">{fmtRelative(it.opportunity!.createdAt)} 요청 · 담당 컨설턴트가 확인하고 있습니다.<CancelRequestButton opp={it.opportunity!} className="-ml-1" /></div>
              ) : it.service && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" icon={<ThumbsUp size={14} />} onClick={() => { setAsk({ it, kind: "interest" }); setNote(""); }}>검토하고 싶어요</Button>
                  <Button size="sm" variant="accent" icon={<MessageSquarePlus size={14} />} onClick={() => { setAsk({ it, kind: "request" }); setNote(""); }}>상담 요청</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={!!ask} onClose={() => setAsk(null)} size="sm" title={ask?.kind === "request" ? `${ask?.it.area} 상담 요청` : `${ask?.it.area} 검토 요청`}
        footer={<><Button variant="ghost" onClick={() => setAsk(null)}>취소</Button><Button variant="accent" onClick={submit}>{onBehalf ? "고객 대신 접수" : ask?.kind === "request" ? "상담 요청" : "검토 요청"}</Button></>}>
        {onBehalf && <OnBehalfNote />}
        {ask?.it.service && <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem]"><div className="font-semibold">{ask.it.service.blurb}</div><ul className="mt-1.5 space-y-0.5 text-ink-2">{ask.it.service.points.map((p) => <li key={p} className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-success" />{p}</li>)}</ul></div>}
        <label className="mt-3 block text-[0.85rem] font-semibold text-ink-2">담당자에게 남길 말 (선택)
          <Textarea rows={3} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 다음 달 결산 전에 이야기 나누고 싶습니다." />
        </label>
        <p className="mt-2 text-[0.78rem] text-ink-3">요청은 계약이나 비용과 무관합니다. 담당 컨설턴트가 확인한 뒤 연락드립니다.</p>
      </Modal>
    </Card>
  );
}

/** 고객에게 보이는 이력 문장 — 내부 단계 이름 대신 고객 단계 이름으로 */
function historyText(a: { type: string; text: string; meta?: Record<string, unknown> }) {
  if (a.type === "project_stage_changed" && typeof a.meta?.to === "string") return `진행 단계: ${CUSTOMER_STEPS[stageToCustomerStep(a.meta.to as InternalStage)].label}`;
  return a.text;
}

/** 완료한 성장과제와 이력 — 지금까지 함께 한 것 */
export function GrowthHistory({ board, companyId }: { board: NonNullable<ReturnType<typeof useGrowth>>; companyId: string }) {
  const acts = useStore((s) => s.activities);
  const history = useMemo(() => acts.filter((a) => a.companyId === companyId && ["project_stage_changed", "document_reviewed", "result_shared", "contract_signed", "inquiry_answered"].includes(a.type)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6), [acts, companyId]);
  if (!board.completed.length && !history.length) return null;
  return (
    <Card className="p-5" id="growth-history">
      <h2 className="mb-3 flex items-center gap-2 text-[1.1rem] font-bold"><CheckCircle2 size={18} className="text-success" /> 완료한 성장과제 · 이력</h2>
      {board.completed.length > 0 && (
        <div className="mb-4 space-y-2">
          {board.completed.map((it) => (
            <div key={it.project!.id} className="flex items-center gap-3 rounded-xl bg-success-bg/50 px-4 py-2.5" data-growth-done={it.area}>
              <Check size={16} className="shrink-0 text-success" />
              <span className="min-w-0 flex-1"><b>{it.area}</b><span className="ml-1.5 text-[0.8rem] text-ink-3">{it.doneAt ? `${fmtDate(it.doneAt, { year: true })} 완료` : "완료"}</span></span>
              {!!it.resultCount && <Link href="/portal/results" className="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-accent">결과자료 {it.resultCount} <ArrowRight size={13} /></Link>}
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <ol className="space-y-2 border-l-2 border-line pl-4">
          {history.map((a) => (
            <li key={a.id} className="relative text-[0.85rem]"><span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-accent" /><span className="text-ink-2">{historyText(a)}</span><span className="ml-2 text-[0.75rem] text-ink-3">{fmtRelative(a.at)}</span></li>
          ))}
        </ol>
      )}
    </Card>
  );
}

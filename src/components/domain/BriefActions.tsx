"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import type { BriefAction, BriefItem, DraftKind } from "@/lib/brief";
import type { InternalStage } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { INTERNAL_STAGES, stageLabel } from "@/lib/stages";
import { recommendServices, SERVICES } from "@/lib/services";
import { Button, Card, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { NewScheduleModal, NewTaskModal } from "./CreateModals";

/* ---------- 단계 변경 (브리핑에서 바로) ---------- */

function StageModal({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const projects = useStore((s) => s.projects);
  const companies = useStore((s) => s.companies);
  const change = useStore((s) => s.changeProjectStage);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const p = projects.find((x) => x.id === projectId);
  if (!p) return null;
  const c = companies.find((x) => x.id === p.companyId);
  const idx = INTERNAL_STAGES.findIndex((s) => s.key === p.stage);
  const next = INTERNAL_STAGES[idx + 1]?.key;
  return (
    <Modal open={!!projectId} onClose={onClose} title="단계 변경" size="sm">
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem]">
        <b>{c?.name}</b> · {p.name}
        <div className="mt-0.5 text-ink-2">현재 {stageLabel(p.stage)}</div>
      </div>
      <p className="mt-3 text-[0.82rem] text-ink-3">단계를 바꾸면 고객 Portal의 진행률과 안내 문구가 함께 바뀌고 알림이 전송됩니다.</p>
      <div className="mt-2 space-y-1.5">
        {INTERNAL_STAGES.map((s) => (
          <button
            key={s.key}
            disabled={s.key === p.stage}
            onClick={() => { change(p.id, s.key as InternalStage, me); toast(`단계가 '${s.label}'(으)로 변경되었습니다. 고객 Portal에 반영됩니다.`); onClose(); }}
            className={cx(
              "pressable flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-[0.9rem] font-semibold",
              s.key === p.stage ? "border-accent bg-soft text-accent" : s.key === next ? "border-line-2 hover:bg-surface-2" : "border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            {s.label}
            {s.key === p.stage ? <span className="text-[0.75rem]">현재</span> : s.key === next ? <span className="text-[0.75rem] text-ink-3">다음 단계</span> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- 매출기회 등록 (브리핑에서 바로) ---------- */

function RaiseOppModal({ companyId, onClose }: { companyId: string | null; onClose: () => void }) {
  const st = useStore();
  const raise = useStore((s) => s.raiseOpportunity);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const [picked, setPicked] = useState<string | null>(null);
  const c = st.companies.find((x) => x.id === companyId);
  if (!c) return null;

  const existing = new Set(st.opportunities.filter((o) => o.companyId === c.id).map((o) => o.serviceKey));
  const recos = recommendServices({ company: c, projects: st.projects.filter((p) => p.companyId === c.id), contracts: st.contracts.filter((x) => x.companyId === c.id), existing }, 4);
  const rest = SERVICES.filter((s) => !existing.has(s.key) && !recos.some((r) => r.service.key === s.key));
  const reasonOf = (key: string) => recos.find((r) => r.service.key === key)?.reason;

  return (
    <Modal
      open={!!companyId}
      onClose={onClose}
      title="매출기회로 등록"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="accent"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              raise({ companyId: c.id, serviceKey: picked, reason: reasonOf(picked), source: "rule" }, me, st.session?.role ?? "consultant");
              toast("매출기회로 등록했습니다. 담당자에게 상담 연락 업무가 생성되었습니다.");
              setPicked(null);
              onClose();
            }}
          >
            등록
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem] font-semibold">{c.name}</div>
      <p className="mt-3 text-[0.82rem] text-ink-3">어떤 항목으로 이어볼지 고르세요. 등록하면 담당자에게 상담 연락 업무가 자동으로 생성됩니다.</p>
      <div className="mt-2 space-y-1.5">
        {recos.map(({ service, reason }) => (
          <button key={service.key} onClick={() => setPicked(service.key)} aria-pressed={picked === service.key} className={cx("pressable block w-full rounded-xl border px-4 py-2.5 text-left", picked === service.key ? "border-accent bg-soft" : "border-line hover:bg-surface-2")}>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{service.name}</span>
              <span className="rounded-md bg-surface-2 px-1.5 text-[0.7rem] font-bold text-ink-3">추천</span>
            </div>
            <div className="mt-0.5 text-[0.8rem] text-ink-2">{reason}</div>
          </button>
        ))}
        {rest.map((service) => (
          <button key={service.key} onClick={() => setPicked(service.key)} aria-pressed={picked === service.key} className={cx("pressable block w-full rounded-xl border px-4 py-2 text-left text-[0.9rem] font-semibold", picked === service.key ? "border-accent bg-soft" : "border-line text-ink-2 hover:bg-surface-2")}>
            {service.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- 실행 바 ---------- */

const ICON: Partial<Record<BriefAction["kind"], React.ReactNode>> = {
  draft: <Sparkles size={14} />,
  complete_task: <Check size={14} />,
  change_stage: <ArrowRight size={14} />,
  raise_opp: <TrendingUp size={14} />,
};

/**
 * 브리핑이 "무엇을 하라"까지만 말하고 끝나면 결국 다른 화면을 찾아가야 한다.
 * 여기서 바로 실행되게 하고, 실행은 전부 기존 store action을 거치므로 Evidence가 그대로 남는다.
 */
export function BriefActionBar({ item }: { item: BriefItem }) {
  const updateTask = useStore((s) => s.updateTaskStatus);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const openDraft = useUi((s) => s.openDraft);
  const [stageFor, setStageFor] = useState<string | null>(null);
  const [oppFor, setOppFor] = useState<string | null>(null);
  const [schedFor, setSchedFor] = useState<{ companyId?: string; projectId?: string } | null>(null);
  const [taskFor, setTaskFor] = useState<{ companyId?: string; projectId?: string } | null>(null);

  const run = (a: BriefAction) => {
    switch (a.kind) {
      case "draft": {
        const { draftKind, ...ctx } = a.payload ?? {};
        openDraft({ kind: (draftKind as DraftKind) ?? "progress_update", ctx });
        break;
      }
      case "complete_task":
        // 완료하면 규칙이 다시 계산되어 이 항목 자체가 브리핑에서 사라진다 — 그게 처리됐다는 신호다.
        if (item.taskId) {
          updateTask(item.taskId, "done", me);
          toast("업무를 완료 처리했습니다. 브리핑에서 내려갑니다.");
        }
        break;
      case "add_task":
        setTaskFor({ companyId: item.companyId, projectId: item.projectId });
        break;
      case "add_schedule":
        setSchedFor({ companyId: item.companyId, projectId: item.projectId });
        break;
      case "change_stage":
        setStageFor(item.projectId ?? null);
        break;
      case "raise_opp":
        setOppFor(item.companyId ?? null);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {item.actions.map((a) =>
          a.kind === "open" ? (
            <Link key={a.label} href={item.href} className={cx("pressable inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-semibold transition-colors", a.primary ? "border-accent bg-accent text-accent-ink hover:brightness-105" : "border-line-2 text-ink-2 hover:bg-surface-2")}>
              {a.label} <ArrowRight size={13} />
            </Link>
          ) : (
            <button key={a.label} onClick={() => run(a)} className={cx("pressable inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-semibold transition-colors", a.primary ? "border-accent bg-accent text-accent-ink hover:brightness-105" : "border-line-2 text-ink-2 hover:bg-surface-2")}>
              {ICON[a.kind]} {a.label}
            </button>
          ),
        )}
      </div>

      <StageModal projectId={stageFor} onClose={() => setStageFor(null)} />
      <RaiseOppModal companyId={oppFor} onClose={() => setOppFor(null)} />
      <NewScheduleModal open={!!schedFor} onClose={() => setSchedFor(null)} companyId={schedFor?.companyId} projectId={schedFor?.projectId} />
      <NewTaskModal open={!!taskFor} onClose={() => setTaskFor(null)} companyId={taskFor?.companyId} projectId={taskFor?.projectId} />
    </>
  );
}

/** 대시보드 상단 — 오늘 실행 가능한 항목이 몇 건인지 한 줄로 */
export function BriefActionHint({ items }: { items: BriefItem[] }) {
  const runnable = items.filter((i) => i.actions.some((a) => a.kind !== "open")).length;
  if (runnable === 0) return null;
  return (
    <Card className="flex items-center gap-3 border-accent/40 px-4 py-3">
      <ShieldCheck size={18} className="shrink-0 text-accent" />
      <span className="text-[0.88rem] text-ink-2">
        <b className="text-ink">{runnable}건</b>은 이 화면에서 바로 처리할 수 있습니다. 초안 작성·업무 등록·단계 변경은 항목 안의 버튼으로 실행됩니다.
      </span>
    </Card>
  );
}

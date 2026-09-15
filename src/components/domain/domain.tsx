"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { AlertTriangle, Archive, ArrowRight, Building2, KeyRound, Pencil, ShieldAlert, Trash2, UserPlus, CalendarDays, CheckCircle2, ChevronDown, FileUp, MessageSquare, Clock, FileText, RefreshCw, Sparkles, Upload, UserCheck, Search, Briefcase, Bell, LogIn, Download, RotateCcw, TrendingUp, ShieldCheck, ClipboardList, UserMinus, Repeat, Receipt } from "lucide-react";
import type { Activity, DocStatus, InternalStage, Schedule, TaskStatus, Priority, InquiryStatus } from "@/lib/types";
import { DOC_STATUS, INQUIRY_STATUS, PRIORITY, SCHEDULE_TYPE, TASK_STATUS, stageLabel, stageProgress } from "@/lib/stages";
import type { BriefItem } from "@/lib/brief";
import { fmtDateTime, fmtRelative, fmtTime, relativeDay, fmtDate } from "@/lib/format";
import { Badge, MoreButton, cx, type Tone } from "@/components/ui/ui";
import { useStore } from "@/lib/store";
import { BriefActionBar } from "./BriefActions";

export function DocStatusBadge({ status, client }: { status: DocStatus; client?: boolean }) {
  const s = DOC_STATUS[status];
  return <Badge tone={s.tone}>{client ? s.clientLabel : s.label}</Badge>;
}
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY[priority];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function InquiryStatusBadge({ status, client }: { status: InquiryStatus; client?: boolean }) {
  const s = INQUIRY_STATUS[status];
  return <Badge tone={s.tone}>{client ? s.clientLabel : s.label}</Badge>;
}
export function StageBadge({ stage }: { stage: InternalStage }) {
  const tone: Tone = stage === "done" || stage === "aftercare" ? "success" : stage === "doc_request" || stage === "review" ? "warning" : stage === "inquiry" || stage === "consult" ? "neutral" : "info";
  return <Badge tone={tone}>{stageLabel(stage)}</Badge>;
}

export function StageProgressBar({ stage, className }: { stage: InternalStage; className?: string }) {
  return (
    <div className={cx("progress", className)}>
      <span style={{ width: `${stageProgress(stage)}%` }} />
    </div>
  );
}

export function DueText({ iso, pending = true }: { iso: string; pending?: boolean }) {
  const now = new Date();
  if (!pending) return <span className="tnum text-ink-3">{fmtDate(iso)}</span>;
  const rel = relativeDay(iso, now);
  const overdue = rel.includes("지남") || rel === "어제";
  const today = rel === "오늘";
  return <span className={cx("tnum font-semibold", overdue ? "text-error" : today ? "text-accent" : "text-ink")}>{today ? `오늘 ${fmtTime(iso)}` : rel === "내일" ? "내일" : overdue ? (rel === "어제" ? "1일 지남" : rel) : fmtDate(iso)}</span>;
}

/* ---------- Today Brief list ---------- */
const KIND_ICON: Record<BriefItem["kind"], ReactNode> = {
  doc_overdue: <AlertTriangle size={18} />,
  doc_due_today: <Clock size={18} />,
  revision_pending: <RefreshCw size={18} />,
  project_stalled: <Briefcase size={18} />,
  meeting_today: <CalendarDays size={18} />,
  inquiry_open: <MessageSquare size={18} />,
  task_overdue: <CheckCircle2 size={18} />,
  contract_pending: <FileText size={18} />,
  churn_risk: <UserMinus size={18} />,
  reengage: <Repeat size={18} />,
  quote_pending: <Receipt size={18} />,
};

export function BriefList({ items, limit, compact }: { items: BriefItem[]; limit?: number; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  // 처리하면 규칙상 항목이 즉시 사라진다. 잘못 눌렀을 때 되돌릴 수 있게 잠시 붙잡아 둔다.
  const [handled, setHandled] = useState<BriefItem[]>([]);
  const updateTask = useStore((s) => s.updateTaskStatus);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const [expanded, setExpanded] = useState(false);
  const INITIAL = 5;
  const list = limit ? items.slice(0, limit) : expanded ? items : items.slice(0, INITIAL);
  const hiddenCount = limit ? 0 : items.length - list.length;

  const undoStrip = handled.length > 0 && (
    <div className="space-y-2">
      {handled.map((h) => (
        <div key={h.id} className="anim-pop-in flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success-bg px-4 py-2.5 text-[0.85rem]">
          <CheckCircle2 size={16} className="shrink-0 text-success" />
          <span className="min-w-0 flex-1 truncate font-semibold text-success">{h.title}</span>
          <button
            onClick={() => { if (h.taskId) updateTask(h.taskId, "todo", me); setHandled((xs) => xs.filter((x) => x.id !== h.id)); toast("완료를 취소했습니다."); }}
            className="pressable shrink-0 rounded-lg border border-success/40 px-2.5 py-1 text-[0.8rem] font-semibold text-success hover:bg-success/10"
          >
            되돌리기
          </button>
          <button onClick={() => setHandled((xs) => xs.filter((x) => x.id !== h.id))} className="pressable shrink-0 rounded-lg px-2 py-1 text-[0.8rem] text-success/80 hover:bg-success/10">확인</button>
        </div>
      ))}
    </div>
  );

  if (list.length === 0)
    return (
      <div className="space-y-2">
        {undoStrip}
        <div className="flex items-center gap-3 rounded-xl bg-success-bg px-4 py-4 text-[0.95rem] font-semibold text-success">
          <CheckCircle2 size={20} /> 오늘 먼저 처리할 긴급 항목이 없습니다.
        </div>
      </div>
    );
  return (
    <div className="space-y-2">
      {undoStrip}
      {list.map((it) => {
        const expanded = open === it.id;
        return (
          <div key={it.id} className={cx("card overflow-hidden transition-colors", it.priority === "urgent" ? "border-l-4 border-l-error" : "border-l-4 border-l-line-2")}>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", it.priority === "urgent" ? "bg-error-bg text-error" : "bg-surface-2 text-ink-2")}>{KIND_ICON[it.kind]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone={it.priority === "urgent" ? "error" : "neutral"}>{it.priority === "urgent" ? "긴급" : "보통"}</Badge>
                  <span className="font-semibold">{it.title}</span>
                </div>
                {!compact && <div className="mt-0.5 text-[0.82rem] text-ink-2">다음 Action: {it.nextAction}</div>}
              </div>
            </div>
            {!compact && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5">
                <BriefActionBar item={it} onCompleted={(x) => setHandled((xs) => [x, ...xs.filter((y) => y.id !== x.id)])} />
                <button onClick={() => setOpen(expanded ? null : it.id)} className="pressable ml-auto flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[0.8rem] font-semibold text-ink-2 hover:bg-surface-2" aria-expanded={expanded}>
                  <Sparkles size={14} className="text-accent" /> 왜? <ChevronDown size={14} className={cx("transition-transform", expanded && "rotate-180")} />
                </button>
              </div>
            )}
            {compact && (
              <div className="border-t border-line px-4 py-2">
                <button onClick={() => setOpen(expanded ? null : it.id)} className="pressable flex items-center gap-1 rounded-lg px-2 py-1 text-[0.8rem] font-semibold text-ink-2 hover:bg-surface-2" aria-expanded={expanded}>
                  <Sparkles size={14} className="text-accent" /> 왜? <ChevronDown size={14} className={cx("transition-transform", expanded && "rotate-180")} />
                </button>
              </div>
            )}
            {expanded && (
              <div className="anim-fade border-t border-line bg-surface-2/60 px-4 py-3 text-[0.85rem]">
                <div className="mb-1 font-bold text-ink-2">근거</div>
                <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
                  {it.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-ink-3">규칙 기반 판단 · 실제 데이터에서 계산됨</span>
                  <Link href={it.href} className="shrink-0 font-semibold text-accent">해당 화면 →</Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!limit && items.length > INITIAL && (
        <MoreButton hidden={expanded ? items.length - INITIAL : hiddenCount} open={expanded} onToggle={() => setExpanded((v) => !v)} />
      )}
    </div>
  );
}

/* ---------- Activity feed (Evidence) ---------- */
const ACT_ICON: Record<Activity["type"], ReactNode> = {
  samples_removed: <Trash2 size={14} />,
  samples_restored: <RotateCcw size={14} />,
  company_doc_read: <FileText size={14} />,
  live_mode_changed: <ShieldCheck size={14} />,
  backup_exported: <Download size={14} />,
  backup_imported: <Upload size={14} />,
  org_updated: <Pencil size={14} />,
  quote_updated: <Pencil size={14} />,
  contract_created: <FileText size={14} />,
  contract_updated: <Pencil size={14} />,
  result_withdrawn: <RotateCcw size={14} />,
  rule_task_created: <Repeat size={14} />,
  user_created: <UserPlus size={14} />,
  user_updated: <Pencil size={14} />,
  user_deactivated: <UserMinus size={14} />,
  password_reset: <KeyRound size={14} />,
  doc_request_updated: <Pencil size={14} />,
  doc_request_canceled: <Trash2 size={14} />,
  consultation_updated: <Pencil size={14} />,
  consultation_deleted: <Trash2 size={14} />,
  company_archived: <Archive size={14} />,
  project_archived: <Archive size={14} />,
  company_created: <Building2 size={14} />,
  company_updated: <Pencil size={14} />,
  project_updated: <Pencil size={14} />,
  schedule_updated: <Pencil size={14} />,
  schedule_deleted: <Trash2 size={14} />,
  task_updated: <Pencil size={14} />,
  task_deleted: <Trash2 size={14} />,
  sign_in: <LogIn size={14} />,
  sign_in_failed: <ShieldAlert size={14} />,
  sign_out: <LogIn size={14} />,
  permission_denied: <ShieldAlert size={14} />,
  consultation_logged: <MessageSquare size={14} />,
  contract_sent: <FileText size={14} />,
  contract_signed: <UserCheck size={14} />,
  project_created: <Briefcase size={14} />,
  document_requested: <FileUp size={14} />,
  document_uploaded: <Upload size={14} />,
  document_reviewed: <CheckCircle2 size={14} />,
  document_revision_requested: <RefreshCw size={14} />,
  project_stage_changed: <ArrowRight size={14} />,
  inquiry_created: <MessageSquare size={14} />,
  inquiry_answered: <MessageSquare size={14} />,
  result_shared: <FileText size={14} />,
  schedule_created: <CalendarDays size={14} />,
  task_created: <CheckCircle2 size={14} />,
  task_completed: <CheckCircle2 size={14} />,
  portal_login: <LogIn size={14} />,
  result_downloaded: <Download size={14} />,
  opportunity_created: <TrendingUp size={14} />,
  opportunity_status_changed: <TrendingUp size={14} />,
  approval_requested: <ShieldCheck size={14} />,
  approval_decided: <ShieldCheck size={14} />,
  survey_submitted: <ClipboardList size={14} />,
  quote_created: <Receipt size={14} />,
  quote_sent: <Receipt size={14} />,
  quote_responded: <Receipt size={14} />,
  quote_converted: <UserCheck size={14} />,
  ai_action_taken: <Sparkles size={14} />,
  evidence_exported: <Download size={14} />,
  demo_reset: <RotateCcw size={14} />,
};

export function ActivityFeed({ items, limit, showCompany }: { items: Activity[]; limit?: number; showCompany?: boolean }) {
  const users = useStore((s) => s.users);
  const companies = useStore((s) => s.companies);
  const list = (limit ? items.slice(0, limit) : items).sort((a, b) => b.at.localeCompare(a.at));
  if (!list.length) return <div className="py-8 text-center text-[0.9rem] text-ink-3">아직 기록된 활동이 없습니다.</div>;
  return (
    <ol className="relative space-y-0 border-l border-line pl-5">
      {list.map((a) => {
        const actor = a.actorRole === "system" ? "시스템" : users.find((u) => u.id === a.actorId)?.name ?? a.actorId;
        const isClient = a.actorRole === "client";
        return (
          <li key={a.id} className="relative pb-4 last:pb-0">
            <span className={cx("absolute -left-[29px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface", isClient ? "bg-soft text-accent" : a.actorRole === "system" ? "bg-surface-2 text-ink-3" : "bg-info-bg text-info")}>{ACT_ICON[a.type]}</span>
            <div className="text-[0.9rem] font-semibold">{a.text}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.78rem] text-ink-3">
              <span>{actor}{isClient ? " (고객)" : ""}</span>
              {showCompany && a.companyId && <span>· {companies.find((c) => c.id === a.companyId)?.name}</span>}
              <span>· {fmtRelative(a.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Schedule item ---------- */
export function ScheduleItem({ s, showCompany, client, onEdit }: { s: Schedule; showCompany?: boolean; client?: boolean; onEdit?: (id: string) => void }) {
  const companies = useStore((s) => s.companies);
  const t = SCHEDULE_TYPE[s.type];
  return (
    <div className="group flex items-start gap-3 py-2.5">
      <div className="tnum w-14 shrink-0 text-center">
        <div className="text-[0.7rem] font-semibold text-ink-3">{relativeDay(s.start)}</div>
        <div className="text-[0.95rem] font-bold">{fmtTime(s.start)}</div>
      </div>
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
      <div className="min-w-0 flex-1">
        {/* 모바일에서는 시간 열을 빼면 200px 남짓이라 제목이 절반쯤 잘린다. 두 줄까지 허용한다. */}
        <div className="line-clamp-2 font-semibold md:line-clamp-1">{s.title}</div>
        <div className="text-[0.8rem] text-ink-3">
          {t.label}
          {s.location ? ` · ${s.location}` : ""}
          {showCompany && s.companyId ? ` · ${companies.find((c) => c.id === s.companyId)?.name}` : ""}
          {!client && !s.visibleToClient ? " · 내부" : ""}
        </div>
      </div>
      <span className="hidden text-[0.78rem] text-ink-3 sm:block">{fmtDateTime(s.start)}</span>
      {onEdit && (
        <button onClick={() => onEdit(s.id)} aria-label={`${s.title} 수정`} className="pressable shrink-0 rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Pencil size={15} />
        </button>
      )}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-[10px] border border-line-2 bg-surface pl-9 pr-3 text-[0.9rem] placeholder:text-ink-3 focus:border-accent" />
    </div>
  );
}

export { Bell };

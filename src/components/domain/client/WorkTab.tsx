"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, ClipboardCopy, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Company, Project, WorkStatus } from "@/lib/types";
import { OVERDUE_CLS, WORK_STATUS, WORK_STATUS_ORDER, isOpen, workCell } from "@/lib/work-status";
import { dueText, todayYmd } from "@/lib/vault";
import { documentRequestMessage, progressReportMessage } from "@/lib/ops-messages";
import { stageLabel } from "@/lib/stages";
import { addDays, iso } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

/** 상태 칩 — 현황표·카드 어디서나 같은 색 */
export function WorkChip({ project, today = todayYmd(), onClick, compact }: { project: Project; today?: string; onClick?: () => void; compact?: boolean }) {
  const c = workCell(project, today);
  const cls = c.overdue ? OVERDUE_CLS : WORK_STATUS[c.status].cls;
  const text = c.overdue ? `기한 ${dueText(c.daysLeft)}` : compact ? WORK_STATUS[c.status].short : WORK_STATUS[c.status].label;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold", cls, onClick && "pressable min-h-9 sm:min-h-0")}
      aria-label={onClick ? `${project.name} 상태 바꾸기 (지금 ${WORK_STATUS[c.status].label})` : undefined}>
      {text}{!c.overdue && c.dueSoon && <span className="font-bold text-warning">· {dueText(c.daysLeft)}</span>}
    </Tag>
  );
}

/** 상태 고르기 — 여섯 가지와 한 줄 설명 */
export function WorkStatusSheet({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const setWork = useStore((s) => s.setWorkStatus);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  if (!project) return null;
  const cur = workCell(project, todayYmd()).status;
  return (
    <Modal open onClose={onClose} size="sm" title={<span className="block truncate">{project.name}</span>}>
      <div className="space-y-1.5" role="radiogroup" aria-label="진행 상태">
        {WORK_STATUS_ORDER.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={cur === w}
            onClick={() => { setWork(project.id, { workStatus: w }, me); toast(`${project.name} · ${WORK_STATUS[w].label}`); onClose(); }}
            className={cx("pressable flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left", cur === w ? "border-accent bg-soft/40" : "border-line hover:bg-surface-2")}>
            <span className={cx("shrink-0 rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold", WORK_STATUS[w].cls)}>{WORK_STATUS[w].short}</span>
            <span className="min-w-0 flex-1 text-[0.85rem] text-ink-2">{WORK_STATUS[w].hint}</span>
            {cur === w && <Check size={16} className="shrink-0 text-accent" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function MessageModal({ msg, onClose }: { msg: { title: string; desc: string; text: string } | null; onClose: () => void }) {
  const [done, setDone] = useState(false);
  if (!msg) return null;
  return (
    <Modal open onClose={onClose} size="md" title={msg.title}
      footer={<><span className="mr-auto text-[0.78rem] text-ink-3">복사해서 카카오톡·문자·메일에 붙여넣으세요.</span>
        <Button variant="accent" icon={done ? <Check size={15} /> : <ClipboardCopy size={15} />} onClick={async () => { try { await navigator.clipboard.writeText(msg.text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* 권한 없음 */ } }}>{done ? "복사했습니다" : "복사"}</Button></>}>
      <p className="mb-2 text-[0.82rem] text-ink-3">{msg.desc}</p>
      <Textarea readOnly rows={12} value={msg.text} aria-label="보낼 문구" />
    </Modal>
  );
}

export function WorkTab({ company }: { company: Company }) {
  const projects = useStore((s) => s.projects);
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const files = useStore((s) => s.companyFiles);
  const docRequests = useStore((s) => s.docRequests);
  const role = useStore((s) => s.session?.role);
  const may = can(role, "project.update");
  const [msg, setMsg] = useState<{ title: string; desc: string; text: string } | null>(null);
  const today = todayYmd();
  const mine = projects.filter((p) => p.companyId === company.id && !p.archived);
  const cells = mine.map((p) => workCell(p, today))
    .sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || Number(b.overdue) - Number(a.overdue) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

  return (
    <div className="space-y-3" id="work-tab">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[0.82rem] text-ink-3">단계는 &ldquo;어디까지 왔나&rdquo;, 진행 상태는 &ldquo;지금 공이 누구에게 있나&rdquo;입니다. 고객 회신을 7일 넘게 기다리면 먼저 알려 드립니다.</p>
        <Button size="sm" variant="accent" icon={<Send size={14} />} onClick={() => setMsg({ title: "서류 요청 문구", desc: "서류함에서 아직 없거나 만료된 서류와, 고객이 아직 내지 않은 요청자료만 골랐습니다.", text: documentRequestMessage(company, vault, files.filter((f) => f.companyId === company.id), docRequests) })}>서류 요청 문구</Button>
        <Button size="sm" variant="outline" icon={<ClipboardCopy size={14} />} onClick={() => setMsg({ title: "진행 상황 보고 문구", desc: "고객에게 공개한 프로젝트의 현재 상태와 다음 단계를 정리했습니다.", text: progressReportMessage(company, projects) })}>진행 상황 보고 문구</Button>
      </div>
      {cells.length === 0 ? (
        <Card><EmptyState title="진행 중인 업무가 없습니다" desc="프로젝트를 등록하면 여기서 상태·마감·다음 할 일을 관리합니다." /></Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {cells.map((c) => <WorkCard key={c.project.id} project={c.project} may={may} />)}
        </div>
      )}
      <MessageModal msg={msg} onClose={() => setMsg(null)} />
    </div>
  );
}

function WorkCard({ project: p, may }: { project: Project; may: boolean }) {
  const setWork = useStore((s) => s.setWorkStatus);
  const me = useStore((s) => s.session?.userId) ?? "";
  const today = todayYmd();
  const c = workCell(p, today);
  const [open, setOpen] = useState(c.overdue || c.status === "in_progress");
  const [next, setNext] = useState(p.nextStep ?? "");
  const edge = c.overdue ? "bg-error" : c.dueSoon ? "bg-warning" : c.status === "waiting_client" ? "bg-warning/60" : c.status === "done" ? "bg-success" : "bg-line-2";
  const setDue = (days: number) => setWork(p.id, { dueDate: iso(addDays(new Date(), days, 18)) }, me);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface" data-project={p.id}>
      <span className={cx("absolute inset-y-0 left-0 w-1", edge)} aria-hidden />
      <div className="flex flex-wrap items-center gap-2 py-3 pl-4 pr-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown size={16} className={cx("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
          <span className="min-w-0">
            <span className={cx("block truncate font-bold", c.status === "not_applicable" && "text-ink-3 line-through")}>{p.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-3">
              <span>{p.type}</span><span>· {stageLabel(p.stage)}</span>
              {c.waitingDays !== null && <span className={c.waitingDays >= 7 ? "font-semibold text-warning" : ""}>· 회신 {c.waitingDays}일째 대기</span>}
            </span>
            {!open && p.nextStep && <span className="mt-0.5 block truncate text-[0.8rem] text-ink-2">다음: {p.nextStep}</span>}
          </span>
        </button>
        {may ? (
          <select value={c.status} onChange={(e) => setWork(p.id, { workStatus: e.target.value as WorkStatus }, me)} aria-label={`${p.name} 진행 상태`}
            className={cx("h-9 shrink-0 rounded-full border px-3 text-[0.8rem] font-semibold", WORK_STATUS[c.status].cls)}>
            {WORK_STATUS_ORDER.map((w) => <option key={w} value={w}>{WORK_STATUS[w].label}</option>)}
          </select>
        ) : <WorkChip project={p} />}
        {isOpen(c.status) && c.daysLeft !== null && (c.overdue || c.dueSoon) && <Badge tone={c.overdue ? "error" : "warning"}>{dueText(c.daysLeft)}</Badge>}
      </div>
      {open && (
        <div className="space-y-2.5 border-t border-line py-3 pl-4 pr-3">
          <div className="flex flex-wrap items-center gap-2 text-[0.8rem]">
            <span className="text-ink-3">마감·목표일</span>
            <b className="tnum">{p.dueDate ? p.dueDate.slice(0, 10) : "미정"}</b>
            {c.daysLeft !== null && isOpen(c.status) && <span className={c.overdue ? "text-error" : "text-ink-3"}>({dueText(c.daysLeft)})</span>}
            {may && (
              <span className="flex flex-wrap gap-1">
                {([["오늘", 0], ["내일", 1], ["1주", 7], ["2주", 14], ["1개월", 30]] as const).map(([l, d]) => (
                  <button key={l} type="button" onClick={() => setDue(d)} className="pressable inline-flex min-h-9 items-center rounded-full border border-line px-3 text-[0.72rem] font-semibold text-ink-2 hover:bg-surface-2 sm:min-h-0 sm:px-2 sm:py-0.5">{l}</button>
                ))}
              </span>
            )}
          </div>
          <label className="block text-[0.8rem] text-ink-2">다음에 할 일
            <Input className="mt-1" value={next} disabled={!may} onChange={(e) => setNext(e.target.value)} placeholder="예: 연구전담요원 재직증명 회신 받기" aria-label={`${p.name} 다음에 할 일`}
              onBlur={() => { if (next.trim() !== (p.nextStep ?? "")) setWork(p.id, { nextStep: next }, me); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
          </label>
          <Link href={`/ax/projects/${p.id}`} className="link-more text-[0.8rem]">프로젝트 자세히 →</Link>
        </div>
      )}
    </div>
  );
}

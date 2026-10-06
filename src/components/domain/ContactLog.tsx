"use client";

import { useMemo, useState } from "react";
import { PhoneCall } from "lucide-react";
import { useStore } from "@/lib/store";
import { contactStatus, type ContactSources, type ContactStatus } from "@/lib/contact";
import { ruleDays } from "@/lib/rules";
import { addDays, fmtDate } from "@/lib/format";
import type { Company } from "@/lib/types";
import { Modal } from "@/components/ui/overlay";
import { Button, Field, Input, cx } from "@/components/ui/ui";
import { useMay } from "@/components/domain/EntityModals";

/** 연락 공백 계산에 쓰는 기록 묶음 + 기준일(설정의 '고객 연락 공백' 규칙과 같은 값) */
export function useContactSources(): { src: ContactSources; cycle: number } {
  const consultations = useStore((s) => s.consultations);
  const inquiries = useStore((s) => s.inquiries);
  const schedules = useStore((s) => s.schedules);
  const tasks = useStore((s) => s.tasks);
  const journal = useStore((s) => s.journal);
  const autoRules = useStore((s) => s.settings.autoRules);
  const src = useMemo(() => ({ consultations, inquiries, schedules, tasks, journal }), [consultations, inquiries, schedules, tasks, journal]);
  return { src, cycle: ruleDays(autoRules, "no_contact") };
}

export function useContactStatus(company?: Company): ContactStatus & { cycle: number } {
  const { src, cycle } = useContactSources();
  return useMemo(() => (company ? { ...contactStatus(company, src, cycle), cycle } : { due: false, cycle }), [company, src, cycle]);
}

/** "마지막 연락 9일 전 · 상담" — 기준일을 넘기면 빨갛게 */
export function ContactLine({ status, className }: { status: ContactStatus & { cycle: number }; className?: string }) {
  if (!status.last || status.days === undefined) return null;
  const when = status.days === 0 ? "오늘" : `${status.days}일 전`;
  const tail = status.planned ? `미팅 예정 ${fmtDate(status.planned)}` : !status.due && status.left !== undefined ? (status.left > 0 ? `다음 연락까지 ${status.left}일` : "오늘 연락할 때") : `기준 ${status.cycle}일`;
  // 좁은 화면에서는 덩어리째 줄을 바꾼다 — 글자 중간에서 끊기지 않게
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-x-1.5", status.due ? "font-semibold text-error" : "text-ink-2", className)} data-testid="contact-line">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><PhoneCall size={14} className={status.due ? "text-error" : "text-ink-3"} />{status.due ? `연락 ${status.days}일 없음` : `마지막 연락 ${when}`}</span>
      <span className={cx("whitespace-nowrap", status.due ? "font-medium" : "text-ink-3")}>· {status.last.how}</span>
      <span className={cx("whitespace-nowrap", status.due ? "font-medium" : "text-ink-3")}>· {tail}</span>
    </span>
  );
}

const METHODS = ["전화", "카톡·문자", "방문", "메일"] as const;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * 연락함 — 전화 · 카톡처럼 시스템 밖에서 한 연락을 한 번에 남긴다.
 * 업무 일기 '통화'로 쌓이고(고객에게 안 보임), 마지막 연락일이 바뀌며, 열려 있던 '연락 공백' 업무는 끝난 것으로 닫는다.
 */
export function LogContactModal({ company, open, onClose }: { company: Company; open: boolean; onClose: () => void }) {
  const add = useStore((s) => s.addJournal);
  const tasks = useStore((s) => s.tasks);
  const update = useStore((s) => s.updateTaskStatus);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId ?? "");
  const cycle = useContactSources().cycle;
  const [how, setHow] = useState<(typeof METHODS)[number]>("전화");
  const [memo, setMemo] = useState("");
  const [day, setDay] = useState(() => ymd(new Date()));
  const submit = () => {
    if (!day || day > ymd(new Date())) { toast("연락한 날을 오늘이나 그 전으로 넣어 주세요.", "error"); return; }
    const id = add({ companyId: company.id, type: "call", content: `[${how}] ${memo.trim() || "연락함"}`, entryDate: day }, me);
    if (!id) return;
    // 이 기업의 열린 '연락 공백' 업무는 방금 연락으로 끝났다
    const closed = tasks.filter((t) => t.companyId === company.id && t.ruleKey?.startsWith(`no_contact:${company.id}:`) && (t.status === "todo" || t.status === "doing"));
    for (const t of closed) update(t.id, "done", me);
    const next = fmtDate(addDays(new Date(`${day}T12:00:00`), cycle).toISOString());
    toast(`연락을 기록했습니다 · 다음 연락 기준 ${next}${closed.length ? ` · 연락 업무 ${closed.length}건 완료` : ""}`);
    setMemo("");
    setDay(ymd(new Date()));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={`연락함 — ${company.name}`} size="sm" footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>기록</Button></>}>
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">어떻게</div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="연락 방법">
            {METHODS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={how === m} onClick={() => setHow(m)}
                className={cx("pressable rounded-lg border px-3 py-1.5 text-[0.88rem] font-semibold", how === m ? "border-accent bg-soft text-accent-strong" : "border-line text-ink-2 hover:border-line-2")}>{m}</button>
            ))}
          </div>
        </div>
        <Field label="메모 (선택)" hint="고객에게 보이지 않습니다. 업무 일기 '통화'로 남습니다.">
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} placeholder="예: 중간보고 일정 안내, 다음 주 방문 약속" autoFocus maxLength={200} />
        </Field>
        <Field label="연락한 날">
          <Input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} aria-label="연락한 날" />
          <span className="mt-1 flex gap-1">{([["오늘", 0], ["어제", 1]] as const).map(([l, n]) => <button key={l} type="button" onClick={() => setDay(ymd(addDays(new Date(), -n)))} className={cx("pressable rounded-md px-2 py-0.5 text-[0.75rem] font-semibold", day === ymd(addDays(new Date(), -n)) ? "bg-soft text-accent-strong" : "text-ink-3 hover:bg-surface-2")}>{l}</button>)}</span>
        </Field>
      </div>
    </Modal>
  );
}

/** 이 사람이 연락 기록을 남길 수 있는가 (업무 일기 쓰기 권한) */
export function useMayLogContact() {
  return useMay()("journal.write");
}

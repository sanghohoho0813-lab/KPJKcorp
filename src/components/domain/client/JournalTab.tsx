"use client";

import { useMemo, useState } from "react";
import { ListTodo, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Company, JournalEntry, JournalType } from "@/lib/types";
import { JOURNAL_ORDER, JOURNAL_TYPE } from "@/lib/journal";
import { todayYmd } from "@/lib/vault";
import { addDays, iso, fmtTime } from "@/lib/format";
import { Badge, Button, Card, EmptyState, Input, Textarea, cx } from "@/components/ui/ui";
import { Chip } from "@/components/ui/chips";
import { Confirm } from "@/components/ui/overlay";

/**
 * 업무 일기 — 통화·결정·막힘을 그때그때 한 줄씩. 고객에게는 보이지 않는다.
 * 기한이 있는 일은 여기 두지 않고 "할 일로" 버튼으로 업무함에 보낸다 — 챙길 일은 한 곳에서.
 */
export function JournalTab({ company }: { company: Company }) {
  const all = useStore((s) => s.journal);
  const users = useStore((s) => s.users);
  const role = useStore((s) => s.session?.role);
  const may = can(role, "journal.write");
  const [filter, setFilter] = useState<JournalType | "all">("all");
  const list = useMemo(() => all
    .filter((e) => e.companyId === company.id && (filter === "all" || e.type === filter))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt)), [all, company.id, filter]);
  const counts = (t: JournalType) => all.filter((e) => e.companyId === company.id && e.type === t).length;

  return (
    <div className="space-y-3" id="journal-tab">
      {may && <Composer companyId={company.id} />}
      <div role="group" aria-label="일기 종류" className="flex flex-wrap gap-1.5">
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>전체</Chip>
        {JOURNAL_ORDER.filter((t) => counts(t)).map((t) => <Chip key={t} selected={filter === t} onClick={() => setFilter(t)}>{JOURNAL_TYPE[t].label} {counts(t)}</Chip>)}
      </div>
      {list.length === 0 ? (
        <Card><EmptyState title="이 기업에 대한 기록이 없습니다" desc="통화·결정·막힌 일을 남기면 이 기업의 이력이 시간순으로 이어집니다. 고객에게는 보이지 않습니다." /></Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((e) => <EntryRow key={e.id} e={e} company={company} may={may} author={users.find((u) => u.id === e.authorId)?.name ?? ""} />)}
        </Card>
      )}
    </div>
  );
}

function Composer({ companyId }: { companyId: string }) {
  const add = useStore((s) => s.addJournal);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [type, setType] = useState<JournalType>("note");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [err, setErr] = useState("");
  const save = () => {
    if (!content.trim()) { setErr("내용을 입력해 주세요."); return; }
    if (add({ companyId, type, content, entryDate: date || todayYmd() }, me)) { toast("기록했습니다."); setContent(""); setErr(""); }
  };
  return (
    <Card className="p-4">
      <div role="group" aria-label="기록 종류" className="mb-2 flex flex-wrap gap-1.5">
        {JOURNAL_ORDER.map((t) => <Chip key={t} selected={type === t} onClick={() => setType(t)}>{JOURNAL_TYPE[t].label}</Chip>)}
      </div>
      <Textarea rows={3} value={content} onChange={(e) => { setContent(e.target.value); setErr(""); }} placeholder={JOURNAL_TYPE[type].placeholder} aria-label="업무 일기 내용"
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save(); }} />
      {err && <p className="mt-1 text-[0.8rem] font-semibold text-error">{err}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" aria-label="날짜" />
        <span className="hidden text-[0.75rem] text-ink-3 md:inline">Ctrl+Enter 로 바로 기록</span>
        <Button variant="accent" className="ml-auto" onClick={save}>기록</Button>
      </div>
    </Card>
  );
}

function EntryRow({ e, company, may, author }: { e: JournalEntry; company: Company; may: boolean; author: string }) {
  const update = useStore((s) => s.updateJournal);
  const remove = useStore((s) => s.removeJournal);
  const createTask = useStore((s) => s.createTask);
  const toast = useStore((s) => s.toast);
  const role = useStore((s) => s.session?.role);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(e.content);
  const [confirm, setConfirm] = useState(false);
  const t = JOURNAL_TYPE[e.type];
  const toTask = () => {
    createTask({ title: `${company.name} · ${e.content.split("\n")[0].slice(0, 60)}`, companyId: company.id, type: "후속연락", dueDate: iso(addDays(new Date(), 3, 18)), assigneeId: company.consultantId || me, priority: "normal", memo: `업무 일기(${e.entryDate})에서 보냄` }, me);
    toast("업무함에 할 일로 보냈습니다. 기한은 3일 뒤입니다.");
  };
  return (
    <div className={cx("px-4 py-3", e.pinned && "bg-soft/30")} data-entry={e.id}>
      <div className="flex flex-wrap items-center gap-2 text-[0.78rem]">
        <Badge tone={t.tone}>{t.label}</Badge>
        {e.pinned && <Badge tone="accent"><Pin size={10} /> 고정</Badge>}
        <span className="tnum text-ink-3">{e.entryDate} · {fmtTime(e.createdAt)}</span>
        <span className="text-ink-3">· {author}</span>
        {may && (
          <span className="ml-auto flex items-center gap-0.5">
            {can(role, "task.create") && <button type="button" onClick={toTask} className="pressable icon-btn text-ink-3 hover:text-accent" aria-label="할 일로 보내기" title="업무함에 할 일로"><ListTodo size={15} /></button>}
            <button type="button" onClick={() => update(e.id, { pinned: !e.pinned }, me)} className="pressable icon-btn text-ink-3 hover:text-ink" aria-label={e.pinned ? "고정 풀기" : "위에 고정"}>{e.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
            <button type="button" onClick={() => { setText(e.content); setEditing(true); }} className="pressable icon-btn text-ink-3 hover:text-ink" aria-label="고치기"><Pencil size={15} /></button>
            <button type="button" onClick={() => setConfirm(true)} className="pressable icon-btn text-ink-3 hover:text-error" aria-label="지우기"><Trash2 size={15} /></button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <Textarea rows={3} value={text} onChange={(ev) => setText(ev.target.value)} aria-label="고칠 내용" />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>취소</Button>
            <Button size="sm" variant="accent" onClick={() => { update(e.id, { content: text }, me); setEditing(false); toast("수정했습니다."); }}>저장</Button>
          </div>
        </div>
      ) : <p className="mt-1.5 whitespace-pre-line text-[0.9rem] leading-relaxed">{e.content}</p>}
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger confirmText="지우기" title="기록 삭제" desc="이 기록을 지웁니다. 되돌릴 수 없습니다."
        onConfirm={() => { remove(e.id, me); setConfirm(false); toast("지웠습니다."); }} />
    </div>
  );
}

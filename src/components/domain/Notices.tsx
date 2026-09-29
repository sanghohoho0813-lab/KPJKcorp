"use client";

import { useState } from "react";
import { Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { fmtDate, fmtRelative } from "@/lib/format";
import type { Notice } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal, Confirm } from "@/components/ui/overlay";
import { Chip } from "@/components/ui/chips";

/**
 * 고객 공지.
 *
 * 일정은 "언제 무엇을", 공지는 "알아 두실 것"이다. 여러 고객에게 같은 안내를 해야 할 때
 * 카톡을 하나씩 보내는 대신 한 번 쓰면 해당 고객들의 Portal 과 알림함에 동시에 뜬다.
 */

/** 이 기업의 고객이 지금 볼 수 있는 공지 — 서버 권한 정책(notices_select)과 같은 조건이다 */
export function liveNoticesFor(notices: Notice[], companyId: string | undefined, nowIso: string): Notice[] {
  return notices
    .filter((n) => (!n.companyId || n.companyId === companyId) && n.publishedAt <= nowIso && (!n.expiresAt || n.expiresAt > nowIso))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.publishedAt.localeCompare(a.publishedAt));
}

const isLive = (n: Notice, nowIso: string) => n.publishedAt <= nowIso && (!n.expiresAt || n.expiresAt > nowIso);

/* ---------------- 고객 화면 ---------------- */

export function NoticeList({ items, limit, compact }: { items: Notice[]; limit?: number; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = limit ? items.slice(0, limit) : items;
  return (
    <div className="space-y-2">
      {list.map((n) => {
        const expanded = !compact || open === n.id;
        return (
          <div key={n.id} className={cx("rounded-xl border px-4 py-3", n.pinned ? "border-accent/40 bg-soft/40" : "border-line")}>
            <button
              type="button"
              onClick={() => compact && setOpen(open === n.id ? null : n.id)}
              aria-expanded={compact ? expanded : undefined}
              className={cx("flex w-full items-start gap-2 text-left", compact && "pressable")}
            >
              {n.pinned ? <Pin size={15} className="mt-1 shrink-0 text-accent" /> : <Megaphone size={15} className="mt-1 shrink-0 text-ink-3" />}
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{n.title}</span>
                <span className="mt-0.5 block text-[0.78rem] text-ink-3">{fmtDate(n.publishedAt, { year: true })}{n.expiresAt ? ` · ${fmtDate(n.expiresAt)}까지` : ""}</span>
              </span>
            </button>
            {expanded && n.body && <p className="mt-2 whitespace-pre-line pl-6 text-[0.9rem] leading-relaxed text-ink-2">{n.body}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 내부 화면 ---------------- */

export function NoticeManager() {
  const st = useStore();
  const role = st.session?.role;
  const may = can(role, "notice.write");
  const [editing, setEditing] = useState<Notice | "new" | null>(null);
  const [removing, setRemoving] = useState<Notice | null>(null);
  const remove = useStore((s) => s.removeNotice);
  const toast = useStore((s) => s.toast);
  const nowIso = new Date().toISOString();
  const list = [...st.notices].sort((a, b) => Number(isLive(b, nowIso)) - Number(isLive(a, nowIso)) || Number(!!b.pinned) - Number(!!a.pinned) || b.publishedAt.localeCompare(a.publishedAt));
  const who = (id: string) => st.users.find((u) => u.id === id)?.name ?? "";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[0.85rem] leading-relaxed text-ink-2">
          휴무·서류 제출 방법·제도 변경처럼 여러 고객에게 같은 말을 해야 할 때 씁니다. 게시하면 해당 고객의 Portal 과 알림함에 바로 뜹니다.
        </p>
        {may && <Button variant="accent" icon={<Plus size={16} />} onClick={() => setEditing("new")}>공지 작성</Button>}
      </div>
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={<Megaphone size={30} />} title="아직 게시한 공지가 없습니다" desc="첫 공지를 쓰면 고객 Portal 의 '일정 · 공지'와 홈 화면에 뜹니다."
            action={may ? <Button variant="outline" onClick={() => setEditing("new")}>공지 작성</Button> : undefined} />
        ) : (
          <div className="divide-y divide-line">
            {list.map((n) => {
              const live = isLive(n, nowIso);
              const target = n.companyId ? st.companies.find((c) => c.id === n.companyId)?.name ?? "기업" : "전체 고객";
              return (
                <div key={n.id} className={cx("flex items-start gap-3 px-4 py-3.5 md:px-5", !live && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={n.companyId ? "neutral" : "accent"}>{target}</Badge>
                      {n.pinned && <Badge tone="info">홈 상단 고정</Badge>}
                      {!live && <Badge>{n.publishedAt > nowIso ? "게시 예정" : "기간 종료"}</Badge>}
                      <span className="min-w-0 font-semibold">{n.title}</span>
                    </div>
                    {n.body && <p className="mt-1 line-clamp-2 whitespace-pre-line text-[0.85rem] text-ink-2">{n.body}</p>}
                    <div className="mt-1 text-[0.78rem] text-ink-3">
                      {fmtRelative(n.publishedAt)} · {who(n.authorId)}{n.expiresAt ? ` · ${fmtDate(n.expiresAt)}까지` : ""}{n.updatedAt ? " · 수정됨" : ""}
                    </div>
                  </div>
                  {may && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => setEditing(n)} aria-label={`${n.title} 수정`} className="pressable icon-btn text-ink-3 hover:bg-surface-2 hover:text-ink"><Pencil size={15} /></button>
                      <button onClick={() => setRemoving(n)} aria-label={`${n.title} 내리기`} className="pressable icon-btn text-ink-3 hover:bg-error-bg hover:text-error"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {editing && <NoticeModal key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) { remove(removing.id, st.session?.userId ?? ""); toast("공지를 내렸습니다. 고객 화면에서 사라집니다."); } setRemoving(null); }}
        title="이 공지를 내릴까요?"
        desc={`"${removing?.title ?? ""}" — 고객 Portal 에서 바로 사라집니다. 게시했던 기록은 실증 기록에 남습니다.`}
        confirmText="내리기"
        danger
      />
    </div>
  );
}

function NoticeModal({ initial, onClose }: { initial?: Notice; onClose: () => void }) {
  const companies = useStore((s) => s.companies);
  const session = useStore((s) => s.session);
  const create = useStore((s) => s.createNotice);
  const update = useStore((s) => s.updateNotice);
  const toast = useStore((s) => s.toast);
  const active = companies.filter((c) => !c.archived);
  const [scope, setScope] = useState<"all" | "one">(initial?.companyId ? "one" : "all");
  const [cid, setCid] = useState(initial?.companyId ?? active[0]?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pinned, setPinned] = useState(!!initial?.pinned);
  const [until, setUntil] = useState(initial?.expiresAt ? initial.expiresAt.slice(0, 10) : "");
  const [err, setErr] = useState("");

  const submit = () => {
    if (!title.trim()) { setErr("제목을 입력해 주세요."); return; }
    if (scope === "one" && !cid) { setErr("공지를 받을 기업을 골라 주세요."); return; }
    // 날짜만 고르면 그날 하루 끝까지 게시한다
    const expiresAt = until ? new Date(`${until}T23:59:59`).toISOString() : undefined;
    if (expiresAt && expiresAt <= new Date().toISOString()) { setErr("게시 종료일은 오늘 이후로 골라 주세요."); return; }
    if (initial) {
      update(initial.id, { title, body, pinned, expiresAt: expiresAt ?? null }, session?.userId ?? "");
      toast("공지를 고쳤습니다.");
    } else {
      const id = create({ title, body, pinned, expiresAt, companyId: scope === "one" ? cid : undefined }, session?.userId ?? "");
      if (!id) { toast("공지를 게시하지 못했습니다.", "error"); return; }
      toast(scope === "one" ? "공지를 게시하고 고객에게 알림을 보냈습니다." : `전체 고객 ${active.length}곳에 공지를 게시했습니다.`);
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={initial ? "공지 수정" : "공지 작성"} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" onClick={submit}>{initial ? "저장" : "게시하기"}</Button></>}>
      <div className="space-y-3.5">
        {!initial && (
          <div>
            <div className="mb-1.5 text-[0.85rem] font-semibold text-ink-2">받는 고객</div>
            <div role="group" aria-label="받는 고객" className="flex flex-wrap gap-1.5">
              <Chip selected={scope === "all"} onClick={() => setScope("all")}>전체 고객 {active.length}곳</Chip>
              <Chip selected={scope === "one"} onClick={() => setScope("one")}>기업 한 곳</Chip>
            </div>
            {scope === "one" && (
              <Select className="mt-2" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="공지를 받을 기업">
                {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </div>
        )}
        <Field label="제목"><Input value={title} onChange={(e) => { setTitle(e.target.value); setErr(""); }} placeholder="예: 추석 연휴 휴무 안내" autoFocus /></Field>
        <Field label="내용"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="고객이 알아야 할 내용을 적어 주세요. 줄바꿈은 그대로 보입니다." /></Field>
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="고정" className="flex flex-wrap gap-1.5">
            <Chip selected={pinned} onClick={() => setPinned((v) => !v)}><Pin size={13} /> 고객 홈 맨 위에 고정</Chip>
          </div>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[0.85rem] font-semibold text-ink-2">
            게시 종료일 (선택)
            <Input type="date" value={until} onChange={(e) => { setUntil(e.target.value); setErr(""); }} />
          </label>
        </div>
        {err && <p className="rounded-lg bg-error-bg px-3 py-2 text-[0.85rem] font-semibold text-error">{err}</p>}
        {!initial && <p className="text-[0.78rem] leading-relaxed text-ink-3">게시하는 순간 {scope === "all" ? `전체 고객 ${active.length}곳` : "해당 고객"}의 알림함에 알림이 갑니다.</p>}
      </div>
    </Modal>
  );
}

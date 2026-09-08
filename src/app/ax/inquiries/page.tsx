"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Send, Sparkles, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Badge, Button, Card, EmptyState, PageHeader, SegmentedControl, Textarea, Avatar, cx, AiReadyBadge } from "@/components/ui/ui";
import { InquiryStatusBadge } from "@/components/domain/domain";
import { useIsMobile } from "@/lib/hooks";

function InquiriesInner() {
  const st = useStore();
  const params = useSearchParams();
  const reply = useStore((s) => s.replyInquiry);
  const closeIq = useStore((s) => s.closeInquiry);
  const toast = useStore((s) => s.toast);
  const openAi = useUi((s) => s.openAi);
  const isMobile = useIsMobile();
  const focus = params.get("focus");
  const [filter, setFilter] = useState<"open" | "answered" | "all">(focus ? "all" : "open");
  const [selState, setSel] = useState<string | null>(focus);
  const [text, setText] = useState("");
  const me = st.session?.role === "consultant" ? st.session.userId : undefined;

  const list = useMemo(() => st.inquiries.filter((i) => !me || i.assigneeId === me).filter((i) => filter === "all" ? true : filter === "open" ? i.status === "open" : i.status !== "open").sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || b.createdAt.localeCompare(a.createdAt)), [st.inquiries, me, filter]);

  const sel = selState ?? (!isMobile ? list[0]?.id ?? null : null);

  const cur = st.inquiries.find((i) => i.id === sel);
  const curCompany = cur ? st.companies.find((c) => c.id === cur.companyId) : null;

  const send = () => {
    if (!cur || !text.trim()) return;
    reply(cur.id, text.trim(), st.session?.userId ?? "u_admin", st.session?.role ?? "admin");
    toast("답변이 등록되었습니다. 고객 Portal에 반영되고 알림이 전송되었습니다.");
    setText("");
  };
  const suggest = () => {
    if (!cur) return;
    const consultant = st.users.find((u) => u.id === cur.assigneeId);
    const p = st.projects.find((x) => x.id === cur.projectId);
    const next = st.schedules.filter((s) => s.projectId === cur.projectId && s.start >= new Date().toISOString()).sort((a, b) => a.start.localeCompare(b.start))[0];
    setText(`안녕하세요 ${curCompany?.contactName}님, KPJK ${consultant?.name}입니다.\n\n문의주신 "${cur.title}" 관련하여 안내드립니다.\n\n${p ? `현재 ${p.name}은(는) ` : ""}${next ? `${fmtDateTime(next.start)} ${next.title} 일정이 예정되어 있으며, ` : ""}세부 내용은 고객 포털 [내 프로젝트]에서도 확인하실 수 있습니다.\n\n추가로 궁금한 점이 있으시면 언제든 말씀해 주세요.\n감사합니다.`);
  };

  const listPane = (
    <Card className="overflow-hidden">
      {list.length === 0 ? <EmptyState icon={<MessageSquare size={30} />} title="문의가 없습니다" /> : (
        <div className="divide-y divide-line">
          {list.map((iq) => {
            const c = st.companies.find((x) => x.id === iq.companyId);
            return (
              <button key={iq.id} onClick={() => setSel(iq.id)} className={cx("pressable block w-full px-4 py-3 text-left transition-colors hover:bg-surface-2/60", sel === iq.id && "bg-soft/40")}>
                <div className="flex items-center gap-2"><InquiryStatusBadge status={iq.status} /><Badge>{iq.category}</Badge><span className="ml-auto text-[0.75rem] text-ink-3">{fmtRelative(iq.createdAt)}</span></div>
                <div className="mt-1 truncate font-semibold">{iq.title}</div>
                <div className="text-[0.8rem] text-ink-3">{c?.name} · {st.projects.find((p) => p.id === iq.projectId)?.name ?? "-"}</div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );

  const detailPane = cur ? (
    <Card className="flex flex-col p-5">
      {isMobile && <button onClick={() => setSel(null)} className="mb-3 text-[0.85rem] font-semibold text-ink-2">← 목록</button>}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2"><InquiryStatusBadge status={cur.status} /><Badge>{cur.category}</Badge></div>
          <h2 className="mt-1.5 text-[1.15rem] font-bold">{cur.title}</h2>
          <div className="mt-0.5 text-[0.82rem] text-ink-3"><Link href={`/ax/clients/${cur.companyId}`} className="hover:text-accent">{curCompany?.name}</Link> · {st.projects.find((p) => p.id === cur.projectId)?.name ?? "-"} · 담당 {st.users.find((u) => u.id === cur.assigneeId)?.name}</div>
        </div>
        {cur.status === "answered" && <Button size="sm" variant="outline" icon={<CheckCircle2 size={14} />} onClick={() => { closeIq(cur.id, st.session?.userId ?? "u_admin"); toast("문의를 종료했습니다."); }}>종료</Button>}
      </div>
      <div className="flex-1 space-y-4 py-4">
        {cur.messages.map((m) => {
          const client = m.authorRole === "client";
          const author = st.users.find((u) => u.id === m.authorId);
          return (
            <div key={m.id} className={cx("flex gap-3", !client && "flex-row-reverse")}>
              <Avatar name={author?.name ?? "?"} size={34} className={client ? "bg-accent" : undefined} />
              <div className={cx("max-w-[85%] rounded-2xl px-4 py-3 text-[0.92rem] leading-relaxed", client ? "bg-surface-2" : "bg-soft/70")}>
                <div className="mb-1 text-[0.75rem] font-bold text-ink-3">{author?.name} {client ? "(고객)" : ""} · {fmtDateTime(m.createdAt)}</div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      {cur.status !== "closed" && (
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-[0.85rem] font-semibold text-ink-2">답변 작성</span><div className="flex items-center gap-2"><button onClick={suggest} className="pressable flex items-center gap-1 rounded-md border border-line-2 px-2 py-1 text-[0.75rem] font-bold text-ink-2 hover:bg-surface-2"><Sparkles size={12} className="text-accent" /> 초안 제안</button><AiReadyBadge onClick={() => openAi({ title: "커뮤니케이션 초안 — AI 적용 설명", key: "draft" })} /></div></div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="고객에게 전달할 답변을 작성하세요. 등록 즉시 고객 Portal에 반영됩니다." />
          <div className="mt-2 flex justify-end"><Button variant="accent" icon={<Send size={15} />} onClick={send} disabled={!text.trim()}>답변 등록</Button></div>
        </div>
      )}
    </Card>
  ) : (
    <Card><EmptyState icon={<MessageSquare size={30} />} title="문의를 선택하세요" /></Card>
  );

  return (
    <div>
      <PageHeader title="문의 / 커뮤니케이션" desc="고객 Portal에서 들어온 문의가 자동으로 Queue에 등록됩니다. 답변하면 고객 Portal에 즉시 반영됩니다." actions={<SegmentedControl size="sm" value={filter} onChange={(k) => { setFilter(k); if (isMobile) setSel(null); }} options={[{ key: "open", label: `미답변 ${st.inquiries.filter((i) => i.status === "open" && (!me || i.assigneeId === me)).length}` }, { key: "answered", label: "답변완료" }, { key: "all", label: "전체" }]} />} />
      {isMobile ? (sel ? detailPane : listPane) : <div className="grid gap-5 lg:grid-cols-[360px_1fr]">{listPane}{detailPane}</div>}
    </div>
  );
}

export default function InquiriesPage() {
  return <Suspense><InquiriesInner /></Suspense>;
}

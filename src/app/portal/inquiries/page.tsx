"use client";

import { useState } from "react";
import { MessageSquare, Plus, Send } from "lucide-react";
import { useStore, usePortalCompanyId } from "@/lib/store";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import type { Inquiry } from "@/lib/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { InquiryStatusBadge } from "@/components/domain/domain";

export default function PortalInquiriesPage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const create = useStore((s) => s.createInquiry);
  const reply = useStore((s) => s.replyInquiry);
  const toast = useStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Inquiry["category"]>("진행상황");
  const [projectId, setProjectId] = useState<string>("");
  const [body, setBody] = useState("");
  const [follow, setFollow] = useState("");
  const c = st.companies.find((x) => x.id === companyId);
  const projects = st.projects.filter((p) => p.companyId === companyId && p.clientVisible && !p.archived);
  const list = st.inquiries.filter((i) => i.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cur = list.find((i) => i.id === sel);
  const isClient = st.session?.role === "client";
  const byUser = isClient ? st.session!.userId : "";
  const consultant = st.users.find((u) => u.id === c?.consultantId);

  const submit = () => {
    if (!title.trim() || !body.trim()) { toast("제목과 내용을 입력해 주세요.", "error"); return; }
    if (!isClient) { st.toast("읽기 전용 미리보기입니다. 문의 작성은 고객 계정으로만 가능합니다.", "error"); return; }
    create({ companyId: companyId!, projectId: projectId || projects[0]?.id, title: title.trim(), category, body: body.trim() }, byUser);
    toast("문의가 접수되었습니다. 담당 컨설턴트가 확인 후 답변드립니다.");
    setTitle(""); setBody(""); setOpen(false);
  };
  const sendFollow = () => {
    if (!cur || !follow.trim()) return;
    if (!isClient) { st.toast("읽기 전용 미리보기입니다. 추가 문의는 고객 계정으로만 가능합니다.", "error"); return; }
    reply(cur.id, follow.trim(), byUser, "client");
    toast("추가 문의가 전달되었습니다.");
    setFollow("");
  };

  return (
    <div>
      <PageHeader title="문의하기" desc={`담당 컨설턴트 ${consultant?.name ?? ""} ${consultant?.title ?? ""}에게 직접 질문하세요. 답변은 알림으로 안내드립니다.`} actions={<Button variant="accent" icon={<Plus size={16} />} onClick={() => setOpen(true)}>새 문의</Button>} />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="overflow-hidden">
          {list.length === 0 ? <EmptyState icon={<MessageSquare size={30} />} title="아직 문의가 없습니다" action={<Button variant="outline" onClick={() => setOpen(true)}>첫 문의 남기기</Button>} /> : (
            <div className="divide-y divide-line">
              {list.map((iq) => (
                <button key={iq.id} onClick={() => setSel(iq.id)} className={cx("pressable block w-full px-4 py-3 text-left hover:bg-surface-2/60", sel === iq.id && "bg-soft/40")}>
                  <div className="flex items-center gap-2"><InquiryStatusBadge status={iq.status} client /><Badge>{iq.category}</Badge><span className="ml-auto text-[0.75rem] text-ink-3">{fmtRelative(iq.createdAt)}</span></div>
                  <div className="mt-1 truncate font-semibold">{iq.title}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
        {cur ? (
          <Card className="p-5">
            <div className="border-b border-line pb-3"><div className="flex items-center gap-2"><InquiryStatusBadge status={cur.status} client /><Badge>{cur.category}</Badge></div><h2 className="mt-1.5 text-[1.15rem] font-bold">{cur.title}</h2><div className="text-[0.8rem] text-ink-3">{st.projects.find((p) => p.id === cur.projectId)?.name ?? "-"} · {fmtDateTime(cur.createdAt)}</div></div>
            <div className="space-y-4 py-4">
              {cur.messages.map((m) => {
                const mine = m.authorRole === "client";
                const author = st.users.find((u) => u.id === m.authorId);
                return (
                  <div key={m.id} className={cx("flex gap-3", mine && "flex-row-reverse")}>
                    <Avatar name={author?.name ?? "?"} size={34} className={mine ? "bg-accent" : undefined} />
                    <div className={cx("max-w-[85%] rounded-2xl px-4 py-3 text-[0.92rem] leading-relaxed", mine ? "bg-soft/70" : "bg-surface-2")}><div className="mb-1 text-[0.75rem] font-bold text-ink-3">{mine ? "나" : `${author?.name} ${author?.title} (KPJK)`} · {fmtDateTime(m.createdAt)}</div><div className="whitespace-pre-wrap">{m.body}</div></div>
                  </div>
                );
              })}
              {cur.status === "open" && <div className="text-center text-[0.82rem] text-ink-3">담당 컨설턴트가 확인 중입니다. 보통 1영업일 내 답변드립니다.</div>}
            </div>
            {cur.status !== "closed" && (
              <div className="border-t border-line pt-3">
                <Textarea value={follow} onChange={(e) => setFollow(e.target.value)} placeholder="추가로 궁금한 점을 남겨주세요." className="min-h-20" />
                <div className="mt-2 flex justify-end"><Button variant="accent" size="sm" icon={<Send size={14} />} onClick={sendFollow} disabled={!follow.trim()}>보내기</Button></div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="hidden lg:block"><EmptyState icon={<MessageSquare size={30} />} title="문의를 선택하거나 새 문의를 남겨주세요" /></Card>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="새 문의" size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button variant="accent" icon={<Send size={15} />} onClick={submit}>문의 보내기</Button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="분류"><Select value={category} onChange={(e) => setCategory(e.target.value as Inquiry["category"])}>{["진행상황", "자료", "일정", "결과물", "기타"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
            <Field label="프로젝트"><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">선택 안 함</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
          <Field label="제목"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 결과보고 일정이 언제쯤 확정될까요?" autoFocus /></Field>
          <Field label="내용"><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="궁금한 내용을 편하게 적어주세요." /></Field>
        </div>
      </Modal>
    </div>
  );
}

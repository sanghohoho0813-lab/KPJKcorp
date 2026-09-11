"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquarePlus, Sparkles, ThumbsUp } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { OPP_STATUS, recommendServices, type ServiceDef } from "@/lib/services";
import { fmtRelative } from "@/lib/format";
import { Badge, Button, Card, EmptyState, SectionTitle, Textarea } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

export default function PortalServicesPage() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const raise = useStore((s) => s.raiseOpportunity);
  const toast = useStore((s) => s.toast);
  const [ask, setAsk] = useState<{ svc: ServiceDef; reason: string; kind: "interest" | "request" } | null>(null);
  const [note, setNote] = useState("");

  const c = st.companies.find((x) => x.id === companyId);
  const mine = useMemo(() => st.opportunities.filter((o) => o.companyId === companyId && o.status !== "dropped").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [st.opportunities, companyId]);

  const recos = useMemo(() => {
    if (!c) return [];
    return recommendServices({
      company: c,
      projects: st.projects.filter((p) => p.companyId === c.id),
      contracts: st.contracts.filter((x) => x.companyId === c.id),
      existing: new Set(st.opportunities.filter((o) => o.companyId === c.id).map((o) => o.serviceKey)),
    });
  }, [c, st.projects, st.contracts, st.opportunities]);

  if (!c) return null;
  const consultant = st.users.find((u) => u.id === c.consultantId);
  // 관리자 미리보기에서도 "고객이 한 행동"으로 기록되어야 Loop가 실제와 같아진다.
  const contactUser = st.users.find((u) => u.role === "client" && u.companyId === c.id);
  const actorId = st.session?.role === "client" ? (user?.id ?? contactUser?.id ?? "") : (contactUser?.id ?? "");

  const submit = () => {
    if (!ask) return;
    raise(
      { companyId: c.id, serviceKey: ask.svc.key, note: note.trim() || undefined, reason: ask.reason, source: ask.kind === "request" ? "portal_request" : "portal_interest" },
      actorId,
      "client",
    );
    toast(ask.kind === "request" ? "상담 요청이 전달되었습니다. 담당 컨설턴트가 연락드립니다." : "관심으로 접수했습니다. 담당 컨설턴트가 확인합니다.");
    setNote("");
    setAsk(null);
  };

  return (
    <div className="space-y-5">
      <div id="tut-p-services">
        <h1 className="text-[1.5rem] font-bold md:text-[1.8rem]">함께 검토해볼 수 있는 것</h1>
        <p className="mt-1 text-[0.92rem] text-ink-2">
          {c.name}의 현재 상황에서 검토 대상이 되는 항목입니다. 관심을 표시하면 담당 컨설턴트가 확인 후 연락드립니다.
        </p>
      </div>

      {/* 내가 요청한 것 — 먼저 보여준다. 요청하고 나서 아무 반응이 없으면 신뢰가 깨진다. */}
      {mine.length > 0 && (
        <Card className="p-5">
          <SectionTitle>내가 요청한 내용</SectionTitle>
          <div className="divide-y divide-line">
            {mine.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{o.serviceName}</div>
                  {o.note && <div className="mt-0.5 text-[0.85rem] text-ink-2">“{o.note}”</div>}
                  <div className="mt-0.5 text-[0.78rem] text-ink-3">{fmtRelative(o.createdAt)} 접수 · 담당 {st.users.find((u) => u.id === o.assigneeId)?.name} {st.users.find((u) => u.id === o.assigneeId)?.title}</div>
                </div>
                <Badge tone={OPP_STATUS[o.status].tone}>{OPP_STATUS[o.status].clientLabel}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recos.length === 0 ? (
        <EmptyState icon={<Check size={28} />} title="지금 추가로 안내드릴 항목이 없습니다." desc={`궁금한 점은 ${consultant?.name} ${consultant?.title}에게 문의해 주세요.`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recos.map(({ service, reason }) => (
            <Card key={service.key} className="flex flex-col p-5">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 text-[1.15rem] font-bold">{service.name}</h2>
              </div>
              <p className="mt-1 text-[0.92rem] text-ink-2">{service.blurb}</p>

              <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[0.85rem]">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
                <span><b className="text-ink">이 항목을 보여드리는 이유</b><br />{reason}</span>
              </div>

              <ul className="mt-3 flex-1 space-y-1 text-[0.88rem] text-ink-2">
                {service.points.map((p) => (
                  <li key={p} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-success" />{p}</li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" icon={<ThumbsUp size={15} />} onClick={() => { setAsk({ svc: service, reason, kind: "interest" }); setNote(""); }}>관심 있어요</Button>
                <Button variant="accent" size="sm" icon={<MessageSquarePlus size={15} />} onClick={() => { setAsk({ svc: service, reason, kind: "request" }); setNote(""); }}>상담 요청</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[0.8rem] leading-relaxed text-ink-3">
        관심 표시는 계약이나 비용 발생과 무관합니다. 담당 컨설턴트가 현재 상황을 먼저 확인한 뒤 안내드립니다.
      </p>

      <Modal
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.kind === "request" ? "상담을 요청합니다" : "관심으로 남깁니다"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>취소</Button>
            <Button variant="accent" onClick={submit}>{ask?.kind === "request" ? "상담 요청" : "관심 남기기"}</Button>
          </>
        }
      >
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem] font-semibold">{ask?.svc.name}</div>
        <div className="mt-3">
          <label className="mb-1 block text-[0.85rem] font-semibold text-ink-2">담당자에게 남길 말 (선택)</label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 지금 진행 중인 건이 끝나면 검토하고 싶습니다." />
        </div>
        <p className="mt-2 text-[0.8rem] text-ink-3">
          {ask?.kind === "request" ? "담당 컨설턴트에게 바로 전달되며, 영업일 기준 1일 내 연락드립니다." : "담당 컨설턴트가 확인한 뒤 필요한 경우에만 연락드립니다."}
        </p>
      </Modal>
    </div>
  );
}

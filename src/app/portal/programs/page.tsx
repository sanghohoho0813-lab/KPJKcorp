"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { useStore, usePortalCompanyId, useCurrentUser } from "@/lib/store";
import { profileOfCompany, programsForCompany, type ProgramMatch } from "@/lib/programs";
import { fetchBizinfo, openOnly } from "@/lib/programs-client";
import { OPP_STATUS } from "@/lib/services";
import type { SupportProgram } from "@/lib/types";
import { Badge, Button, Card, EmptyState, PageHeader, Textarea } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { ProgramCard, MATCH_NOTE } from "@/components/domain/programs/ProgramCard";

/** 고객: 우리 회사 기본 정보에 맞는 지원사업 공고 + 담당 컨설턴트에게 물어보기 */
export default function PortalPrograms() {
  const st = useStore();
  const companyId = usePortalCompanyId();
  const user = useCurrentUser();
  const ask = useStore((s) => s.askProgram);
  const toast = useStore((s) => s.toast);
  const [liveItems, setLiveItems] = useState<SupportProgram[]>([]);
  const [target, setTarget] = useState<SupportProgram | null>(null);
  const [note, setNote] = useState("");
  const c = st.companies.find((x) => x.id === companyId);
  // 서버에 기업마당 공고가 이미 있으면(매일 9시 자동 갱신) 기업마당을 다시 부르지 않는다 — 화면이 바로 뜬다
  const hasStored = st.programs.some((p) => p.source === "bizinfo");
  useEffect(() => { if (!hasStored) void fetchBizinfo().then((r) => setLiveItems(r.items)); }, [hasStored]);
  const programs = useMemo(() => {
    const ids = new Set(st.programs.map((p) => p.id));
    return openOnly([...st.programs, ...liveItems.filter((p) => !ids.has(p.id))]);
  }, [st.programs, liveItems]);
  const { sent, matches } = useMemo(() => (c ? programsForCompany(programs, c.id, profileOfCompany(c)) : { sent: [], matches: [] }), [c, programs]);
  if (!c) return null;
  const isClient = st.session?.role === "client";
  const asked = (p: SupportProgram) => st.opportunities.find((o) => o.companyId === c.id && o.serviceKey === "support_program" && o.serviceName === `지원사업: ${p.title}`.slice(0, 120) && o.status !== "dropped");
  const prof = profileOfCompany(c);
  const missing = [!prof.region && "지역", !prof.industry && "업종", !prof.foundedYear && "설립일"].filter(Boolean);
  const urgent = [...sent, ...matches].filter((m) => m.deadline.urgent).length;
  const card = (m: ProgramMatch) => {
    const a = asked(m.program);
    return (
      <ProgramCard key={m.program.id} m={m} actions={a
        ? <Badge tone={OPP_STATUS[a.status].tone}>문의함 · {OPP_STATUS[a.status].clientLabel}</Badge>
        : <Button size="sm" variant="accent" icon={<MessageSquarePlus size={14} />} onClick={() => { setTarget(m.program); setNote(""); }}>담당 컨설턴트에게 물어보기</Button>} />
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="우리 회사에 맞는 지원사업" badge={<Badge tone="accent">베타</Badge>}
        desc={`${c.name}의 지역·업종·업력·인원을 기준으로 지금 접수 중인 공고 중 검토해 볼 것을 골랐습니다.`} />
      <div className="flex flex-wrap items-center gap-2 text-[0.88rem]">
        <b>검토해 볼 공고 {sent.length + matches.length}건</b>{sent.length > 0 && <span className="font-semibold text-accent">담당자 추천 {sent.length}건</span>}{urgent > 0 && <span className="font-semibold text-error">마감 임박 {urgent}건</span>}
      </div>
      <p className="text-[0.78rem] leading-relaxed text-ink-3">{MATCH_NOTE}</p>
      {missing.length > 0 && <Card className="p-3 text-[0.82rem] text-ink-2">회사 정보의 {missing.join("·")} 칸이 비어 있어 결과가 넓게 나올 수 있습니다. 담당 컨설턴트에게 알려 주시면 더 정확해집니다.</Card>}
      {sent.length > 0 && (
        <section className="space-y-2.5" data-testid="programs-sent">
          <h2 className="pt-1 text-[1rem] font-bold">담당 컨설턴트가 보낸 공고 <span className="text-accent">{sent.length}</span></h2>
          {sent.map(card)}
        </section>
      )}
      {sent.length + matches.length === 0 ? (
        <Card><EmptyState icon={<Search size={28} />} title="지금 맞는 공고가 없습니다" desc="새 공고가 나오면 담당 컨설턴트가 이 화면과 알림으로 알려 드립니다." /></Card>
      ) : matches.length > 0 && (
        <section className="space-y-2.5">
          {sent.length > 0 && <h2 className="pt-2 text-[1rem] font-bold">회사 조건에 맞는 공고 <span className="text-ink-3">{matches.length}</span></h2>}
          {matches.map(card)}
        </section>
      )}
      <Modal open={!!target} onClose={() => setTarget(null)} size="sm" title="이 공고 물어보기"
        footer={<><Button variant="ghost" onClick={() => setTarget(null)}>취소</Button><Button variant="accent" onClick={() => {
          if (!target) return;
          if (!isClient) { toast("읽기 전용 미리보기입니다. 고객 계정으로만 문의할 수 있습니다.", "error"); return; }
          if (ask(target.id, c.id, user?.id ?? "", note)) toast("담당 컨설턴트에게 전달했습니다. 확인 후 연락드립니다.");
          setTarget(null);
        }}>보내기</Button></>}>
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem] font-semibold">{target?.title}</div>
        <label className="mt-3 block text-[0.85rem] font-semibold text-ink-2">담당자에게 남길 말 (선택)
          <Textarea rows={3} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 이 공고 신청이 가능한지 궁금합니다." />
        </label>
        <p className="mt-2 text-[0.78rem] text-ink-3">문의는 계약·비용과 무관합니다. 신청 가능 여부와 준비 서류를 담당 컨설턴트가 확인해 드립니다.</p>
      </Modal>
    </div>
  );
}

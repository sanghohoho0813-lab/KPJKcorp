"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Phone, Play, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { growthBoard } from "@/lib/growth";
import { OPP_STATUS } from "@/lib/services";
import { fmtRelative } from "@/lib/format";
import type { Company } from "@/lib/types";
import { Badge, Button, Card, SectionTitle } from "@/components/ui/ui";
import { useMay } from "@/components/domain/EntityModals";

/**
 * 고객 성장과제 — 내부에서 보는 쪽.
 * 고객이 Portal 에서 "검토하고 싶어요 / 상담 요청"을 누른 것이 여기로 온다(매출기회·업무·알림은 이미 생겼다).
 * 담당자가 연락 → 진행 업무로 시작하면 고객 홈의 "진행 중인 성장과제"로 옮겨 간다. 닫힌 고리.
 * 아래에는 고객 화면에 지금 무엇이 보이는지(규칙으로 고른 검토 과제 포함)를 그대로 보여 준다.
 */
export function GrowthRequests({ company }: { company: Company }) {
  const st = useStore();
  const router = useRouter();
  const advance = useStore((s) => s.advanceOpportunity);
  const start = useStore((s) => s.startProjectFromOpportunity);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "";
  const may = useMay();
  const board = useMemo(() => growthBoard({ company, projects: st.projects, opportunities: st.opportunities, docRequests: st.docRequests, quotes: st.quotes, results: st.results, schedules: st.schedules, now: new Date() }),
    [company, st.projects, st.opportunities, st.docRequests, st.quotes, st.results, st.schedules]);
  const requests = st.opportunities
    .filter((o) => o.companyId === company.id && (o.source === "portal_interest" || o.source === "portal_request") && o.status !== "dropped" && o.status !== "won")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Card className="p-5" id="growth-requests">
      <SectionTitle>고객 성장과제</SectionTitle>
      <p className="-mt-1 mb-3 text-[0.85rem] text-ink-2">고객이 Portal 에서 요청한 과제입니다. <b>진행 업무로 시작</b>하면 고객 홈의 &ldquo;진행 중인 성장과제&rdquo;로 옮겨 갑니다.</p>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-2 py-5 text-center text-[0.85rem] text-ink-3">새로 들어온 요청이 없습니다.</div>
      ) : (
        <div className="divide-y divide-line rounded-xl border border-line">
          {requests.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center" data-growth-request={o.serviceName}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.serviceName}</span>
                  <Badge tone={o.source === "portal_request" ? "accent" : "neutral"}>{o.source === "portal_request" ? "상담 요청" : "검토 요청"}</Badge>
                  <Badge tone={OPP_STATUS[o.status].tone}>{OPP_STATUS[o.status].label}</Badge>
                </div>
                {o.note && <div className="mt-1 text-[0.85rem]">&ldquo;{o.note}&rdquo;</div>}
                {o.reason && <div className="mt-0.5 text-[0.78rem] text-ink-3">고객이 본 근거 · {o.reason}</div>}
                <div className="mt-0.5 text-[0.75rem] text-ink-3">{fmtRelative(o.createdAt)}</div>
              </div>
              {may("opportunity.advance") && (
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {o.status === "interest" && <Button size="sm" variant="outline" icon={<Phone size={14} />} onClick={() => { advance(o.id, "contacted", me); toast("고객 화면에 '담당자 확인 중'으로 보입니다."); }}>연락함</Button>}
                  <Button size="sm" variant="accent" icon={<Play size={14} />} onClick={() => { const id = start(o.id, me); if (id) { toast(`${o.serviceName} 컨설팅을 진행 업무로 시작했습니다. 고객 홈에 '진행 중'으로 보입니다.`); router.push(`/ax/clients/${company.id}?tab=work`); } }}>진행 업무로 시작</Button>
                  <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => { advance(o.id, "dropped", me); toast("요청을 종료했습니다."); }}>종료</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[0.82rem]" data-testid="growth-preview">
        <div className="mb-1 flex items-center gap-1.5 font-bold text-ink-2"><Sparkles size={14} className="text-accent" /> 고객 화면에 지금 보이는 것</div>
        <div className="text-ink-2">진행 중 {board.active.length} · 검토 중 {board.review.length + board.proposed.length} · 완료 {board.completed.length} · 고객이 할 일 {board.actions.length}</div>
        {board.suggested.length > 0 && (
          <div className="mt-1.5 text-ink-3">
            <span className="font-semibold text-ink-2">기업정보로 고른 &ldquo;검토해 볼 과제&rdquo;: </span>
            {board.suggested.map((x, i) => <span key={x.area}>{i ? " · " : ""}{x.area} <span className="text-[0.75rem]">({x.basis})</span></span>)}
            <div className="mt-1 flex items-center gap-1 text-[0.75rem]"><ArrowRight size={12} /> 직접 이유를 적어 권하고 싶으면 아래 &ldquo;고객에게 제안하기&rdquo;에서 올리세요(담당자 제안이 먼저 보입니다).</div>
          </div>
        )}
      </div>
    </Card>
  );
}

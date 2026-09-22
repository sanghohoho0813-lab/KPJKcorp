"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Check, Percent, ShieldCheck, TrendingUp, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { OPP_PIPELINE, OPP_STATUS, oppNextStatus } from "@/lib/services";
import { fmtDateTime, fmtRelative, fmtWon } from "@/lib/format";
import type { Approval, Opportunity, OpportunityStatus } from "@/lib/types";
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Tabs, Textarea, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

/* ---------------- 대표 승인 ---------------- */

const KIND_LABEL: Record<Approval["kind"], string> = { opportunity: "제안 승인", discount: "할인 승인", promise: "고객 약속" };

function DecisionModal({ ap, decision, onClose }: { ap: Approval | null; decision: "approved" | "rejected"; onClose: () => void }) {
  const decide = useStore((s) => s.decideApproval);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const [note, setNote] = useState("");
  if (!ap) return null;
  const approve = decision === "approved";
  return (
    <Modal
      open={!!ap}
      onClose={onClose}
      title={approve ? "승인하시겠습니까?" : "반려하시겠습니까?"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant={approve ? "accent" : "danger"}
            onClick={() => {
              decide(ap.id, decision, me, note.trim() || undefined);
              toast(approve ? "승인했습니다. 담당자에게 다음 업무가 생성되었습니다." : "반려했습니다. 담당자에게 전달됩니다.");
              onClose();
            }}
          >
            {approve ? "승인" : "반려"}
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem]">
        <div className="font-bold">{ap.title}</div>
        <div className="mt-1 text-ink-2">{ap.summary}</div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-[0.82rem] font-semibold text-ink-2">담당자에게 남길 말 {approve ? "(선택)" : "(권장)"}</label>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? "예: 범위는 동의. 금액은 기존 고객 기준으로." : "예: 이번 분기는 할인 없이 진행해 주세요."} />
      </div>
      <p className="mt-2 text-[0.78rem] text-ink-3">{approve ? "승인하면 담당자에게 제안·견적 발송 업무가 자동으로 생성됩니다." : "반려하면 해당 건은 종료 처리되고 담당자에게 알림이 갑니다."}</p>
    </Modal>
  );
}

function ApprovalCard({ ap, onDecide }: { ap: Approval; onDecide: (ap: Approval, d: "approved" | "rejected") => void }) {
  const st = useStore();
  const company = st.companies.find((c) => c.id === ap.companyId);
  const requester = st.users.find((u) => u.id === ap.requestedBy);
  const isAdmin = st.session?.role === "admin";
  const pending = ap.status === "pending";
  const net = ap.baseAmount && ap.discountPct ? ap.baseAmount * (1 - ap.discountPct / 100) : undefined;

  return (
    <Card className={cx("p-4 md:p-5", pending && "border-accent/50")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ap.kind === "discount" ? "warning" : ap.kind === "promise" ? "info" : "accent"}>{KIND_LABEL[ap.kind]}</Badge>
        {company && (
          <Link href={`/ax/clients/${company.id}`} className="link-more">
            <Building2 size={14} /> {company.name}
          </Link>
        )}
        <span className="ml-auto text-[0.78rem] text-ink-3">{fmtRelative(ap.requestedAt)} · {requester?.name} {requester?.title}</span>
      </div>

      <h3 className="mt-2 text-[1.05rem] font-bold">{ap.title}</h3>
      <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-2">{ap.summary}</p>

      {ap.baseAmount !== undefined && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-surface-2 px-4 py-3">
          <div><div className="text-[0.72rem] font-bold text-ink-3">계약 금액</div><div className="tnum text-[1rem] font-bold">{fmtWon(ap.baseAmount)}</div></div>
          <div><div className="text-[0.72rem] font-bold text-ink-3">요청 할인</div><div className="tnum flex items-center gap-1 text-[1rem] font-bold text-warning"><Percent size={14} />{ap.discountPct}</div></div>
          {net !== undefined && <div><div className="text-[0.72rem] font-bold text-ink-3">적용 시</div><div className="tnum text-[1rem] font-bold text-accent">{fmtWon(net)}</div></div>}
        </div>
      )}

      {pending ? (
        isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" icon={<Check size={16} />} onClick={() => onDecide(ap, "approved")}>승인</Button>
            <Button variant="outline" icon={<X size={16} />} onClick={() => onDecide(ap, "rejected")}>반려</Button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-warning-bg px-4 py-2.5 text-[0.85rem] font-semibold text-warning">대표 승인 대기 중입니다. 승인은 대표 계정에서만 가능합니다.</div>
        )
      ) : (
        <div className={cx("mt-4 rounded-xl px-4 py-2.5 text-[0.85rem]", ap.status === "approved" ? "bg-success-bg text-success" : "bg-surface-2 text-ink-2")}>
          <b>{ap.status === "approved" ? "승인 완료" : "반려"}</b> · {fmtDateTime(ap.decidedAt)}
          {ap.decisionNote && <div className="mt-0.5 font-normal">{ap.decisionNote}</div>}
        </div>
      )}
    </Card>
  );
}

/* ---------------- 매출기회 ---------------- */

const SOURCE_LABEL: Record<Opportunity["source"], string> = {
  portal_interest: "고객 관심표시",
  portal_request: "고객 상담요청",
  internal: "내부 등록",
  rule: "규칙 발견",
};

function OppRow({ o, onPropose }: { o: Opportunity; onPropose: (o: Opportunity) => void }) {
  const st = useStore();
  const advance = useStore((s) => s.advanceOpportunity);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const company = st.companies.find((c) => c.id === o.companyId);
  const assignee = st.users.find((u) => u.id === o.assigneeId);
  const next = oppNextStatus(o.status);
  const tone = OPP_STATUS[o.status].tone;

  return (
    <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{OPP_STATUS[o.status].label}</Badge>
          <span className="font-bold">{o.serviceName}</span>
          <Link href={`/ax/clients/${o.companyId}`} className="link-more text-[0.88rem]">{company?.name}</Link>
        </div>
        {o.reason && <div className="mt-1 text-[0.82rem] text-ink-2">근거 · {o.reason}</div>}
        {o.note && <div className="mt-1 text-[0.85rem] text-ink">“{o.note}”</div>}
        <div className="mt-1 text-[0.78rem] text-ink-3">{SOURCE_LABEL[o.source]} · {fmtRelative(o.createdAt)} · 담당 {assignee?.name}</div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {o.status === "contacted" ? (
          <Button size="sm" variant="accent" icon={<ShieldCheck size={15} />} onClick={() => onPropose(o)}>대표 승인 요청</Button>
        ) : next && o.status !== "approval_pending" ? (
          <Button size="sm" variant="outline" icon={<ArrowRight size={15} />} onClick={() => { advance(o.id, next, me); toast(`${OPP_STATUS[next].label}(으)로 이동했습니다.`); }}>
            {OPP_STATUS[next].label}
          </Button>
        ) : null}
        {o.status !== "won" && o.status !== "dropped" && (
          <Button size="sm" variant="ghost" onClick={() => { advance(o.id, "dropped", me); toast("기회를 종료했습니다."); }}>종료</Button>
        )}
      </div>
    </div>
  );
}

function ProposeModal({ o, onClose }: { o: Opportunity | null; onClose: () => void }) {
  const request = useStore((s) => s.requestApproval);
  const toast = useStore((s) => s.toast);
  const companies = useStore((s) => s.companies);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const [summary, setSummary] = useState("");
  if (!o) return null;
  const company = companies.find((c) => c.id === o.companyId);
  return (
    <Modal
      open={!!o}
      onClose={onClose}
      title="대표 승인 요청"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="accent"
            onClick={() => {
              request({ kind: "opportunity", title: `${company?.name ?? ""} ${o.serviceName} 제안`, summary: summary.trim() || `${o.reason ?? "추가서비스 제안"} 제안 범위 확인 요청.`, companyId: o.companyId, opportunityId: o.id }, me);
              toast("대표님께 승인 요청을 보냈습니다.");
              setSummary("");
              onClose();
            }}
          >
            승인 요청
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-[0.88rem]"><b>{company?.name}</b> · {o.serviceName}</div>
      <div className="mt-3">
        <label className="mb-1 block text-[0.82rem] font-semibold text-ink-2">대표님이 5초 안에 판단할 수 있게 적어주세요</label>
        <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="고객 상황 · 제안 범위 · 확인이 필요한 지점" />
      </div>
    </Modal>
  );
}

/* ---------------- Page ---------------- */

function OpportunitiesInner() {
  const st = useStore();
  const params = useSearchParams();
  const [tab, setTab] = useState<"approvals" | "pipeline">(params.get("tab") === "approvals" ? "approvals" : "approvals");
  const [decide, setDecide] = useState<{ ap: Approval; d: "approved" | "rejected" } | null>(null);
  const [propose, setPropose] = useState<Opportunity | null>(null);
  const [stageFilter, setStageFilter] = useState<OpportunityStatus | "all">("all");

  const pending = st.approvals.filter((a) => a.status === "pending").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const decided = st.approvals.filter((a) => a.status !== "pending").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));

  const opps = useMemo(() => [...st.opportunities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [st.opportunities]);
  const counts = useMemo(() => {
    const c = {} as Record<OpportunityStatus, number>;
    for (const s of OPP_PIPELINE) c[s] = 0;
    c.dropped = 0;
    for (const o of opps) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [opps]);
  const shown = stageFilter === "all" ? opps.filter((o) => o.status !== "dropped") : opps.filter((o) => o.status === stageFilter);

  // 전환율은 실제 건수로만 계산한다. 표본이 적으면 표본 수를 그대로 보여준다.
  const total = opps.length;
  const won = counts.won ?? 0;

  return (
    <div>
      <PageHeader
        title="승인 · 매출기회"
        desc="대표 확인이 필요한 건과, 고객 관심이 매출로 이어지는 과정을 한 곳에서 봅니다."
        badge={pending.length ? <Badge tone="error">승인대기 {pending.length}</Badge> : <Badge tone="success">승인대기 없음</Badge>}
      />
      <Tabs
        tabs={[
          { key: "approvals", label: "대표 승인", count: pending.length },
          { key: "pipeline", label: "매출기회", count: opps.filter((o) => o.status !== "dropped").length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {tab === "approvals" && (
          <div className="space-y-5">
            {pending.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={28} />} title="승인 대기 중인 건이 없습니다." desc="할인·제안·고객 약속처럼 리스크가 있는 건만 이 화면으로 올라옵니다." />
            ) : (
              <div className="space-y-3">
                {pending.map((ap) => <ApprovalCard key={ap.id} ap={ap} onDecide={(a, d) => setDecide({ ap: a, d })} />)}
              </div>
            )}
            {decided.length > 0 && (
              <div>
                <SectionTitle>처리 완료</SectionTitle>
                <div className="space-y-3">{decided.slice(0, 5).map((ap) => <ApprovalCard key={ap.id} ap={ap} onDecide={() => {}} />)}</div>
              </div>
            )}
          </div>
        )}

        {tab === "pipeline" && (
          <div className="space-y-5">
            {/* 모바일에서 가로 Kanban 대신 상태 요약 → 클릭 → 목록 */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <button onClick={() => setStageFilter("all")} className={cx("pressable rounded-xl border px-3 py-2.5 text-left transition-colors", stageFilter === "all" ? "border-accent bg-soft/60" : "border-line hover:bg-surface-2")}>
                <div className="text-[0.75rem] font-bold text-ink-3">진행 전체</div>
                <div className="tnum text-[1.3rem] font-bold">{opps.filter((o) => o.status !== "dropped").length}</div>
              </button>
              {OPP_PIPELINE.map((s) => (
                <button key={s} onClick={() => setStageFilter(s)} className={cx("pressable rounded-xl border px-3 py-2.5 text-left transition-colors", stageFilter === s ? "border-accent bg-soft/60" : "border-line hover:bg-surface-2")}>
                  <div className="truncate text-[0.75rem] font-bold text-ink-3">{OPP_STATUS[s].label}</div>
                  <div className={cx("tnum text-[1.3rem] font-bold", s === "approval_pending" && counts[s] ? "text-warning" : s === "won" ? "text-success" : "")}>{counts[s] ?? 0}</div>
                </button>
              ))}
            </div>

            <Card className="px-4 md:px-5">
              <div className="divide-y divide-line">
                {shown.length === 0 ? (
                  <div className="py-10 text-center text-[0.9rem] text-ink-3">해당 단계의 기회가 없습니다.</div>
                ) : (
                  shown.map((o) => <OppRow key={o.id} o={o} onPropose={setPropose} />)
                )}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle><span className="flex items-center gap-2"><TrendingUp size={18} className="text-ink-3" /> 실증 측정지점</span></SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">누적 기회</div><div className="tnum text-[1.4rem] font-bold">{total}건</div><div className="mt-1 text-[0.78rem] text-ink-3">고객 관심 · 내부 발견 포함</div></div>
                <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">추가계약</div><div className="tnum text-[1.4rem] font-bold text-success">{won}건</div><div className="mt-1 text-[0.78rem] text-ink-3">표본 {total}건 기준</div></div>
                <div className="rounded-xl bg-surface-2 p-4"><div className="text-[0.75rem] font-bold text-ink-3">Baseline</div><div className="text-[1rem] font-bold text-warning">측정 필요</div><div className="mt-1 text-[0.78rem] text-ink-3">도입 전 값이 없어 전환율은 표시하지 않습니다</div></div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <DecisionModal ap={decide?.ap ?? null} decision={decide?.d ?? "approved"} onClose={() => setDecide(null)} />
      <ProposeModal o={propose} onClose={() => setPropose(null)} />
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <OpportunitiesInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, FileSignature, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { AiReadyBadge, Badge, Card, PageHeader, Tabs, EmptyState } from "@/components/ui/ui";

export default function ConsultationsPage() {
  const st = useStore();
  const openAi = useUi((s) => s.openAi);
  const [tab, setTab] = useState<"consult" | "contract">("consult");
  const consultations = [...st.consultations].sort((a, b) => b.date.localeCompare(a.date));
  const contracts = [...st.contracts].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  return (
    <div>
      <PageHeader title="상담 / 계약" desc="상담 기록은 구조화 요약으로 남기고, 계약 상태는 프로젝트 단계와 연결됩니다." />
      <Tabs tabs={[{ key: "consult", label: "상담 기록", count: consultations.length }, { key: "contract", label: "계약", count: contracts.length }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "consult" ? (
          <div className="space-y-3">
            {consultations.map((cs) => {
              const c = st.companies.find((x) => x.id === cs.companyId);
              return (
                <Card key={cs.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/ax/clients/${cs.companyId}`} className="font-bold hover:text-accent">{c?.name}</Link>
                      <Badge tone="info">{cs.type}</Badge><Badge>{cs.channel}</Badge>
                      <span className="text-[0.85rem] text-ink-2">{fmtDateTime(cs.date)} · {st.users.find((u) => u.id === cs.consultantId)?.name}</span>
                    </div>
                    <AiReadyBadge label="AI 요약" onClick={() => openAi({ title: "상담 요약 — AI 적용 설명", key: "consult" })} />
                  </div>
                  <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-2">{cs.notes}</p>
                  <div className="mt-3 grid gap-3 rounded-xl bg-surface-2 p-4 text-[0.85rem] md:grid-cols-4">
                    <div><div className="mb-1 font-bold">핵심</div><ul className="list-disc pl-4 text-ink-2">{cs.summary.core.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    <div><div className="mb-1 font-bold">요구사항</div><ul className="list-disc pl-4 text-ink-2">{cs.summary.requirements.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    <div><div className="mb-1 font-bold">필요 자료</div>{cs.summary.documents.length ? <ul className="list-disc pl-4 text-ink-2">{cs.summary.documents.map((x) => <li key={x}>{x}</li>)}</ul> : <div className="text-ink-3">-</div>}</div>
                    <div><div className="mb-1 font-bold">다음 Action</div><div className="text-accent">{cs.summary.nextAction}</div></div>
                  </div>
                </Card>
              );
            })}
            {consultations.length === 0 && <Card><EmptyState icon={<ClipboardList size={30} />} title="상담 기록이 없습니다" /></Card>}
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="tbl min-w-[820px]">
              <thead><tr><th>기업</th><th>계약명</th><th>프로젝트</th><th>상태</th><th>기간</th><th>송부</th><th>서명</th><th>범위</th></tr></thead>
              <tbody>
                {contracts.map((ct) => (
                  <tr key={ct.id}>
                    <td className="font-semibold"><Link href={`/ax/clients/${ct.companyId}`} className="hover:text-accent">{st.companies.find((c) => c.id === ct.companyId)?.name}</Link></td>
                    <td>{ct.title}</td>
                    <td><Link href={`/ax/projects/${ct.projectId}`} className="text-ink-2 hover:text-accent">{st.projects.find((p) => p.id === ct.projectId)?.name}</Link></td>
                    <td><Badge tone={ct.status === "signed" ? "success" : ct.status === "sent" ? "warning" : "neutral"}>{ct.status === "signed" ? "서명 완료" : ct.status === "sent" ? "서명 대기" : "초안"}</Badge></td>
                    <td>{ct.period}</td>
                    <td className="tnum">{ct.sentAt ? fmtDate(ct.sentAt) : "-"}</td>
                    <td className="tnum">{ct.signedAt ? fmtDate(ct.signedAt) : "-"}</td>
                    <td className="text-ink-2">{ct.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[0.8rem] text-ink-3"><FileSignature size={14} /> 전자서명 연동은 향후 확장(NEXT) 항목입니다. 현재는 상태를 수동으로 관리합니다.</div>
          </Card>
        )}
      </div>
    </div>
  );
}

export { Sparkles };

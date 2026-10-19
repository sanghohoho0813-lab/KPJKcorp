"use client";

import { useMemo, useState } from "react";
import { Landmark, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, iso } from "@/lib/format";
import { POLICY_NOTE, policyPlan, policyRequestText, type PlanRow } from "@/lib/policy-docs";
import type { Company } from "@/lib/types";
import { Badge, Button, SegmentedControl, cx } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";
import { useKitPanel } from "./ApplyKit";

/**
 * 정책자금 준비 서류 요청 (내부) — 공고가 나오기 전에 고객이 미리 모아 두게 한 번에 요청한다.
 * 서류함에 이미 있거나 요청 중인 서류는 빼고, 신청 직전에 떼는 서류(납세증명)는 기본으로 꺼 둔다.
 * 자격·자금 판단은 하지 않는다 — 서류가 준비됐는지만 본다.
 */
export function usePolicyPlan(company: Company) {
  const vault = useStore((s) => s.companyVaults.find((v) => v.companyId === company.id));
  const files = useStore((s) => s.companyFiles);
  const reqs = useStore((s) => s.docRequests);
  const seen = useMemo(() => ({ bizReg: company.docs?.bizReg?.readAt?.slice(0, 10), corpReg: company.docs?.corpReg?.readAt?.slice(0, 10) }), [company.docs]);
  return useMemo(() => policyPlan({ entity: company.entityType, companyId: company.id, vault, files, reqs, seen }), [company.entityType, company.id, vault, files, reqs, seen]);
}

const STATE_UI: Record<PlanRow["state"], { label: (r: PlanRow) => string; tone: "success" | "warning" | "error" | "neutral" | "info" }> = {
  usable: { label: (r) => (r.issuedAt ? `서류함에 있음 · 발급 ${r.issuedAt}` : "서류함에 있음"), tone: "success" },
  expiring: { label: (r) => `${r.daysLeft}일 남음`, tone: "warning" },
  expired: { label: () => "기한 지남", tone: "error" },
  missing: { label: () => "없음", tone: "neutral" },
  open: { label: (r) => (r.openStatus === "submitted" || r.openStatus === "reviewing" ? "요청 중 · 고객 제출함" : r.openStatus === "revision" ? "요청 중 · 보완 요청" : "요청 중"), tone: "info" },
};

export type PolicyMode = "prepare" | "kit";

/** 정책자금 서류 — 미리 모아 두기(공고 전) / 공고 신청 묶음(공고가 나왔을 때). 한 창에서 오간다 */
export function PolicyDocsModal({ company, open, onClose, initialMode = "prepare", initialProgramId }: { company: Company; open: boolean; onClose: () => void; initialMode?: PolicyMode; initialProgramId?: string }) {
  if (!open) return null;
  return <Inner company={company} onClose={onClose} initialMode={initialMode} initialProgramId={initialProgramId} />;
}

function Inner({ company, onClose, initialMode, initialProgramId }: { company: Company; onClose: () => void; initialMode: PolicyMode; initialProgramId?: string }) {
  const [mode, setMode] = useState<PolicyMode>(initialMode);
  const kit = useKitPanel(company, initialProgramId, onClose);
  const plan = usePolicyPlan(company);
  const request = useStore((s) => s.requestPolicyDocs);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "";
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.map((r) => [r.doc.key, r.defaultOn])));
  const [days, setDays] = useState<"14" | "30">("30");
  const picks = plan.filter((r) => r.state !== "open" && on[r.doc.key]);
  const submit = () => {
    if (!picks.length) return;
    const n = request(company.id, picks.map((r) => ({ label: r.doc.label, description: policyRequestText(r.doc), validMonths: r.doc.validMonths })), iso(addDays(new Date(), Number(days), 18)), me);
    if (n) toast(`정책자금 준비 서류 ${n}개를 요청했습니다. 고객 화면 '자료제출'에 올라가고 알림은 한 번 갑니다.`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} size={mode === "kit" ? "lg" : "md"} title={<span className="flex items-center gap-2"><Landmark size={18} className="text-accent" /> 정책자금 서류</span>}
      footer={mode === "kit" ? kit.footer : <><Button variant="ghost" onClick={onClose}>취소</Button><Button variant="accent" icon={<Send size={15} />} disabled={!picks.length} onClick={submit}>{picks.length ? `${picks.length}개 요청` : "고른 서류 없음"}</Button></>}>
      <div className="mb-3" data-testid="policy-mode">
        <SegmentedControl value={mode} onChange={setMode} options={[{ key: "prepare", label: "미리 모아 두기" }, { key: "kit", label: "공고 신청 묶음" }]} />
      </div>
      {mode === "kit" ? kit.body : <>
      <p className="text-[0.88rem] leading-relaxed text-ink-2">
        공고가 나오면 바로 신청할 수 있게 <b className="text-ink">{company.name}</b>이(가) 미리 모아 두는 서류입니다. 고른 서류만 고객 화면 <b className="text-ink">자료제출</b>에 발급 방법과 함께 올라가고, 알림은 한 번 갑니다.
      </p>
      <p className="mt-1 text-[0.78rem] text-ink-3">{POLICY_NOTE} 자격·자금 판단은 하지 않습니다.</p>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line" data-testid="policy-plan">
        {plan.map((r) => {
          const ui = STATE_UI[r.state];
          const locked = r.state === "open";
          return (
            <li key={r.doc.key}>
              <label className={cx("flex items-start gap-3 px-3.5 py-2.5", locked ? "opacity-60" : "cursor-pointer")} data-policy={r.doc.key}>
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" disabled={locked} checked={!locked && !!on[r.doc.key]} onChange={(e) => setOn((m) => ({ ...m, [r.doc.key]: e.target.checked }))} aria-label={r.doc.label} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{r.doc.label}</span>
                    <Badge tone={ui.tone}>{ui.label(r)}</Badge>
                    {r.doc.justBefore && <Badge tone="warning">신청 직전에 발급</Badge>}
                    {r.unsure && <Badge>법인이면</Badge>}
                  </span>
                  <span className="mt-0.5 block text-[0.78rem] text-ink-3">{r.doc.where}{r.doc.validText ? ` · ${r.doc.validText}` : ""}</span>
                  {r.seenAt && r.state === "missing" && <span className="mt-0.5 block text-[0.75rem] text-ink-2">기업정보에서 {r.seenAt}에 읽어 확인함 — 사본 파일은 서류함에 없습니다</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.85rem]">
        <span className="font-semibold text-ink-2">제출 기한</span>
        <SegmentedControl size="sm" value={days} onChange={setDays} options={[{ key: "14", label: "2주 뒤" }, { key: "30", label: "한 달 뒤" }]} />
        <span className="text-[0.78rem] text-ink-3">미리 모아 두는 서류라 넉넉하게 둡니다</span>
      </div>
      </>}
    </Modal>
  );
}

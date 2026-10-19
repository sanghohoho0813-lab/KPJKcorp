"use client";

import { useState } from "react";
import { ChevronDown, FileText, Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysBetween, fmtDate } from "@/lib/format";
import { POLICY_NOTE, READY_LABEL, policyReadiness, type ReadyRow } from "@/lib/policy-docs";
import type { DocumentRequest } from "@/lib/types";
import { Badge, Button, Card, cx } from "@/components/ui/ui";
import { Icon3D } from "./Icon3D";

const TONE: Record<ReadyRow["state"], "success" | "warning" | "error" | "info" | "neutral"> = { ready: "success", stale: "warning", checking: "info", todo: "neutral", revision: "error" };

/**
 * 고객 화면 "정책자금 준비 서류" — 담당자가 미리 모아 두자고 요청한 서류의 준비 상태와 발급 방법.
 * 할 일(보완·올리기)이 먼저, 준비된 것은 아래. 자격·승인 가능성은 말하지 않는다 — 서류가 모였는지만.
 */
export function PolicyDocsCard({ companyId, onUpload, onView }: { companyId: string; onUpload: (r: DocumentRequest) => void; onView: (r: DocumentRequest) => void }) {
  const reqs = useStore((s) => s.docRequests);
  const { rows, ready, total } = policyReadiness(reqs, companyId);
  const [showReady, setShowReady] = useState(false);
  if (!total) return null;
  const todo = rows.filter((r) => r.state !== "ready");
  const done = rows.filter((r) => r.state === "ready");
  const pct = Math.round((ready / total) * 100);
  return (
    <Card className="scroll-mt-20 p-4 md:p-5" id="policy-docs">
      <div className="flex flex-wrap items-center gap-2">
        <Icon3D name="tray" size="2rem" />
        <h2 className="text-[1.1rem] font-extrabold">정책자금 준비 서류</h2>
        <span className="tnum ml-auto text-[0.95rem] font-bold" data-testid="policy-count">준비 {ready}/{total}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="정책자금 준비 서류" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-2">공고가 나오면 바로 신청할 수 있게 미리 모아 두는 서류입니다. 발급처를 보고 하나씩 올려 주세요.</p>
      <p className="mt-0.5 text-[0.76rem] text-ink-3">{POLICY_NOTE}</p>

      {todo.length > 0 && <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">{todo.map((r) => <Row key={r.doc.key} r={r} onUpload={onUpload} onView={onView} />)}</ul>}
      {done.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowReady((v) => !v)} aria-expanded={showReady} className="pressable flex min-h-10 items-center gap-1 text-[0.85rem] font-semibold text-ink-2 hover:text-ink">
            준비된 서류 {done.length}개 <ChevronDown size={15} className={cx("transition-transform", showReady && "rotate-180")} />
          </button>
          {showReady && <ul className="divide-y divide-line rounded-2xl border border-line">{done.map((r) => <Row key={r.doc.key} r={r} onUpload={onUpload} onView={onView} />)}</ul>}
        </div>
      )}
      {todo.length === 0 && <p className="mt-3 rounded-xl bg-success-bg px-4 py-2.5 text-[0.88rem] font-semibold text-success">요청드린 서류가 모두 준비되었습니다.</p>}
    </Card>
  );
}

function Row({ r, onUpload, onView }: { r: ReadyRow; onUpload: (r: DocumentRequest) => void; onView: (r: DocumentRequest) => void }) {
  return (
    // 휴대폰에서도 버튼은 오른쪽 — 줄마다 버튼 한 줄이 따로 생기면 목록이 두 배로 길어진다.
    // '올려 주세요'는 버튼이 말해 주므로 배지를 붙이지 않는다(보완·확인 중·준비됨만 배지)
    <li className="flex items-start gap-3 px-3.5 py-3 sm:items-center" data-policy-doc={r.doc.key} data-state={r.state}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {r.state !== "todo" && <Badge tone={TONE[r.state]}>{READY_LABEL[r.state]}</Badge>}
          <span className="font-bold">{r.doc.label}</span>
        </div>
        <div className="mt-0.5 text-[0.8rem] leading-snug text-ink-3">{r.doc.where}{r.doc.validText ? ` · ${r.doc.validText}` : ""}</div>
        {/* 공고 신청 묶음으로 요청한 서류는 기한이 신청일에 맞춰 짧다 — 2주 안이면 기한을 보인다 */}
        {(r.state === "todo" || r.state === "revision") && daysBetween(new Date().toISOString(), r.req.dueDate) <= 14 && <div className="mt-0.5 text-[0.8rem] font-semibold text-error">기한 {fmtDate(r.req.dueDate)}</div>}
        {r.state === "revision" && r.req.reviewNote && <div className="mt-1.5 rounded-lg bg-error-bg px-3 py-2 text-[0.82rem] text-error"><b>보완 요청:</b> {r.req.reviewNote}</div>}
        {r.state === "stale" && <div className="mt-1 text-[0.8rem] font-semibold text-warning">유효기간이 지났습니다 — 신청할 때 새로 발급받아 주시면 담당 컨설턴트가 다시 요청드립니다.</div>}
        {r.state === "ready" && r.req.submittedAt && <div className="mt-0.5 text-[0.78rem] text-ink-3">{fmtDate(r.req.submittedAt)} 제출 · 확인 완료</div>}
      </div>
      <div className="flex shrink-0 gap-2 pt-0.5 sm:pt-0">
        {r.state === "todo" && <Button size="sm" variant="accent" icon={<Upload size={14} />} onClick={() => onUpload(r.req)}>올리기</Button>}
        {r.state === "revision" && <Button size="sm" variant="outline" icon={<Upload size={14} />} onClick={() => onUpload(r.req)}>다시 올리기</Button>}
        {(r.state === "checking" || r.state === "ready" || r.state === "stale") && <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => onView(r.req)}>보기</Button>}
      </div>
    </li>
  );
}

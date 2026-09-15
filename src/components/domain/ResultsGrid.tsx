"use client";

import Link from "next/link";
import { useState } from "react";
import { FileCheck2, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { fmtDateTime, fmtSize } from "@/lib/format";
import type { ResultFile } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, IconTile, Textarea } from "@/components/ui/ui";
import { Modal } from "@/components/ui/overlay";

/** 고객에게 공유한 결과자료 목록. 자료관리 탭과 /ax/results 양쪽에서 같은 것을 쓴다. */
export function ResultsGrid() {
  const st = useStore();
  const withdraw = useStore((s) => s.withdrawResult);
  const toast = useStore((s) => s.toast);
  const me = st.session?.userId ?? "u_admin";
  const mayWithdraw = can(st.session?.role, "result.withdraw");
  const [target, setTarget] = useState<ResultFile | null>(null);
  const [reason, setReason] = useState("");
  const results = [...st.results].sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
  const viewed = (name: string) => st.activities.filter((a) => a.type === "result_downloaded" && a.text.includes(name)).length;

  if (results.length === 0) {
    return (
      <Card>
        <EmptyState icon={<FileCheck2 size={30} />} title="공유된 결과자료가 없습니다" desc="프로젝트 상세에서 '결과자료 공유'로 등록할 수 있습니다." />
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {results.map((r) => (
          <Card key={r.id} className="flex items-start gap-3 p-4">
            <IconTile color="var(--mod-evidence)"><FileCheck2 size={18} /></IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{r.name}</span><Badge>{r.kind}</Badge></div>
              <div className="mt-0.5 text-[0.85rem] text-ink-2">{r.description}</div>
              <div className="mt-1.5 text-[0.75rem] text-ink-3">
                <Link href={`/ax/clients/${r.companyId}`} className="hover:text-accent">{st.companies.find((c) => c.id === r.companyId)?.name}</Link> · {st.projects.find((p) => p.id === r.projectId)?.name}
              </div>
              <div className="mt-0.5 text-[0.75rem] text-ink-3">{fmtDateTime(r.sharedAt)} · {fmtSize(r.size)} · {st.users.find((u) => u.id === r.sharedBy)?.name} · 고객 열람 {viewed(r.name)}회</div>
              {mayWithdraw && (
                <button onClick={() => { setTarget(r); setReason(""); }} className="pressable mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[0.78rem] font-semibold text-ink-2 hover:bg-surface-2 hover:text-error">
                  <RotateCcw size={13} /> 회수
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* 회수 = 고객 화면에서 내리기. 잘못 올린 자료를 고객이 계속 보게 두지 않는다. 회수 사실과 사유는 기록에 남는다. */}
      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        size="sm"
        title="결과자료 회수"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>취소</Button>
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => { if (!target) return; withdraw(target.id, reason.trim() || undefined, me); toast("결과자료를 회수했습니다. 고객에게 안내가 전송되었습니다."); setTarget(null); }}>회수</Button>
          </>
        }
      >
        <div className="mb-3 rounded-xl bg-surface-2 px-4 py-2.5 text-[0.88rem]"><b>{target?.name}</b> · {st.companies.find((c) => c.id === target?.companyId)?.name}</div>
        <p className="mb-3 text-[0.85rem] leading-relaxed text-ink-2">
          고객 Portal의 완료자료에서 내려가고 회수 안내가 전송됩니다. 고객이 이미 {target ? viewed(target.name) : 0}회 열람했습니다.
        </p>
        <Field label="사유 (고객에게 표시)" hint="선택"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 수치 오류가 있어 수정본으로 다시 공유드리겠습니다." /></Field>
      </Modal>
    </>
  );
}

"use client";

import { ArrowUpRight } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { NextBadge } from "@/components/ui/ui";
import { NEXT_FEATURES, useUi } from "@/lib/ui-store";

/** FUTURE EXPANSION — Preview Sheet. Never a 404, never looks like a live feature. */
export function NextSheet() {
  const key = useUi((s) => s.nextSheet);
  const close = () => useUi.getState().openNext(null);
  const f = NEXT_FEATURES.find((x) => x.key === key);
  return (
    <Modal open={!!f} onClose={close} size="md" title={<span className="flex items-center gap-2"><NextBadge /> {f?.title}</span>}>
      {f && (
        <div className="space-y-4">
          <div className="rounded-xl bg-warning-bg px-4 py-3 text-[0.85rem] font-semibold text-warning">향후 확장 기능입니다. 현재 구축 범위에 포함되지 않으며, 실제 운영 데이터가 쌓인 뒤 우선순위를 재검토합니다.</div>
          <p className="text-[0.95rem] text-ink-2">{f.desc}</p>
          <ul className="space-y-2">
            {f.items.map((i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl border border-dashed border-line-2 px-4 py-3 text-[0.9rem]">
                <ArrowUpRight size={16} className="mt-1 shrink-0 text-ink-3" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

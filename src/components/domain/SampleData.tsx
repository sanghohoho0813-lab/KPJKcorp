"use client";

import { useState } from "react";
import { Eye, FlaskConical, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { Badge, Button, cx } from "@/components/ui/ui";
import { Confirm } from "@/components/ui/overlay";

/**
 * 샘플 기업 6개 — 지우기 / 다시 보기.
 * 실제 고객을 넣기 시작하면 샘플이 섞여 헷갈린다. 버튼 하나로 흔적 없이 지우고, 버튼 하나로 되살린다.
 * 사용자가 직접 넣은 기업·기록은 어느 쪽에서도 건드리지 않는다.
 */
export function useSampleState() {
  const companies = useStore((s) => s.companies);
  const role = useStore((s) => s.session?.role);
  const samples = companies.filter((c) => c.sample);
  return { samples, hasSamples: samples.length > 0, own: companies.filter((c) => !c.sample).length, manage: can(role, "data.manage") };
}

/** 기업고객 목록 상단 안내 띠 — 샘플이 있을 때만 */
export function SampleBanner({ className }: { className?: string }) {
  const { samples, hasSamples, own, manage } = useSampleState();
  const [confirm, setConfirm] = useState(false);
  if (!hasSamples) return null;
  return (
    <>
      <div className={cx("flex flex-wrap items-center gap-2 rounded-xl border border-info/30 bg-info-bg/60 px-4 py-2.5 text-[0.85rem]", className)}>
        <FlaskConical size={16} className="shrink-0 text-info" />
        <span className="min-w-0 flex-1 text-ink-2">
          <b className="text-ink">샘플 기업 {samples.length}개</b>가 함께 표시되고 있습니다. {own > 0 ? `직접 등록한 ${own}개는 그대로 두고 샘플만 지울 수 있습니다.` : "실제 고객을 넣기 시작하면 지워도 됩니다. 언제든 다시 볼 수 있습니다."}
        </span>
        {manage ? (
          <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>샘플 {samples.length}개 지우기</Button>
        ) : (
          <span className="text-[0.78rem] text-ink-3">대표 계정에서 지울 수 있습니다</span>
        )}
      </div>
      <RemoveSamplesConfirm open={confirm} onClose={() => setConfirm(false)} />
    </>
  );
}

/** 샘플이 없을 때의 "다시 보기" 버튼 */
export function RestoreSamplesButton({ size = "md" }: { size?: "sm" | "md" }) {
  const { hasSamples, manage } = useSampleState();
  const restore = useStore((s) => s.restoreSamples);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  const serverMode = useStore((s) => s.serverMode);
  // 서버 모드에서는 샘플을 되살리지 않는다 — 서버에 시연용 기업이 실제 데이터처럼 저장되기 때문이다.
  if (hasSamples || !manage || serverMode) return null;
  return (
    <Button size={size} variant="ghost" icon={<Eye size={size === "sm" ? 14 : 16} />} onClick={() => {
      const r = restore(me);
      if (!r.ok) { toast(r.reason, "error"); return; }
      toast(`샘플 기업 ${r.counts.companies}개와 프로젝트 ${r.counts.projects}개를 다시 넣었습니다.`);
    }}>샘플 6개 보기</Button>
  );
}

export function RemoveSamplesConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { samples } = useSampleState();
  const remove = useStore((s) => s.removeSamples);
  const live = useStore((s) => !!s.settings.liveMode);
  const toast = useStore((s) => s.toast);
  const me = useStore((s) => s.session?.userId) ?? "u_admin";
  return (
    <Confirm
      open={open}
      onClose={onClose}
      onConfirm={() => {
        const r = remove(me);
        onClose();
        if (!r.ok) { toast(r.reason, "error"); return; }
        toast(`샘플을 지웠습니다 — 기업 ${r.counts.companies} · 프로젝트 ${r.counts.projects} · 관련 기록 ${r.counts.records}건.${live ? "" : " 운영 모드가 함께 켜졌습니다."}`);
      }}
      title={`샘플 기업 ${samples.length}개를 지울까요?`}
      desc={`${samples.map((c) => c.name).join(", ")} — 이 기업들의 프로젝트·상담·자료·일정·문의·기록·Portal 계정이 전부 사라집니다. 직접 등록한 기업은 그대로 남습니다. "샘플 6개 보기" 버튼으로 언제든 다시 넣을 수 있습니다.${live ? "" : " 지우는 순간 운영 모드가 켜져 20시간 자동 초기화가 멈춥니다."}`}
      confirmText="샘플 지우기"
      danger
    />
  );
}

/** 설정 화면용 카드 */
export function SamplePanel() {
  const { samples, hasSamples, own, manage } = useSampleState();
  const serverMode = useStore((s) => s.serverMode);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-bold"><FlaskConical size={16} className="text-ink-3" /> 샘플 데이터</span>
        {hasSamples ? <Badge tone="info">샘플 {samples.length}개 표시 중</Badge> : <Badge tone="neutral">샘플 없음</Badge>}
        {own > 0 && <Badge tone="success">직접 등록 {own}개</Badge>}
      </div>
      <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-2">
        시연용 기업 6개(에이정밀·비앤테크·씨엠푸드·디원건설·이플러스바이오·에프물류)와 그 기록입니다. 지워도 직접 등록한 기업은 남고, 다시 보기를 누르면 그대로 돌아옵니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {hasSamples
          ? <Button size="sm" variant="outline" icon={<Trash2 size={14} />} disabled={!manage} onClick={() => setConfirm(true)}>샘플 {samples.length}개 지우기</Button>
          : serverMode ? <span className="text-[0.82rem] text-ink-3">서버에 연결된 동안에는 샘플을 넣지 않습니다 — 실제 데이터와 섞이지 않게 하기 위해서입니다.</span> : <RestoreSamplesButton size="sm" />}
      </div>
      {!manage && <p className="mt-2 text-[0.78rem] text-ink-3">샘플 지우기·다시 보기는 대표 계정에서만 가능합니다.</p>}
      <RemoveSamplesConfirm open={confirm} onClose={() => setConfirm(false)} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button, Textarea } from "@/components/ui/ui";
import { useUi } from "@/lib/ui-store";
import { useStore } from "@/lib/store";
import { communicationDraft, type DraftKind } from "@/lib/brief";

/** AI READY explanation — what data / what judgement / what output / why here / future API */
const AI_INFO: Record<string, { reads: string[]; does: string[]; output: string; why: string; now: string; method: string }> = {
  brief: {
    method: "RULE + LLM (AI READY)",
    reads: ["프로젝트 단계와 마지막 Activity 시각", "요청자료 상태와 제출기한", "오늘 일정", "미답변 문의", "업무 기한"],
    does: ["기한 초과·오늘 마감·정체·미답변을 규칙으로 판별", "손실 위험이 큰 순서로 우선순위 계산", "각 항목에 근거 2~4개를 붙임"],
    output: "오늘 먼저 확인할 업무 목록 + 왜? + 다음 Action",
    why: "담당자가 여러 화면을 돌며 확인하던 시간을 줄이고, 누락 위험을 아침에 한 번에 잡기 위함입니다.",
    now: "현재 MVP: 규칙 기반으로 실제 데이터에서 계산됩니다. 향후 LLM은 문장화·요약에만 사용합니다.",
  },
  consult: {
    method: "LLM (AI READY)",
    reads: ["상담 메모 원문", "회사 기본정보", "기존 프로젝트 정보"],
    does: ["핵심 내용·요구사항·약속사항·필요자료·다음 Action으로 구조화", "확정되지 않은 판단은 '확인 필요'로 표시"],
    output: "구조화된 상담 요약 (담당자가 수정 후 저장)",
    why: "상담 후 정리 시간을 줄이고, 약속사항과 필요자료가 누락되지 않게 하기 위함입니다.",
    now: "현재 MVP: 담당자가 입력한 구조화 요약을 표시합니다. GPT/Claude API 연결 시 원문에서 자동 생성됩니다. 경영·법률 판단은 자동 확정하지 않습니다 (L1 Assist).",
  },
  project: {
    method: "RULE (LLM AI READY)",
    reads: ["프로젝트 단계·마감", "요청자료 제출 현황", "다음 일정", "마지막 Activity"],
    does: ["현재 위치·남은 것·다음 행동을 3~4문장으로 정리"],
    output: "프로젝트 요약 + 다음 Action",
    why: "대표나 담당자가 프로젝트를 열었을 때 5초 안에 상황을 파악하기 위함입니다.",
    now: "현재 MVP: 규칙 기반 문장 생성. 향후 LLM으로 자연스러운 요약과 리스크 코멘트를 추가할 수 있습니다.",
  },
  missing: {
    method: "RULE",
    reads: ["프로젝트에 필요한 자료 목록", "제출·검토 상태"],
    does: ["필요 자료 vs 제출 자료 비교", "미제출·보완필요·검토대기 분류"],
    output: "자료 누락 체크 결과",
    why: "IF/비교로 충분한 영역입니다. AI로 포장하지 않고 규칙으로 정확하게 처리합니다.",
    now: "현재 MVP: 완전히 동작하는 규칙 로직입니다. AI 연결 대상이 아닙니다.",
  },
  draft: {
    method: "RULE 템플릿 (LLM AI READY)",
    reads: ["고객·담당자 이름", "자료명·기한", "일정·장소"],
    does: ["상황별 안내 문구 초안 생성"],
    output: "편집 가능한 메시지 초안 (담당자 확인 후 발송)",
    why: "반복되는 안내 문구 작성 시간을 줄이되, 발송은 항상 사람이 결정합니다.",
    now: "현재 MVP: 템플릿 기반. 향후 LLM으로 고객 상황에 맞춘 톤 조정이 가능합니다. 자동 발송은 하지 않습니다.",
  },
};

export function AiReadyModal() {
  const ai = useUi((s) => s.aiModal);
  const close = () => useUi.getState().openAi(null);
  const info = ai ? AI_INFO[ai.key] : null;
  return (
    <Modal open={!!ai} onClose={close} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> {ai?.title}</span>} size="md">
      {info && (
        <div className="space-y-4 text-[0.92rem]">
          <div className="rounded-xl bg-soft px-4 py-3 text-[0.85rem] font-semibold text-accent">Method: {info.method}</div>
          <Block title="무엇을 보나요?" items={info.reads} />
          <Block title="AI가 무엇을 하나요?" items={info.does} />
          <div>
            <div className="mb-1 font-bold">어떤 결과가 나오나요?</div>
            <p className="text-ink-2">{info.output}</p>
          </div>
          <div>
            <div className="mb-1 font-bold">왜 이 위치에 필요한가요?</div>
            <p className="text-ink-2">{info.why}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[0.85rem] text-ink-2">{info.now}</div>
        </div>
      )}
    </Modal>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 font-bold">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/** AI-05 Communication draft — editable, copy only (no auto send) */
export function DraftModal() {
  const d = useUi((s) => s.draftModal);
  if (!d) return null;
  return <DraftEditor key={JSON.stringify(d)} kind={d.kind as DraftKind} ctx={d.ctx} />;
}

function DraftEditor({ kind, ctx }: { kind: DraftKind; ctx: Record<string, string | undefined> }) {
  const toast = useStore((s) => s.toast);
  const close = () => useUi.getState().openDraft(null);
  const [text, setText] = useState(() =>
    communicationDraft(kind, {
      companyName: ctx.companyName ?? "",
      contactName: ctx.contactName ?? "",
      consultantName: ctx.consultantName ?? "",
      docName: ctx.docName,
      dueText: ctx.dueText,
      scheduleTitle: ctx.scheduleTitle,
      scheduleTime: ctx.scheduleTime,
      location: ctx.location,
      stage: ctx.stage,
      note: ctx.note,
    }),
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("초안을 복사했습니다. 카카오톡/이메일에 붙여넣어 발송하세요.");
    } catch {
      toast("복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.", "error");
    }
  };
  return (
    <Modal
      open
      onClose={close}
      title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> 커뮤니케이션 초안</span>}
      footer={
        <>
          <Button variant="ghost" onClick={() => useUi.getState().openAi({ title: "커뮤니케이션 초안 — AI 적용 설명", key: "draft" })}>AI 설명</Button>
          <Button variant="accent" icon={<Copy size={16} />} onClick={copy}>복사</Button>
        </>
      }
    >
      <p className="mb-3 text-[0.85rem] text-ink-2">담당자가 확인·수정 후 직접 발송합니다. 자동 발송은 하지 않습니다.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-64" />
    </Modal>
  );
}

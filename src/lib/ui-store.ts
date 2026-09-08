"use client";

import { create } from "zustand";

/** Non-persisted UI state shared between shell controls and overlay components. */
interface UiState {
  tutorial: "ax" | "portal" | null;
  presentation: boolean;
  presentationStep: number;
  devicePreview: "mobile" | "desktop" | null;
  moreSheet: boolean;
  nextSheet: string | null; // NEXT feature key
  aiModal: { title: string; key: string } | null;
  draftModal: { kind: string; ctx: Record<string, string | undefined> } | null;

  openTutorial: (which: "ax" | "portal") => void;
  closeTutorial: () => void;
  openPresentation: () => void;
  closePresentation: () => void;
  setPresentationStep: (n: number) => void;
  openPreview: (mode: "mobile" | "desktop") => void;
  closePreview: () => void;
  setMoreSheet: (v: boolean) => void;
  openNext: (key: string | null) => void;
  openAi: (v: { title: string; key: string } | null) => void;
  openDraft: (v: { kind: string; ctx: Record<string, string | undefined> } | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  tutorial: null,
  presentation: false,
  presentationStep: 0,
  devicePreview: null,
  moreSheet: false,
  nextSheet: null,
  aiModal: null,
  draftModal: null,
  openTutorial: (which) => set({ tutorial: which, presentation: false, moreSheet: false }),
  closeTutorial: () => set({ tutorial: null }),
  openPresentation: () => set({ presentation: true, presentationStep: 0, tutorial: null, moreSheet: false }),
  closePresentation: () => set({ presentation: false }),
  setPresentationStep: (n) => set({ presentationStep: n }),
  openPreview: (mode) => set({ devicePreview: mode, moreSheet: false }),
  closePreview: () => set({ devicePreview: null }),
  setMoreSheet: (v) => set({ moreSheet: v }),
  openNext: (key) => set({ nextSheet: key, moreSheet: false }),
  openAi: (v) => set({ aiModal: v }),
  openDraft: (v) => set({ draftModal: v }),
}));

export const NEXT_FEATURES: { key: string; title: string; desc: string; items: string[] }[] = [
  { key: "notify", title: "알림 자동화 고도화", desc: "자료 기한·정체 프로젝트·미답변 문의를 카카오톡/이메일로 자동 안내", items: ["기한 D-3 / D-1 / 당일 자동 리마인드", "담당자별 아침 브리핑 발송", "고객 Portal 푸시 알림", "발송 이력 Evidence 기록"] },
  { key: "docs", title: "문서 작성·정리 자동화", desc: "상담 메모와 제출자료를 바탕으로 보고서 초안·체크리스트 자동 생성", items: ["상담 메모 → 구조화 요약 (LLM 연결)", "프로젝트 유형별 보고서 템플릿", "제출자료 자동 분류·명명", "결과보고서 초안 생성"] },
  { key: "report", title: "운영 리포트 고도화", desc: "담당자별·프로젝트 유형별 소요기간, 병목 단계, 고객 응답 패턴 분석", items: ["단계별 평균 소요기간", "담당자 1인당 관리 고객 수 추이", "자료 제출 리드타임 분석", "월간 운영 리포트 자동 생성"] },
  { key: "portal", title: "고객 Portal Self-Service 확대", desc: "고객이 직접 상담 예약·일정 변경·추가 요청을 할 수 있는 범위 확대", items: ["상담·미팅 일정 직접 예약", "일정 변경 요청", "추가 컨설팅 요청", "만족도 조사"] },
  { key: "integration", title: "외부서비스 연동", desc: "전자서명·회계·캘린더 등 실제 업무 도구와 연결", items: ["전자계약 서명 연동", "Google/Outlook 캘린더 동기화", "회계 프로그램 재무자료 가져오기", "메신저 알림 연동"] },
];

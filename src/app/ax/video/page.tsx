import { VideoDetail } from "@/components/domain/VideoDetail";

/**
 * 실사용 영상 — KPJK Business AX 소개 영상(9:16, 자막 포함) 원본을 그대로 보여주는 약식 상세 페이지.
 * 영상 파일: public/media/kpjk-ax-reel.mp4 (제작 도구: tools/video/reel-ax)
 */
const CHAPTERS = [
  { at: 0, label: "KPJK 소개" },
  { at: 14.8, label: "문제 ① 흩어지는 정보" },
  { at: 40.5, label: "업무 흐름을 하나의 구조로" },
  { at: 56.6, label: "문제 ② 고객의 같은 불편" },
  { at: 70.9, label: "고객 포털" },
  { at: 81.2, label: "자료 제출 순환 구조" },
  { at: 101.8, label: "줄어드는 반복 업무" },
  { at: 121.4, label: "문제 ③ 기업성장 관리" },
  { at: 157.3, label: "개발 주체 · 특허 출원" },
  { at: 173.4, label: "단계별 사업화" },
  { at: 196.8, label: "장기 방향" },
  { at: 213.4, label: "정리 · 현재 단계" },
];

export default function VideoPage() {
  return (
    <VideoDetail
      src="/media/kpjk-ax-reel.mp4"
      poster="/media/kpjk-ax-reel-poster.jpg"
      eyebrow="KPJK Business AX · 실사용 영상"
      title={<>현장의 노하우를,<br /><span className="text-highlight">실제로 작동하는 기술</span>로</>}
      desc="경영컨설팅 현장에서 반복되던 문제를 업무 흐름 구조와 고객 포털로 옮긴 과정을, 실제 시스템 화면으로 설명합니다."
      duration="4분 04초"
      chapters={CHAPTERS}
      note="화면 속 기업 · 인물 · 자료는 예시 데이터입니다 · 핵심 구조 특허 출원 완료 (10-2026-0177079)"
      downloadName="KPJK_AX_실사용영상.mp4"
    />
  );
}

import { VideoDetail } from "@/components/domain/VideoDetail";

/**
 * 보완 설명 영상 — 벤처기업확인 실사 이후, 대표가 직접 개발 주체 · 9월 17일 이후 개선 · 단계적 계획을 설명하는 영상(9:16, 자막 포함).
 * 영상 파일: public/media/kpjk-ax-supplement.mp4 (제작 도구: tools/video/v31 · 스타일 가이드 V3.1 · 장면표 tools/video/v31/supplement)
 */
const CHAPTERS = [
  { at: 0, label: "상담에서 끝나지 않는 컨설팅" },
  { at: 14.2, label: "대표님들이 겪는 어려움" },
  { at: 37.9, label: "개발 방향 · 스스로 이해하고 실행" },
  { at: 51.4, label: "개발 주체 · 대표 직접 주도" },
  { at: 66.3, label: "외부 개발사 · 소프트웨어 구현" },
  { at: 71.3, label: "9월 17일 이후 ① 도입 전후 기준" },
  { at: 76.8, label: "② 휴대폰 제출 → 내부 업무" },
  { at: 80.3, label: "③ 기업 상태 · 다음 성장 과제" },
  { at: 83.8, label: "④ 지원사업 → 담당자 업무" },
  { at: 92.5, label: "실제 사용을 생각한 시험" },
  { at: 100.8, label: "목표 · 스스로 성장하는 환경" },
  { at: 121.8, label: "단계적 사업화 계획" },
  { at: 135.2, label: "현재 단계" },
  { at: 146.5, label: "경험을 기술과 데이터로" },
  { at: 155.5, label: "개발 기록 첨부 (9월 17일 ~ 10월 7일)" },
];

export default function SupplementVideoPage() {
  return (
    <VideoDetail
      src="/media/kpjk-ax-supplement.mp4"
      poster="/media/kpjk-ax-supplement-poster.jpg"
      eyebrow="KPJK Business AX · 보완 설명 영상"
      title={<>상담에서 끝나지 않는,<br /><span className="text-highlight">스스로 성장하는 환경</span>을 위해</>}
      desc="대표가 직접 설명합니다 — 누가 어떻게 개발했는지, 9월 17일 신청 이후 무엇을 개선하고 시험했는지, 앞으로 어떤 순서로 사업화할지."
      duration="2분 50초"
      chapters={CHAPTERS}
      note="화면 속 기업 · 인물 · 자료 · 공고는 예시 데이터입니다 · 9월 17일 ~ 10월 7일 개발 경과는 기술 개발 코드와 연구 기록에 정리해 별도로 첨부했습니다"
      downloadName="KPJK_AX_보완설명영상.mp4"
    />
  );
}

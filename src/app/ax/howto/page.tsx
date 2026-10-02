import { VideoDetail } from "@/components/domain/VideoDetail";

/**
 * 사용 방법 영상 — KPJK AX를 처음 쓰는 대표·직원용 안내 영상(9:16, 자막 포함) 원본을 보여주는 약식 상세 페이지.
 * 영상 파일: public/media/kpjk-ax-howto.mp4 (제작 도구: tools/video/howto-ax)
 */
const CHAPTERS = [
  { at: 0, label: "KPJK AX는 운영 시스템" },
  { at: 14.7, label: "① 고객 기업 등록" },
  { at: 40.4, label: "② 자료 요청 · 제출 · 검토" },
  { at: 75.4, label: "③ 진행 상황 관리" },
  { at: 101.4, label: "④ 고객 포털 활용" },
  { at: 116.0, label: "고객 요청 → 내부 업무" },
  { at: 130.8, label: "⑤ 정부지원사업 활용" },
  { at: 152.7, label: "꾸준히 쓰면 달라지는 것" },
  { at: 181.7, label: "한 사이클부터 시작하기" },
  { at: 203.9, label: "KPJK AX의 목적" },
];

export default function HowtoPage() {
  return (
    <VideoDetail
      src="/media/kpjk-ax-howto.mp4"
      poster="/media/kpjk-ax-howto-poster.jpg"
      eyebrow="KPJK Business AX · 사용 방법 영상"
      title={<>처음 쓰는 분을 위한<br /><span className="text-highlight">다섯 단계</span> 사용법</>}
      desc="고객 기업 등록부터 자료 요청, 진행 상황 관리, 고객 포털, 정부지원사업까지 — 실제 화면으로 순서대로 보여드립니다. 처음에는 한 사이클만 따라 해 보세요."
      duration="3분 43초"
      chapters={CHAPTERS}
      note="화면 속 기업 · 인물 · 자료 · 공고는 예시 데이터입니다 · 불편한 점은 사이드바의 '시스템 개선 의견'으로 알려 주세요"
      downloadName="KPJK_AX_사용방법.mp4"
    />
  );
}

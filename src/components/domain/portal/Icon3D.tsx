import { cx } from "@/components/ui/ui";

/**
 * 3D 아이콘 — 대표님이 직접 만든 점토 느낌 그림(128px webp, 개당 4~7KB).
 *  고객 화면: public/assets/portal-icons — 바로가기 · 아래 탭 · 머리글
 *  내부 AX: public/assets/ax-icons (이름 앞에 "ax-") — 대시보드 · 기업 상세의 숫자 칸 · 휴대폰 아래 탭
 * 작게 쓴다. 그림은 장식이라 읽기 도구에는 숨기고, 옆 글자가 이름을 말한다.
 * 같은 메뉴는 어디서나 같은 그림 — 아래 탭과 바로가기·내 정보 메뉴가 서로 맞는다.
 */
export type Icon3DName =
  | "dashboard" | "idea" | "checklist" | "tray" | "roadmap" | "together" | "growth" | "flow"
  | "upload" | "funding" | "company" | "profile" | "bell" | "secure" | "results"
  // 내부 AX — 대시보드(오늘 할 업무 · 승인 대기 · 미답변 문의 · 자료 검토 대기 · 연락 필요)
  | "ax-tasks" | "ax-approval" | "ax-inquiry" | "ax-review" | "ax-call"
  // 내부 AX — 기업 상세(진행 프로젝트 · 자료 · 다음 일정 · 문의 · 마지막 연락)
  | "ax-doc" | "ax-files" | "ax-deadline" | "ax-talk" | "ax-phone"
  // 내부 AX — 휴대폰 아래 탭(오늘 · 고객 · 프로젝트 · 자료 · 더보기)
  | "ax-today" | "ax-clients" | "ax-projects" | "ax-docs" | "ax-more";

/** 고객 화면 메뉴 → 그림 */
export const PORTAL_ICON: Record<string, Icon3DName> = {
  "/portal": "dashboard",
  "/portal/projects": "flow",
  "/portal/documents": "upload",
  "/portal/schedule": "roadmap",
  "/portal/results": "results",
  "/portal/services": "together",
  "/portal/programs": "funding",
  "/portal/inquiries": "idea",
  "/portal/company": "company",
  "/portal/notifications": "bell",
  "/portal/me": "profile",
};

export function Icon3D({ name, size = "2.2rem", muted, className }: { name: Icon3DName; size?: string; muted?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 128px 장식 그림 몇 KB — 최적화 경로보다 그대로가 빠르다
    <img
      src={name.startsWith("ax-") ? `/assets/ax-icons/${name.slice(3)}.webp` : `/assets/portal-icons/${name}.webp`}
      alt=""
      aria-hidden
      width={128}
      height={128}
      draggable={false}
      decoding="async"
      className={cx("pointer-events-none shrink-0 select-none object-contain transition-[filter,opacity]", muted && "opacity-80 saturate-[.35]", className)}
      style={{ width: size, height: size }}
    />
  );
}

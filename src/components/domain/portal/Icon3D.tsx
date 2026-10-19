import { cx } from "@/components/ui/ui";

/**
 * 고객 화면 3D 아이콘 — 대표님이 직접 만든 점토 느낌 그림(public/assets/portal-icons, 128px webp, 개당 4~7KB).
 * 작게 쓴다(앱 바로가기 정도). 그림은 장식이라 읽기 도구에는 숨기고, 옆 글자가 이름을 말한다.
 * 같은 메뉴는 어디서나 같은 그림 — 아래 탭과 바로가기·내 정보 메뉴가 서로 맞는다.
 */
export type Icon3DName =
  | "dashboard" | "idea" | "checklist" | "tray" | "roadmap" | "together" | "growth" | "flow"
  | "upload" | "funding" | "company" | "profile" | "bell" | "secure" | "results";

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
      src={`/assets/portal-icons/${name}.webp`}
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

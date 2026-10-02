"use client";

import { Cloud, FlaskConical, HardDrive } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { demoForced, deployedWithoutServer, serverAvailable } from "@/lib/server/client";
import { cx } from "@/components/ui/ui";

/**
 * 지금 이 기기가 무엇에 붙어 있는가 — 한 줄로.
 * "PC 에서 넣은 게 폰에서 안 보인다"의 원인은 거의 늘 두 기기가 서로 다른 곳(서버 / 각자 브라우저)을 보고 있는 것이다.
 * 휴대폰에서도 바로 확인할 수 있게 메뉴 맨 위에 둔다. 로그인 아이디까지 보여야 "다른 계정"도 구분된다.
 */
export function ConnectionStatus({ className }: { className?: string }) {
  const serverMode = useStore((s) => s.serverMode);
  const hydrated = useStore((s) => s.hydrated);
  const live = useStore((s) => s.settings.liveMode);
  const user = useCurrentUser();
  if (!hydrated) return null;

  const forced = !serverMode && serverAvailable() && demoForced();
  const noServer = !serverMode && deployedWithoutServer();
  const tone = serverMode ? "ok" : forced || (noServer && live) ? "bad" : "warn";
  const title = serverMode
    ? "서버에 연결됨"
    : forced
      ? "이 브라우저는 데모 모드"
      : noServer
        ? "서버 미연결 — 이 기기에만 저장"
        : live ? "이 기기에만 저장 (서버 없음)" : "데모 데이터 (시연용)";
  const desc = serverMode
    ? "어느 기기에서 열어도 같은 내용이 보입니다."
    : "여기서 입력한 내용은 이 기기 브라우저에만 있습니다. 휴대폰·다른 PC에서는 보이지 않습니다.";
  const Icon = serverMode ? Cloud : forced ? FlaskConical : HardDrive;
  return (
    <div
      data-testid="connection-status"
      data-mode={serverMode ? "server" : forced ? "forced-demo" : noServer ? "no-server" : "demo"}
      className={cx(
        "rounded-xl border px-3 py-2.5 text-[0.8rem]",
        tone === "ok" && "border-success/30 bg-success-bg/60",
        tone === "warn" && "border-warning/40 bg-warning-bg/60",
        tone === "bad" && "border-error/40 bg-error-bg",
        className,
      )}
    >
      <div className="flex items-center gap-2 font-bold">
        <Icon size={15} className={cx("shrink-0", tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-error")} />
        {title}
      </div>
      <div className="mt-0.5 text-ink-2">{desc}</div>
      {user && <div className="mt-1 truncate text-ink-3">로그인: <b className="font-semibold text-ink-2">{user.email}</b></div>}
    </div>
  );
}

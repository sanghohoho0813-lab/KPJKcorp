"use client";

import { ErrorScreen } from "@/components/shell/ErrorScreen";

/** 고객 포털 — 상단 메뉴는 그대로 두고 내용 자리에만 안내가 뜬다 */
export default function PortalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} home="/portal" homeLabel="우리 회사 홈으로" />;
}

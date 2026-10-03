"use client";

import { ErrorScreen } from "@/components/shell/ErrorScreen";

/** 운영 화면 — 사이드바·헤더는 그대로 두고 내용 자리에만 안내가 뜬다 */
export default function AxError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} home="/ax/dashboard" homeLabel="대시보드로" />;
}

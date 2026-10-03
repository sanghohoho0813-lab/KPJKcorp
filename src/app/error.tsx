"use client";

import { ErrorScreen } from "@/components/shell/ErrorScreen";

/** 로그인·인쇄·매칭 화면, 또는 운영 화면·포털의 바깥 틀(사이드바·메뉴)까지 깨졌을 때 */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} home="/" homeLabel="처음 화면으로" full />;
}

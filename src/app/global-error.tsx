"use client";

import { useEffect } from "react";
import { isChunkError, recordError } from "@/lib/error-log";

/**
 * 맨 바깥 틀(root layout)까지 깨졌을 때 — 전역 스타일이 없으므로 글자 모양을 직접 적는다.
 * 여기까지 오는 일은 드물다. 할 수 있는 것은 새로고침과 처음 화면뿐이다.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { recordError("render", error, error.digest); }, [error]);
  const chunk = isChunkError(error);
  const btn = { display: "inline-block", padding: "12px 18px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", cursor: "pointer", border: "1px solid #d9dce1" } as const;
  return (
    <html lang="ko">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f5f2", color: "#171b20", fontFamily: "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", padding: 16 }}>
        <title>KPJK AX — 잠시 문제가 생겼습니다</title>
        <div role="alert" style={{ maxWidth: 520, background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 20px 50px -30px rgba(0,0,0,.4)" }}>
          <h1 style={{ fontSize: 21, margin: 0 }}>{chunk ? "새 버전이 올라왔습니다" : "화면을 여는 중에 문제가 생겼습니다"}</h1>
          <p style={{ color: "#555b63", lineHeight: 1.6, fontSize: 15 }}>
            {chunk ? "새로고침하면 최신 화면으로 열립니다." : "저장된 데이터는 그대로입니다. 새로고침하거나 처음 화면으로 돌아가 주세요."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button type="button" onClick={() => (chunk ? location.reload() : retry())} style={{ ...btn, background: "#b75b2a", color: "#fff", border: "none" }}>{chunk ? "새로고침" : "다시 시도"}</button>
            {/* 바깥 틀(root layout)이 깨진 상태라 화면 전환(Link) 대신 문서를 새로 연다 */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...btn, color: "#171b20", background: "#fff" }}>처음 화면으로</a>
          </div>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, color: "#8a9099" }}>오류 번호 {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}

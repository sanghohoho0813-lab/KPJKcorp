"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { normalizeTheme } from "@/lib/themes";
import { serverConfigured, supa } from "@/lib/server/client";

/** 바뀌면 곧바로 다시 읽을 표 — setup.sql 의 실시간 목록과 같다 */
const LIVE_TABLES = ["notifications", "document_requests", "document_files", "inquiries", "inquiry_messages", "opportunities", "quotes", "schedules", "projects", "tasks", "companies", "notices"];
import { pendingWrites, setSyncErrorHandler, setUnsavedHandler } from "@/lib/server/sync";
import type { FontScale } from "@/lib/types";

/** 이전 버전에서 저장된 값("small"/"base"/"large")은 최소 단계로 본다. */
const FONT_STEPS: FontScale[] = ["s", "m", "l", "xl"];
function normalizeFont(v: string): FontScale {
  return (FONT_STEPS as string[]).includes(v) ? (v as FontScale) : "s";
}

/** Rehydrates the persisted store after mount (SSR-safe) and applies theme / font / motion settings to <html>. */
export function ThemeBoot() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);

  // 서버 저장 실패는 조용히 지나가면 안 된다. 화면은 이미 바뀌어 있어서
  // 알려주지 않으면 저장된 줄 알고 넘어간다.
  useEffect(() => {
    setSyncErrorHandler((msg) => {
      useStore.setState({ syncError: msg });
      useStore.getState().toast(msg, "error");
    });
    setUnsavedHandler((n) => useStore.setState({ unsaved: n }));
  }, []);

  // 새로고침해도 로그인이 유지되게 한다. 이 브라우저에 남은 지난 화면을 그대로 믿지 않고
  // 앱을 열 때마다 서버에서 새로 읽는다 — 다른 기기에서 바뀐 것이 보여야 한다.
  // 로그인이 풀렸으면 남은 화면을 비운다.
  const resume = useStore((s) => s.resumeServerSession);
  useEffect(() => {
    if (!hydrated) return;
    if (!serverConfigured() && !useStore.getState().serverMode) return;
    void resume();
  }, [hydrated, resume]);

  // 로그인한 동안에는 서버의 최신 내용을 주기적으로 다시 읽는다 — 고객이 폰에서 올린 자료가
  // PC 화면에 새로고침 없이 나타나야 한다. 창을 다시 볼 때도 바로 읽는다. 화면이 숨겨져 있으면 쉰다.
  const serverMode = useStore((s) => s.serverMode);
  const refresh = useStore((s) => s.refreshFromServer);
  useEffect(() => {
    if (!hydrated || !serverMode) return;
    let busy = false;
    let again = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (document.visibilityState !== "visible") return;
      if (busy) { again = true; return; }   // 읽는 중에 또 신호가 오면 끝나고 한 번 더
      busy = true;
      try {
        const ok = await refresh();
        // 내 변경을 보내는 중이라 건너뛰었으면 잠시 뒤 다시
        if (!ok && pendingWrites() > 0) { clearTimeout(retry); retry = setTimeout(() => void run(), 1200); }
      } finally {
        busy = false;
        if (again) { again = false; void run(); }
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    const t = setInterval(run, 15000);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    // 실시간: 서버에서 줄이 바뀌었다는 신호가 오면 곧바로 다시 읽는다(1~2초). 받을 수 있는 줄은 권한(RLS)이 정한다.
    // 신호가 안 와도(실시간 꺼짐·끊김) 위의 15초 주기가 그대로 돈다.
    let poke: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(poke); poke = setTimeout(() => void run(), 700); };
    const sb = supa();
    const ch = sb?.channel("kpjk-live");
    if (sb && ch) {
      for (const table of LIVE_TABLES) ch.on("postgres_changes", { event: "*", schema: "public", table }, soon);
      ch.subscribe();
    }
    return () => {
      clearInterval(t); clearTimeout(poke); clearTimeout(retry);
      window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible);
      if (sb && ch) void sb.removeChannel(ch);
    };
  }, [hydrated, serverMode, refresh]);

  // 없어진 테마·옛 글자크기 값이 저장돼 있으면 한 번 정리한다.
  useEffect(() => {
    if (!hydrated) return;
    const theme = normalizeTheme(settings.theme);
    const fontScale = normalizeFont(settings.fontScale);
    if (theme !== settings.theme || fontScale !== settings.fontScale) setSettings({ theme, fontScale });
  }, [hydrated, settings.theme, settings.fontScale, setSettings]);

  // 시간 규칙 — 앱을 열 때 한 번, 그 뒤 10분마다. 만든 것이 있으면 조용히 알린다.
  const syncRules = useStore((s) => s.syncRuleTasks);
  const session = useStore((s) => s.session);
  useEffect(() => {
    if (!hydrated || !session || session.role === "client") return;
    // 서버를 함께 쓰는 중에는 대표 화면에서만 돌린다 — 여러 명이 동시에 같은 업무를
    // 만들려 드는 것을 줄인다(중복 자체는 DB 의 rule_key 유일 제약이 막는다).
    if (useStore.getState().serverMode && session.role !== "admin") return;
    const run = () => {
      const n = syncRules();
      if (n > 0) useStore.getState().toast(`규칙에 따라 후속 업무 ${n}건이 자동 등록되었습니다.`, "info");
    };
    const t0 = setTimeout(run, 1500);
    const t = setInterval(run, 10 * 60 * 1000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [hydrated, session, syncRules]);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", normalizeTheme(settings.theme));
    el.setAttribute("data-font", normalizeFont(settings.fontScale));
    if (settings.reduceMotion) el.setAttribute("data-motion", "reduce");
    else el.removeAttribute("data-motion");
  }, [settings.theme, settings.fontScale, settings.reduceMotion]);
  return null;
}

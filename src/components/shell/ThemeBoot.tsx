"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { normalizeTheme } from "@/lib/themes";
import { serverConfigured } from "@/lib/server/client";
import { setSyncErrorHandler } from "@/lib/server/sync";
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
  }, []);

  // 새로고침해도 로그인이 유지되게 한다. 서버가 설정돼 있을 때만 시도한다.
  const resume = useStore((s) => s.resumeServerSession);
  const serverMode = useStore((s) => s.serverMode);
  useEffect(() => {
    if (!hydrated || serverMode || !serverConfigured()) return;
    void resume();
  }, [hydrated, serverMode, resume]);

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

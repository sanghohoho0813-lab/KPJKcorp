"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { normalizeTheme } from "@/lib/themes";
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

  // 없어진 테마·옛 글자크기 값이 저장돼 있으면 한 번 정리한다.
  useEffect(() => {
    if (!hydrated) return;
    const theme = normalizeTheme(settings.theme);
    const fontScale = normalizeFont(settings.fontScale);
    if (theme !== settings.theme || fontScale !== settings.fontScale) setSettings({ theme, fontScale });
  }, [hydrated, settings.theme, settings.fontScale, setSettings]);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", normalizeTheme(settings.theme));
    el.setAttribute("data-font", normalizeFont(settings.fontScale));
    if (settings.reduceMotion) el.setAttribute("data-motion", "reduce");
    else el.removeAttribute("data-motion");
  }, [settings.theme, settings.fontScale, settings.reduceMotion]);
  return null;
}

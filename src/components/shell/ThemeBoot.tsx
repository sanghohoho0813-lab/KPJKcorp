"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** Rehydrates the persisted store after mount (SSR-safe) and applies theme / font / motion settings to <html>. */
export function ThemeBoot() {
  const settings = useStore((s) => s.settings);
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", settings.theme);
    el.setAttribute("data-font", settings.fontScale);
    if (settings.reduceMotion) el.setAttribute("data-motion", "reduce");
    else el.removeAttribute("data-motion");
  }, [settings.theme, settings.fontScale, settings.reduceMotion]);
  return null;
}

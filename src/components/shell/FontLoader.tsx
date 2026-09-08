"use client";

import { useEffect } from "react";

const HREF = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

/**
 * Loads the Pretendard webfont AFTER first paint so a slow/blocked CDN can never
 * block rendering. The system font stack in globals.css renders until it arrives.
 */
export function FontLoader() {
  useEffect(() => {
    if (document.querySelector(`link[href="${HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }, []);
  return null;
}

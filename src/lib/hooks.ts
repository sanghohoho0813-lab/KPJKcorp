"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/** Ticking clock. Returns null on the server / before hydration, then a Date updated every `intervalMs`. */
export function useNow(intervalMs = 1000): Date | null {
  const subscribe = useCallback(
    (cb: () => void) => {
      const t = setInterval(cb, intervalMs);
      return () => clearInterval(t);
    },
    [intervalMs],
  );
  const tick = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs),
    () => null,
  );
  return tick === null ? null : new Date(tick * intervalMs);
}

export function useIsMobile(breakpoint = 1024) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

const noopSubscribe = () => () => {};

/** True when this document is rendered inside the Device Preview iframe. */
export function useIsPreviewFrame() {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.self !== window.top || new URLSearchParams(window.location.search).has("preview");
      } catch {
        return true;
      }
    },
    () => false,
  );
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    document.body.classList.add("scroll-lock");
    return () => document.body.classList.remove("scroll-lock");
  }, [locked]);
}

export function useEscape(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handler, active]);
}

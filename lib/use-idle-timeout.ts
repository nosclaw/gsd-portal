"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseIdleTimeoutOptions {
  warningMs?: number;
  timeoutMs?: number;
  onWarning: () => void;
  onTimeout: () => void;
}

export function useIdleTimeout({
  warningMs = 15 * 60 * 1000,
  timeoutMs = 16 * 60 * 1000,
  onWarning,
  onTimeout
}: UseIdleTimeoutOptions) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);

  const resetTimer = useCallback(() => {
    warned.current = false;
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);

    warningTimer.current = setTimeout(() => {
      warned.current = true;
      onWarning();
    }, warningMs);

    timeoutTimer.current = setTimeout(() => {
      onTimeout();
    }, timeoutMs);
  }, [warningMs, timeoutMs, onWarning, onTimeout]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "touchstart", "scroll"] as const;

    const handler = () => {
      if (!warned.current) {
        resetTimer();
      }
    };

    events.forEach((event) => window.addEventListener(event, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handler));
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    };
  }, [resetTimer]);

  return { resetTimer };
}

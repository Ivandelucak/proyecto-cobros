"use client";

import { useEffect, useRef } from "react";

type BarcodeScannerOptions = {
  enabled?: boolean;
  minLength?: number;
  maxDelayMs?: number;
  resetDelayMs?: number;
  preventDefaultOnScan?: boolean;
  onScan: (code: string) => void;
};

export function useBarcodeScanner({
  enabled = true,
  minLength = 6,
  maxDelayMs = 80,
  resetDelayMs = 180,
  preventDefaultOnScan = false,
  onScan
}: BarcodeScannerOptions) {
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function resetBuffer() {
      bufferRef.current = "";
      lastKeyAtRef.current = 0;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleReset() {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(resetBuffer, resetDelayMs);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }

      if (event.key === "Enter") {
        const code = bufferRef.current.trim();
        if (code.length >= minLength) {
          if (preventDefaultOnScan) {
            event.preventDefault();
            event.stopPropagation();
          }
          onScanRef.current(code);
        }
        resetBuffer();
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyAtRef.current;
      if (lastKeyAtRef.current > 0 && elapsed > maxDelayMs) {
        bufferRef.current = "";
      }

      bufferRef.current += event.key;
      lastKeyAtRef.current = now;
      scheduleReset();
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      resetBuffer();
    };
  }, [enabled, maxDelayMs, minLength, preventDefaultOnScan, resetDelayMs]);
}

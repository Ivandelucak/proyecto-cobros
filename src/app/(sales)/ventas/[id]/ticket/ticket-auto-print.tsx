"use client";

import { useEffect, useRef } from "react";

export function TicketAutoPrint({ enabled }: { enabled: boolean }) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (!enabled || printedRef.current) {
      return;
    }

    printedRef.current = true;

    function handleAfterPrint() {
      if (window.opener) {
        window.setTimeout(() => window.close(), 150);
      }
    }

    window.addEventListener("afterprint", handleAfterPrint);

    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => window.print());
    }, 300);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [enabled]);

  return null;
}

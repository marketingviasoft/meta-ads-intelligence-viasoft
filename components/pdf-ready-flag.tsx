"use client";

import { useEffect } from "react";

export function PdfReadyFlag(): null {
  useEffect(() => {
    document.body.setAttribute("data-pdf-ready", "false");
    const maxWaitAt = Date.now() + 7000;
    let rafId = 0;

    const checkReady = (): void => {
      const chartSurface = document.querySelector(".recharts-surface");
      const timedOut = Date.now() >= maxWaitAt;

      if (chartSurface || timedOut) {
        document.body.setAttribute("data-pdf-ready", "true");
        return;
      }

      rafId = window.requestAnimationFrame(checkReady);
    };

    rafId = window.requestAnimationFrame(checkReady);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}

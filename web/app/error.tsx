"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorFallback } from "@/components/ErrorBoundary";

const STALE_DEPLOY_KEY = "lc:stale-reload";
const STALE_DEPLOY_WINDOW_MS = 10_000;

function looksLikeStaleDeployment(error: Error & { digest?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  const digest = error.digest?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("chunkloaderror") ||
    msg.includes("loading chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("next_not_found") ||
    digest.includes("next_not_found")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (looksLikeStaleDeployment(error)) {
      const lastReload = sessionStorage.getItem(STALE_DEPLOY_KEY);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > STALE_DEPLOY_WINDOW_MS) {
        console.warn("[auto-recovery] Stale deployment detected, reloading:", error.message);
        sessionStorage.setItem(STALE_DEPLOY_KEY, String(now));
        window.location.reload();
        return;
      }
    }

    Sentry.captureException(error);
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
      <ErrorFallback
        error={error}
        onRetry={reset}
        title="Something broke"
        description="Probably our fault. This stuff is hard, ok?"
      />
    </div>
  );
}

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorFallback } from "@/components/ErrorBoundary";

const STALE_DEPLOY_KEY = "lc:stale-reload";
const STALE_DEPLOY_WINDOW_MS = 10_000; // only auto-reload once per 10s

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

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-recover from stale deployment errors (once per window)
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
    console.error("Portal page error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <ErrorFallback
        error={error}
        onRetry={reset}
        title="Portal page error"
        description="Unable to load this portal. Please try again."
      />
    </div>
  );
}

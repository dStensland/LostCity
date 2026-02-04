"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/ErrorBoundary";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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

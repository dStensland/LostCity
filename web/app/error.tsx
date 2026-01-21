"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/ErrorBoundary";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
      <ErrorFallback
        error={error}
        onRetry={reset}
        title="Something went wrong"
        description="We encountered an unexpected error. Please try again or refresh the page."
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/ErrorBoundary";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <ErrorFallback
        error={error}
        onRetry={reset}
        title="Dashboard error"
        description="Unable to load your dashboard. Please try again."
      />
    </div>
  );
}

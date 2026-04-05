"use client";

import { useEffect, useState, type ComponentType } from "react";
import ErrorBoundary, { ErrorFallback } from "@/components/ErrorBoundary";
import type {
  ExploreLaneComponentProps,
  ExploreLaneDefinition,
} from "@/lib/explore-platform/types";

function ExploreLaneSkeleton() {
  return (
    <div className="space-y-4 py-6 px-2 animate-pulse">
      <div className="h-10 bg-[var(--twilight)]/30 rounded-xl" />
      <div className="h-10 bg-[var(--twilight)]/20 rounded-xl" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--twilight)]/15 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ExploreLaneHost({
  lane,
  portalId,
  portalSlug,
  portalExclusive,
  initialData,
}: {
  lane: ExploreLaneDefinition;
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  initialData?: unknown | null;
}) {
  const [retryKey, setRetryKey] = useState(0);
  const loadKey = `${lane.id}:${retryKey}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    component: ComponentType<ExploreLaneComponentProps>;
  } | null>(null);
  const [loadError, setLoadError] = useState<{
    key: string;
    error: Error;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    lane
      .loadComponent()
      .then((component) => {
        if (!cancelled) {
          setLoadError(null);
          setLoaded({ key: loadKey, component });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError({
            key: loadKey,
            error:
              error instanceof Error ? error : new Error("Failed to load lane"),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lane, loadKey]);

  useEffect(() => {
    if (!loaded || loaded.key !== loadKey || typeof window === "undefined") return;
    performance.mark(`explore-lane-first-content:${lane.id}`);
    try {
      performance.measure(
        `explore-lane-duration:${lane.id}`,
        `explore-lane-nav-start:${lane.id}`,
        `explore-lane-first-content:${lane.id}`,
      );
    } catch {
      // Ignore measure errors when the start mark does not exist.
    }
  }, [lane.id, loadKey, loaded]);

  const activeError = loadError?.key === loadKey ? loadError.error : null;
  const Component = loaded?.key === loadKey ? loaded.component : null;

  if (activeError) {
    return (
      <ErrorFallback
        error={activeError}
        title={`Could not load ${lane.label}`}
        description="This discovery mode failed to initialize. Retry or switch to another lane."
        onRetry={() => setRetryKey((value) => value + 1)}
      />
    );
  }

  if (!Component) {
    return <ExploreLaneSkeleton />;
  }

  return (
    <ErrorBoundary
      fallback={
        <ErrorFallback
          error={null}
          title={`Something broke in ${lane.label}`}
          description="This lane hit a runtime error. Retry or head back to Explore Home."
          onRetry={() => setRetryKey((value) => value + 1)}
        />
      }
    >
      <Component
        key={loadKey}
        portalId={portalId}
        portalSlug={portalSlug}
        portalExclusive={portalExclusive}
        initialData={initialData}
      />
    </ErrorBoundary>
  );
}

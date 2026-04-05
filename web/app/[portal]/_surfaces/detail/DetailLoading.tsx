import type { ReactNode } from "react";

export type DetailType = "event" | "venue" | "series" | "festival" | "org" | null;

export function resolveDetailType(searchParams: {
  event?: string;
  spot?: string;
  series?: string;
  festival?: string;
  org?: string;
}): DetailType {
  if (searchParams.event) return "event";
  if (searchParams.spot) return "venue";
  if (searchParams.series) return "series";
  if (searchParams.festival) return "festival";
  if (searchParams.org) return "org";
  return null;
}

export function DetailPanelSkeleton({
  type,
  feedFallback,
}: {
  type: DetailType;
  feedFallback: ReactNode;
}) {
  if (!type) return <>{feedFallback}</>;

  return (
    <div className="pt-6 pb-8" role="status" aria-label="Loading details">
      <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl skeleton-shimmer" />

      <div className="mb-6 rounded-xl border border-[var(--twilight)] bg-[var(--night)]">
        <div className="flex items-center justify-between border-b border-[var(--twilight)] px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="h-5 w-14 rounded skeleton-shimmer" />
            <div
              className="h-4 w-20 rounded skeleton-shimmer"
              style={{ animationDelay: "50ms" }}
            />
            <div
              className="h-4 w-16 rounded skeleton-shimmer"
              style={{ animationDelay: "80ms" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 p-3">
          <div
            className="h-12 flex-1 rounded-lg skeleton-shimmer"
            style={{ animationDelay: "100ms" }}
          />
          <div
            className="h-12 w-12 rounded-lg skeleton-shimmer"
            style={{ animationDelay: "120ms" }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-6">
        <div
          className="mb-3 h-3 w-16 rounded skeleton-shimmer"
          style={{ animationDelay: "140ms" }}
        />
        <div className="mb-5 space-y-2">
          <div
            className="h-4 w-full rounded skeleton-shimmer"
            style={{ animationDelay: "160ms" }}
          />
          <div
            className="h-4 w-[90%] rounded skeleton-shimmer"
            style={{ animationDelay: "180ms" }}
          />
          <div
            className="h-4 w-[75%] rounded skeleton-shimmer"
            style={{ animationDelay: "200ms" }}
          />
        </div>
        <div className="border-t border-[var(--twilight)] pt-5">
          <div
            className="mb-3 h-3 w-16 rounded skeleton-shimmer"
            style={{ animationDelay: "220ms" }}
          />
          <div className="rounded-lg border border-[var(--twilight)] bg-[var(--void)] p-3">
            <div
              className="mb-2 h-5 w-[50%] rounded skeleton-shimmer"
              style={{ animationDelay: "240ms" }}
            />
            <div
              className="h-3 w-[70%] rounded skeleton-shimmer"
              style={{ animationDelay: "260ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

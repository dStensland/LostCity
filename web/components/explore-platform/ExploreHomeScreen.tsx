"use client";

import { useMemo } from "react";
import Link from "next/link";
import FindSearchInput from "@/components/find/FindSearchInput";
import { getEnabledExploreLanes } from "@/lib/explore-platform/registry";
import { usePortal } from "@/lib/portal-context";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import type { ExploreHomePayload } from "@/lib/explore-platform/types";

interface ExploreHomeScreenProps {
  portalSlug: string;
  portalId: string;
  data: ExploreHomePayload | null;
  loading: boolean;
  onRetry?: () => void;
}

function formatPortalLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function ExploreHomeScreen({
  portalSlug,
  portalId,
  data,
  loading,
  onRetry,
}: ExploreHomeScreenProps) {
  const state = useExploreUrlState();
  const { portal } = usePortal();
  const shouldFocusSearch = state.params.get("focus") === "search";
  const enabledLanes = useMemo(() => getEnabledExploreLanes(portal), [portal]);

  const laneEntries = useMemo(
    () =>
      enabledLanes.map((lane) => ({
        lane,
        summary: data?.lanes?.[lane.id] ?? null,
      })),
    [data?.lanes, enabledLanes],
  );

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto px-4 py-5 sm:py-6 min-h-[calc(100vh-5rem)]">
      <div className="rounded-[24px] border border-[var(--twilight)]/30 bg-[linear-gradient(140deg,rgba(10,14,24,0.96),rgba(14,19,30,0.82))] p-5">
        <p className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
          Explore {formatPortalLabel(portalSlug)}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-[var(--cream)]">
          Search events, places, and classes.
        </h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base text-[var(--soft)]">
          Start with search, or jump straight into a lane.
        </p>

        <div className="mt-5">
          <FindSearchInput
            portalSlug={portalSlug}
            portalId={portalId}
            basePath={`/${portalSlug}/explore`}
            placeholder="Search events, places, classes, teams..."
            autoFocus={shouldFocusSearch}
            queryParam="q"
            onSubmitQuery={(query) => state.setSearchQuery(query)}
          />
        </div>
      </div>

      {data?.quickIntents && data.quickIntents.length > 0 && (
        <section>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Quick Intents
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.quickIntents.map((intent) => (
              <Link
                key={intent.id}
                href={intent.href}
                className="rounded-full border border-[var(--twilight)]/35 bg-[var(--night)]/45 px-3 py-1.5 text-sm text-[var(--soft)] hover:border-[var(--twilight)]/75 hover:text-[var(--cream)] transition-colors"
              >
                {intent.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && !data && (
        <div className="rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/40 p-4">
          <p className="text-sm text-[var(--soft)]">
            Explore summaries are temporarily unavailable.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Search still works, and every dedicated lane is still available.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-xs font-mono text-[var(--coral)] hover:opacity-80 transition-opacity"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Browse
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--cream)]">
              Pick a lane
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${portalSlug}/explore?lane=events&display=map`}
              className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
            >
              Event map
            </Link>
            <Link
              href={`/${portalSlug}/explore?lane=events&display=calendar`}
              className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
            >
              Calendar
            </Link>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {laneEntries.map(({ lane, summary }) => {
            const Icon = lane.icon;
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => state.setLane(lane.id)}
                className="text-left rounded-[22px] border p-4 transition-colors hover:border-[var(--twilight)]/80"
                style={{
                  background: `linear-gradient(145deg, color-mix(in srgb, ${lane.accentToken} 10%, transparent), rgba(10,14,24,0.82))`,
                  borderColor: summary ? "rgba(97, 111, 151, 0.28)" : "rgba(97, 111, 151, 0.18)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-2xs uppercase tracking-[0.14em]" style={{ color: lane.accentToken }}>
                      {lane.label}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--cream)]">
                      {lane.label}
                    </h3>
                  </div>
                  <div
                    className="h-10 w-10 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${lane.accentToken} 18%, transparent)` }}
                  >
                    <Icon size={20} weight="duotone" color={lane.accentToken} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--soft)]">{lane.description}</p>
                {summary && summary.count > 0 && (
                  <p className="mt-3 text-xs font-mono text-[var(--muted)]">
                    {summary.copy}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildSearchResultHref } from "@/lib/search-navigation";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import type { ExploreSearchResponse } from "@/lib/explore-platform/types";
import type { SearchResult } from "@/lib/unified-search";
import { TEAMS } from "@/lib/teams-config";

function SearchResultsSkeleton() {
  return (
    <div className="space-y-3 py-4 animate-pulse">
      <div className="h-5 w-48 rounded bg-[var(--twilight)]/30" />
      <div className="grid gap-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--twilight)]/20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--twilight)]/15" />
        ))}
      </div>
    </div>
  );
}

function getResultTypeLabel(result: SearchResult): string {
  switch (result.type) {
    case "event":
      return "Event";
    case "venue":
      return "Place";
    case "program":
      return "Program";
    case "festival":
      return "Festival";
    case "series":
      return "Series";
    default:
      return result.type;
  }
}

function resultSubtitle(result: SearchResult): string {
  const metadata = result.metadata ?? {};
  return (
    result.subtitle ||
    [
      metadata.neighborhood,
      metadata.date,
      metadata.time,
      metadata.category,
      metadata.venueType,
      metadata.registrationStatus,
    ]
      .filter(Boolean)
      .join(" · ")
  );
}

function getLaneLabel(lane: string): string {
  switch (lane) {
    case "game-day":
      return "Game Day";
    default:
      return lane.charAt(0).toUpperCase() + lane.slice(1);
  }
}

function findMatchingTeamSlug(query: string): string | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  for (const team of TEAMS) {
    const candidateValues = [
      team.slug,
      team.name,
      team.shortName,
      ...team.tags,
    ].map((value) => value.toLowerCase());

    if (candidateValues.some((value) => normalizedQuery.includes(value))) {
      return team.slug;
    }
  }

  return null;
}

function buildLaneSuggestionHref(
  portalSlug: string,
  lane: ExploreSearchResponse["laneSuggestions"][number]["lane"],
  query: string,
): string {
  const encodedQuery = encodeURIComponent(query);

  switch (lane) {
    case "events":
      return `/${portalSlug}/explore?lane=events&search=${encodedQuery}`;
    case "places":
      return `/${portalSlug}/explore?lane=places&search=${encodedQuery}`;
    case "classes":
      return `/${portalSlug}/explore?lane=classes&q=${encodedQuery}`;
    case "game-day": {
      const teamSlug = findMatchingTeamSlug(query);
      return teamSlug
        ? `/${portalSlug}/explore?lane=game-day&team=${encodeURIComponent(teamSlug)}`
        : `/${portalSlug}/explore?lane=game-day&q=${encodedQuery}`;
    }
    default:
      return `/${portalSlug}/explore?lane=${lane}&q=${encodedQuery}`;
  }
}

export function ExploreSearchResults({ portalSlug }: { portalSlug: string }) {
  const { q } = useExploreUrlState();
  const [state, setState] = useState<{
    query: string;
    data: ExploreSearchResponse | null;
    error: string | null;
  }>({
    query: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!q.trim()) {
      return;
    }

    const controller = new AbortController();

    fetch(
      `/api/portals/${portalSlug}/explore/search?q=${encodeURIComponent(q)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as ExploreSearchResponse;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setState({
            query: q,
            data: payload,
            error: null,
          });
        }
      })
      .catch((fetchError) => {
        if (!controller.signal.aborted) {
          setState({
            query: q,
            data: null,
            error:
              fetchError instanceof Error
                ? fetchError.message
                : "Failed to load search results",
          });
        }
      });

    return () => controller.abort();
  }, [portalSlug, q]);

  if (!q.trim()) return null;

  const loading = state.query !== q;
  const data = state.query === q ? state.data : null;
  const error = state.query === q ? state.error : null;

  const entityPivots = !data
    ? []
    : ([
        data.entityCounts.event
          ? {
              label: `${data.entityCounts.event} events`,
              href: `/${portalSlug}/explore?lane=events&search=${encodeURIComponent(q)}`,
            }
          : null,
        data.entityCounts.venue
          ? {
              label: `${data.entityCounts.venue} places`,
              href: `/${portalSlug}/explore?lane=places&search=${encodeURIComponent(q)}`,
            }
          : null,
        data.entityCounts.program
          ? {
              label: `${data.entityCounts.program} classes`,
              href: `/${portalSlug}/explore?lane=classes&q=${encodeURIComponent(q)}`,
            }
          : null,
      ].filter(Boolean) as { label: string; href: string }[]);
  const laneSuggestions = !data
    ? []
    : data.laneSuggestions.map((suggestion) => ({
        ...suggestion,
        href: buildLaneSuggestionHref(portalSlug, suggestion.lane, q),
      }));
  const hasGuidance =
    entityPivots.length > 0 ||
    laneSuggestions.length > 0 ||
    (data?.quickActions.length ?? 0) > 0;

  if (loading) return <SearchResultsSkeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/50 p-5">
        <p className="text-sm text-[var(--soft)]">
          Search failed for &ldquo;{q}&rdquo;.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Refine the query or switch into a dedicated lane.
        </p>
      </div>
    );
  }

  if (!data || data.results.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/50 p-5">
          <p className="text-sm text-[var(--soft)]">
            No unified results for &ldquo;{q}&rdquo;.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/${portalSlug}/explore?lane=events&search=${encodeURIComponent(q)}`}
              className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
            >
              Search events
            </Link>
            <Link
              href={`/${portalSlug}/explore?lane=places&search=${encodeURIComponent(q)}`}
              className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
            >
              Search places
            </Link>
          </div>
        </div>

        {hasGuidance && data && (
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/45 p-4">
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Pivots
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entityPivots.map((pivot) => (
                  <Link
                    key={pivot.href}
                    href={pivot.href}
                    className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
                  >
                    {pivot.label}
                  </Link>
                ))}
                {data.quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>

            {laneSuggestions.length > 0 && (
              <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/45 p-4">
                <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  Suggested Lanes
                </p>
                <div className="mt-3 space-y-2">
                  {laneSuggestions.map((suggestion) => (
                    <Link
                      key={`${suggestion.lane}:${suggestion.reason}`}
                      href={suggestion.href}
                      className="block rounded-xl border border-[var(--twilight)]/40 px-3 py-2 hover:border-[var(--twilight)]/80 transition-colors"
                    >
                      <div className="text-sm font-medium text-[var(--cream)]">
                        {getLaneLabel(suggestion.lane)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{suggestion.reason}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Unified Search
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--cream)]">
          {data.total} result{data.total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
        </h2>
        {data.didYouMean && data.didYouMean.length > 0 && (
          <p className="mt-2 text-sm text-[var(--soft)]">
            Did you mean {data.didYouMean.slice(0, 2).join(" or ")}?
          </p>
        )}
      </div>

      {hasGuidance && (
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/45 p-4">
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Pivots
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entityPivots.map((pivot) => (
                <Link
                  key={pivot.href}
                  href={pivot.href}
                  className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
                >
                  {pivot.label}
                </Link>
              ))}
              {data.quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          {laneSuggestions.length > 0 && (
            <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/45 p-4">
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Suggested Lanes
              </p>
              <div className="mt-3 space-y-2">
                {laneSuggestions.map((suggestion) => (
                  <Link
                    key={`${suggestion.lane}:${suggestion.reason}`}
                    href={suggestion.href}
                    className="block rounded-xl border border-[var(--twilight)]/40 px-3 py-2 hover:border-[var(--twilight)]/80 transition-colors"
                  >
                    <div className="text-sm font-medium text-[var(--cream)]">
                      {getLaneLabel(suggestion.lane)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{suggestion.reason}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {data.results.map((result) => (
          <Link
            key={`${result.type}:${String(result.id)}`}
            href={buildSearchResultHref(result, { portalSlug })}
            className="block rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 px-4 py-3 hover:border-[var(--twilight)]/70 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-[var(--twilight)]/30 text-2xs font-mono uppercase tracking-[0.12em] text-[var(--muted)]">
                    {getResultTypeLabel(result)}
                  </span>
                  {result.metadata?.isFree && (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-[var(--neon-green)]/12 text-2xs font-mono uppercase tracking-[0.12em] text-[var(--neon-green)]">
                      Free
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-base font-medium text-[var(--cream)] truncate">
                  {result.title}
                </h3>
                {resultSubtitle(result) && (
                  <p className="mt-1 text-sm text-[var(--soft)] line-clamp-2">
                    {resultSubtitle(result)}
                  </p>
                )}
              </div>
              <div className="text-xs font-mono text-[var(--muted)]">
                {Math.round(result.score)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

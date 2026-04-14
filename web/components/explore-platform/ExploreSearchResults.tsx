"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildSearchResultHref } from "@/lib/search-navigation";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import type { SearchResult } from "@/lib/unified-search";

// ─── Synthetic fallback detection ────────────────────────────────────────────
// The instant-search API injects placeholder rows with IDs like
// "search:query:event:<query>" when there are no real matches, so the dropdown
// always has something clickable. They must not be treated as real results in
// the body view — they inflate counts and render as junk rows.
function isSyntheticFallback(result: SearchResult): boolean {
  return (
    typeof result.id === "string" &&
    (result.id as string).startsWith("search:query:")
  );
}

function filterRealResults(results: SearchResult[]): SearchResult[] {
  return results.filter((r) => !isSyntheticFallback(r));
}

// ─── Response shape (mirrors /api/search/instant) ────────────────────────────

interface InstantSearchQuickAction {
  id: string;
  label: string;
  description?: string;
  url: string;
}

interface InstantSearchResponse {
  suggestions: SearchResult[];
  topResults: SearchResult[];
  quickActions: InstantSearchQuickAction[];
  groupedResults: Record<string, SearchResult[]>;
  groupOrder: string[];
  facets: { type: string; count: number }[];
  intent?: { type: string; confidence: number; dateFilter?: string };
}

// ─── Lane-suggestion heuristics (ported from the server-side version) ────────

const SPORTS_PATTERN =
  /\b(falcons|hawks|braves|atlanta united|dream|bulldogs|yellow jackets|game|match|playoffs|sports?)\b/i;
const SHOWS_PATTERN =
  /\b(movie|film|screening|concert|music|comedy|theater|theatre|show|gig|dj)\b/i;
const REGULARS_PATTERN =
  /\b(trivia|karaoke|open mic|run club|weekly|recurring|bingo|happy hour)\b/i;
const PLACES_PATTERN =
  /\b(brunch|cocktails|coffee|restaurant|bar|park|museum|patio|rooftop|brewery)\b/i;
const CLASSES_PATTERN =
  /\b(class|classes|lesson|lessons|workshop|camp|course|training|studio|pottery|dance|swim|yoga)\b/i;

interface LaneSuggestion {
  lane: string;
  label: string;
  reason: string;
  href: string;
}

function getLaneLabel(lane: string): string {
  switch (lane) {
    case "game-day":
      return "Game Day";
    default:
      return lane.charAt(0).toUpperCase() + lane.slice(1);
  }
}

function buildLaneHref(portalSlug: string, lane: string, query: string): string {
  const encoded = encodeURIComponent(query);
  switch (lane) {
    case "events":
      return `/${portalSlug}/explore?lane=events&search=${encoded}`;
    case "places":
      return `/${portalSlug}/explore?lane=places&search=${encoded}`;
    case "classes":
      return `/${portalSlug}/explore?lane=classes&q=${encoded}`;
    case "shows":
      return `/${portalSlug}/explore?lane=shows&q=${encoded}`;
    case "game-day":
      return `/${portalSlug}/explore?lane=game-day&q=${encoded}`;
    case "regulars":
      return `/${portalSlug}/explore?lane=regulars&search=${encoded}`;
    default:
      return `/${portalSlug}/explore?lane=${lane}&q=${encoded}`;
  }
}

function buildLaneSuggestionsFromGrouped(
  portalSlug: string,
  query: string,
  grouped: Record<string, SearchResult[]>,
): LaneSuggestion[] {
  const suggestions: LaneSuggestion[] = [];
  const seen = new Set<string>();
  const push = (lane: string, reason: string) => {
    if (seen.has(lane)) return;
    seen.add(lane);
    suggestions.push({
      lane,
      label: getLaneLabel(lane),
      reason,
      href: buildLaneHref(portalSlug, lane, query),
    });
  };

  const eventCount = (grouped.event ?? []).length;
  const venueCount = (grouped.venue ?? []).length;
  const programCount = (grouped.program ?? []).length;

  if (SPORTS_PATTERN.test(query)) {
    push("game-day", "Sports intent matches the Game Day lane.");
  }
  if (SHOWS_PATTERN.test(query)) {
    push("shows", "This query looks like film, music, comedy, or theater.");
  }
  if (REGULARS_PATTERN.test(query)) {
    push("regulars", "Recurring-ritual searches live in Regulars.");
  }
  if (PLACES_PATTERN.test(query) || venueCount > eventCount) {
    push("places", "Places and destinations look especially relevant here.");
  }
  if (CLASSES_PATTERN.test(query) || programCount > 0) {
    push("classes", "Structured classes and programs match this intent.");
  }
  if (eventCount > 0) {
    push("events", "Browse upcoming events with filters, map, or calendar.");
  }

  return suggestions.slice(0, 3);
}

// ─── Result rendering helpers ────────────────────────────────────────────────

function getTypeLabel(type: SearchResult["type"]): string {
  switch (type) {
    case "event":
      return "Events";
    case "venue":
      return "Places";
    case "organizer":
      return "Organizers";
    case "series":
      return "Series";
    case "festival":
      return "Festivals";
    case "program":
      return "Classes";
    case "list":
      return "Lists";
    case "neighborhood":
      return "Neighborhoods";
    case "category":
      return "Tags";
    case "exhibition":
      return "Exhibitions";
    default:
      return type;
  }
}

function resultSubtitle(result: SearchResult): string {
  const metadata = result.metadata ?? {};
  if (result.subtitle && result.subtitle !== getTypeLabel(result.type).slice(0, -1)) {
    return result.subtitle;
  }
  return [
    metadata.neighborhood,
    metadata.date,
    metadata.time,
    metadata.category,
    metadata.venueType,
  ]
    .filter(Boolean)
    .join(" · ");
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-3 py-4 animate-pulse">
      <div className="h-5 w-48 rounded bg-[var(--twilight)]/30" />
      <div className="grid gap-2 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--twilight)]/20" />
        ))}
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--twilight)]/15" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface ExploreSearchResultsProps {
  portalSlug: string;
}

export function ExploreSearchResults({ portalSlug }: ExploreSearchResultsProps) {
  const { q } = useExploreUrlState();
  const [state, setState] = useState<{
    query: string;
    data: InstantSearchResponse | null;
    error: string | null;
  }>({
    query: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!q.trim()) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      q,
      portalSlug,
      portal: portalSlug,
      viewMode: "find",
      limit: "12",
    });

    fetch(`/api/search/instant?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as InstantSearchResponse;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setState({ query: q, data: payload, error: null });
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

  if (!data) return null;

  const rawGrouped = data.groupedResults ?? {};
  const grouped: Record<string, SearchResult[]> = {};
  for (const [type, results] of Object.entries(rawGrouped)) {
    grouped[type] = filterRealResults(results);
  }
  const orderedTypes = (data.groupOrder ?? []).filter(
    (type) => (grouped[type] ?? []).length > 0,
  );
  // Facets come from the server's real count, but if the only reason a type
  // appears there is synthetic fallbacks, we need to suppress it.
  const facetMap = new Map(
    data.facets
      .filter((f) => (grouped[f.type] ?? []).length > 0)
      .map((f) => [f.type, f.count]),
  );

  const total = orderedTypes.reduce(
    (sum, type) => sum + (facetMap.get(type) ?? (grouped[type] ?? []).length),
    0,
  );

  // Pivots = per-entity jump links to the right dedicated lane
  const eventCount = facetMap.get("event") ?? (grouped.event ?? []).length;
  const venueCount = facetMap.get("venue") ?? (grouped.venue ?? []).length;
  const programCount = facetMap.get("program") ?? (grouped.program ?? []).length;
  const pivots: { label: string; href: string }[] = [];
  if (eventCount > 0) {
    pivots.push({
      label: `${eventCount} events`,
      href: `/${portalSlug}/explore?lane=events&search=${encodeURIComponent(q)}`,
    });
  }
  if (venueCount > 0) {
    pivots.push({
      label: `${venueCount} places`,
      href: `/${portalSlug}/explore?lane=places&search=${encodeURIComponent(q)}`,
    });
  }
  if (programCount > 0) {
    pivots.push({
      label: `${programCount} classes`,
      href: `/${portalSlug}/explore?lane=classes&q=${encodeURIComponent(q)}`,
    });
  }

  if (total === 0) {
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
      </div>
    );
  }

  const laneSuggestions = buildLaneSuggestionsFromGrouped(portalSlug, q, grouped);
  const hasGuidance =
    pivots.length > 0 ||
    laneSuggestions.length > 0 ||
    data.quickActions.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Unified Search
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--cream)]">
          {total} result{total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
        </h2>
      </div>

      {hasGuidance && (
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/45 p-4">
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Pivots
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pivots.map((pivot) => (
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
                  key={action.id}
                  href={action.url}
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
                    key={suggestion.lane}
                    href={suggestion.href}
                    className="block rounded-xl border border-[var(--twilight)]/40 px-3 py-2 hover:border-[var(--twilight)]/80 transition-colors"
                  >
                    <div className="text-sm font-medium text-[var(--cream)]">
                      {suggestion.label}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {suggestion.reason}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {orderedTypes.map((type) => {
        const results = grouped[type] ?? [];
        if (results.length === 0) return null;
        const totalForType = facetMap.get(type) ?? results.length;
        return (
          <section key={type}>
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)] mb-2">
              {getTypeLabel(type as SearchResult["type"])} · {totalForType}
            </p>
            <div className="space-y-2">
              {results.map((result) => {
                const subtitle = resultSubtitle(result);
                return (
                  <Link
                    key={`${result.type}:${String(result.id)}`}
                    href={buildSearchResultHref(result, { portalSlug })}
                    className="block rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 px-4 py-3 hover:border-[var(--twilight)]/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-[var(--twilight)]/30 text-2xs font-mono uppercase tracking-[0.12em] text-[var(--muted)]">
                            {getTypeLabel(result.type).replace(/s$/, "")}
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
                        {subtitle && (
                          <p className="mt-1 text-sm text-[var(--soft)] line-clamp-2">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

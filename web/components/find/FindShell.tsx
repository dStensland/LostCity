"use client";

import { Suspense, useEffect, useRef, useMemo, useCallback, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import AddNewChooser from "@/components/find/AddNewChooser";
import EventsFinder, { EventsFinderFilters } from "@/components/find/EventsFinder";
import { FindContext } from "@/lib/find-context";
import { getFindTypeLabel } from "@/lib/find-labels";

const ClassesView = dynamic(() => import("@/components/find/ClassesView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading classes...</div>,
});
const ShowtimesView = dynamic(() => import("@/components/find/ShowtimesView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading showtimes...</div>,
});
const SpotsFinder = dynamic(() => import("@/components/find/SpotsFinder"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading places...</div>,
});
const RegularsView = dynamic(() => import("@/components/find/RegularsView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading regulars...</div>,
});
const WhatsOnView = dynamic(() => import("@/components/find/WhatsOnView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
import {
  FIND_FILTER_RESET_KEYS,
  SHOWTIMES_EXCLUDED_FILTER_KEYS,
  type FindType,
} from "@/lib/find-filter-schema";
import {
  createFindFilterSnapshot,
  diffFindFilterKeys,
  resolveFindDetailTarget,
  trackFindDetailAfterFilter,
  trackFindFilterChange,
  type FindFilterSnapshot,
} from "@/lib/analytics/find-tracking";

type DisplayMode = "list" | "map" | "calendar";

// ─── Tab & Display Config ─────────────────────────────────────────────────────

const TYPE_OPTIONS: { key: FindType; label: string; icon: React.ReactNode }[] = [
  {
    key: "events",
    label: getFindTypeLabel("events"),
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "classes",
    label: getFindTypeLabel("classes"),
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    key: "destinations",
    label: getFindTypeLabel("destinations"),
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "whats_on",
    label: getFindTypeLabel("whats_on"),
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    key: "regulars",
    label: getFindTypeLabel("regulars"),
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
];

const DISPLAY_OPTIONS: Record<DisplayMode, { label: string; shortLabel: string; icon: React.ReactNode }> = {
  list: {
    label: "List",
    shortLabel: "List",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  calendar: {
    label: "Calendar",
    shortLabel: "Cal",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  map: {
    label: "Map",
    shortLabel: "Map",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface FindShellProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  findType: FindType;
  displayMode: DisplayMode;
  hasActiveFilters: boolean;
  vertical?: string | null;
}

// ─── Inner Component ──────────────────────────────────────────────────────────

// Tabs available per vertical — community portals only show Events
const COMMUNITY_TABS = new Set<FindType>(["events"]);
// Tabs hidden until data is populated
const HIDDEN_TABS = new Set<FindType>(["classes"]);

function FindShellInner({
  portalId,
  portalSlug,
  portalExclusive,
  findType,
  displayMode,
  hasActiveFilters,
  vertical,
}: FindShellProps) {
  const isCommunity = vertical === "community";
  const visibleTabs = isCommunity
    ? TYPE_OPTIONS.filter((t) => COMMUNITY_TABS.has(t.key))
    : TYPE_OPTIONS.filter((t) => !HIDDEN_TABS.has(t.key));
  const viewRootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const previousFilterSnapshotByTypeRef = useRef<Partial<Record<FindType, FindFilterSnapshot>>>({});
  const lastFilterChangeAtByTypeRef = useRef<Partial<Record<FindType, number>>>({});

  // ─── URL Helpers ──────────────────────────────────────────────────────────

  const resetFindFiltersForTypeChange = useCallback((params: URLSearchParams): boolean => {
    let mutated = false;
    for (const key of FIND_FILTER_RESET_KEYS) {
      if (params.has(key)) {
        params.delete(key);
        mutated = true;
      }
    }
    return mutated;
  }, []);

  const stripShowtimesExcludedParams = useCallback((params: URLSearchParams): boolean => {
    let mutated = false;
    for (const key of SHOWTIMES_EXCLUDED_FILTER_KEYS) {
      if (params.has(key)) {
        params.delete(key);
        mutated = true;
      }
    }
    return mutated;
  }, []);

  const handleTypeChange = (type: FindType) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    resetFindFiltersForTypeChange(params);
    params.set("view", "find");
    params.set("type", type);
    // Clear display mode when switching tabs so stale map/calendar state doesn't
    // carry over and auto-load an unexpected display mode (e.g. map exhausting
    // WebGL contexts when switching to destinations).
    params.delete("display");
    router.push(`/${portalSlug}?${params.toString()}`);
  };

  useEffect(() => {
    if (findType !== "showtimes" && findType !== "whats_on") return;
    const params = new URLSearchParams(searchParams?.toString() || "");
    const mutated = stripShowtimesExcludedParams(params);
    if (!mutated) return;
    router.replace(`/${portalSlug}?${params.toString()}`, { scroll: false });
  }, [findType, portalSlug, router, searchParams, stripShowtimesExcludedParams]);

  // ─── Display Mode ──────────────────────────────────────────────────────────

  const availableDisplayModes: DisplayMode[] = useMemo(() => {
    if (findType === "events") return ["list", "calendar", "map"];
    if (findType === "destinations") return ["list", "map"];
    if (findType === "regulars") return ["list"];
    return [];
  }, [findType]);

  const handleDisplayModeChange = useCallback((mode: DisplayMode) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "find");
    params.set("type", findType);
    if (mode === "list") {
      params.delete("display");
    } else {
      params.set("display", mode);
    }
    // Calendar has its own date navigation — clear date filter to avoid stale/hidden state
    if (mode === "calendar") {
      params.delete("date");
    }
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  }, [findType, portalSlug, router, searchParams]);

  // ─── Analytics ──────────────────────────────────────────────────────────────

  const activeFilterSnapshot = useMemo(
    () => createFindFilterSnapshot(searchParams, findType),
    [findType, searchParams]
  );

  useEffect(() => {
    const previousSnapshot = previousFilterSnapshotByTypeRef.current[findType];
    if (!previousSnapshot) {
      previousFilterSnapshotByTypeRef.current[findType] = activeFilterSnapshot;
      return;
    }

    if (previousSnapshot.signature === activeFilterSnapshot.signature) {
      return;
    }

    const changedKeys = diffFindFilterKeys(previousSnapshot, activeFilterSnapshot);
    previousFilterSnapshotByTypeRef.current[findType] = activeFilterSnapshot;

    if (changedKeys.length === 0) return;

    lastFilterChangeAtByTypeRef.current[findType] = Date.now();
    trackFindFilterChange({
      portalSlug,
      findType,
      displayMode,
      snapshot: activeFilterSnapshot,
      changedKeys,
    });
  }, [activeFilterSnapshot, displayMode, findType, portalSlug]);

  const handleFindClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    const detailTarget = resolveFindDetailTarget(href, portalSlug);
    if (!detailTarget) return;

    const lastChangedAt = lastFilterChangeAtByTypeRef.current[findType];
    if (!lastChangedAt) return;

    const snapshot = createFindFilterSnapshot(searchParams, findType);
    if (snapshot.activeCount === 0) return;

    trackFindDetailAfterFilter({
      portalSlug,
      findType,
      displayMode,
      snapshot,
      detailTarget,
      latencyMs: Date.now() - lastChangedAt,
    });
  }, [displayMode, findType, portalSlug, searchParams]);

  // ─── Sticky Offset ──────────────────────────────────────────────────────────

  useEffect(() => {
    const root = viewRootRef.current;
    if (!root) return;

    const resolvePortalHeader = (): HTMLElement | null => {
      const headers = Array.from(document.querySelectorAll<HTMLElement>("header"));
      const stickyHeader = headers.find((node) => {
        const style = window.getComputedStyle(node);
        return (style.position === "sticky" || style.position === "fixed") && node.getBoundingClientRect().height > 0;
      });
      return stickyHeader ?? headers[0] ?? null;
    };

    const applyStickyOffset = () => {
      const header = resolvePortalHeader();
      const measured = header ? Math.round(header.getBoundingClientRect().height) : 52;
      const clamped = Math.max(48, Math.min(160, measured));
      root.style.setProperty("--find-list-sticky-top", `${clamped}px`);
    };

    applyStickyOffset();

    const header = resolvePortalHeader();
    const resizeObserver = header ? new ResizeObserver(() => applyStickyOffset()) : null;
    if (header && resizeObserver) {
      resizeObserver.observe(header);
    }

    window.addEventListener("resize", applyStickyOffset, { passive: true });
    window.addEventListener("orientationchange", applyStickyOffset, { passive: true });

    return () => {
      window.removeEventListener("resize", applyStickyOffset);
      window.removeEventListener("orientationchange", applyStickyOffset);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const portalConfig = useMemo(() => ({ portalId, portalSlug, portalExclusive }), [portalId, portalSlug, portalExclusive]);

  return (
    <FindContext.Provider value={portalConfig}>
    <div ref={viewRootRef} className="py-3 space-y-3" onClickCapture={handleFindClickCapture}>
      {/* ─── Control Panel ──────────────────────────────────────────────────── */}
      <section
        className={`relative z-40 rounded-xl border border-[var(--twilight)]/60 bg-[var(--night)]/80 backdrop-blur-sm p-2 sm:p-3${displayMode === "map" ? " sticky" : ""}`}
        style={displayMode === "map" ? { top: "var(--find-list-sticky-top, 52px)" } : undefined}
      >
        {/* Type selector tabs */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pr-4 sm:pr-0">
              {visibleTabs.map((option) => {
                const isActive = findType === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => handleTypeChange(option.key)}
                    aria-label={option.label}
                    className={`shrink-0 flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full font-mono text-xs whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold"
                        : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/55"
                    }`}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--night)]/80 to-transparent pointer-events-none sm:hidden" />
          </div>
          {/* Desktop: display toggle + add button */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {availableDisplayModes.length > 1 && (
              <div className="flex rounded-full bg-[var(--void)]/70 border border-[var(--twilight)]/80 p-0.5">
                {availableDisplayModes.map((mode) => {
                  const modeConfig = DISPLAY_OPTIONS[mode];
                  const isActive = displayMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => handleDisplayModeChange(mode)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                      }`}
                      aria-label={`${modeConfig.label} view`}
                    >
                      {modeConfig.icon}
                      <span className="hidden md:inline">{modeConfig.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <AddNewChooser portalSlug={portalSlug} />
          </div>
        </div>

        {/* Mobile: display toggle + add button */}
        <div className="sm:hidden mt-2 flex items-center gap-2">
          {availableDisplayModes.length > 1 && (
            <div className="flex rounded-full bg-[var(--void)]/72 border border-[var(--twilight)]/80 p-0.5">
              {availableDisplayModes.map((mode) => {
                const modeConfig = DISPLAY_OPTIONS[mode];
                const isActive = displayMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => handleDisplayModeChange(mode)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                      isActive
                        ? "bg-[var(--cream)] text-[var(--void)]"
                        : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                    }`}
                    aria-label={`${modeConfig.label} view`}
                  >
                    {modeConfig.icon}
                    <span>{modeConfig.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="ml-auto">
            <AddNewChooser portalSlug={portalSlug} />
          </div>
        </div>

        {/* Events filter bar (inside panel) */}
        {findType === "events" && (
          <EventsFinderFilters
            portalId={portalId}
            portalSlug={portalSlug}
            portalExclusive={portalExclusive}
            displayMode={displayMode}
            hasActiveFilters={hasActiveFilters}
            vertical={vertical}
          />
        )}
      </section>

      {/* ─── Content Area (delegated to Finder plugins) ─────────────────────── */}

      {findType === "events" && (
        <EventsFinder
          portalId={portalId}
          portalSlug={portalSlug}
          portalExclusive={portalExclusive}
          displayMode={displayMode}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {findType === "classes" && (
        <ClassesView portalId={portalId} portalSlug={portalSlug} />
      )}

      {findType === "showtimes" && (
        <ShowtimesView portalId={portalId} portalSlug={portalSlug} />
      )}

      {findType === "whats_on" && (
        <WhatsOnView portalId={portalId} portalSlug={portalSlug} />
      )}

      {findType === "destinations" && (
        <SpotsFinder
          portalId={portalId}
          portalSlug={portalSlug}
          portalExclusive={portalExclusive}
          displayMode={displayMode === "calendar" ? "list" : displayMode as "list" | "map"}
        />
      )}

      {findType === "regulars" && (
        <RegularsView
          portalId={portalId}
          portalSlug={portalSlug}
        />
      )}

    </div>
    </FindContext.Provider>
  );
}

// ─── Suspense Wrapper ─────────────────────────────────────────────────────────

export default function FindShell(props: FindShellProps) {
  return (
    <Suspense
      fallback={
        <div className="py-3 space-y-3">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-20 skeleton-shimmer rounded-full" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <FindShellInner {...props} />
    </Suspense>
  );
}

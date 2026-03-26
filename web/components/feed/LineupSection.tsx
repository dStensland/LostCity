"use client";

/**
 * LineupSection — tabbed event timeline with configurable category chips.
 *
 * Date tabs: TODAY / THIS WEEK / COMING UP (show total event counts).
 * Category chips: "All" + user's 5 picks + "+" to configure.
 *   - Each chip shows count for that category in the active date tab.
 *   - Counts update when switching date tabs.
 *   - Chip selection persists for auth'd users.
 *   - ~8 events shown initially, then "Show more" to expand.
 *
 * "Free" chip is a cross-cut filter on top of the active union.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type {
  CityPulseSection,
  CityPulseEventItem,
  CityPulseResponse,
} from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";
import {
  INTEREST_CHIPS,
  INTEREST_MAP,
  DEFAULT_INTEREST_IDS,
  buildUnionMatcher,
  type InterestChip,
} from "@/lib/city-pulse/interests";
import { isSceneEvent } from "@/lib/city-pulse/section-builders";
import { matchActivityType } from "@/lib/scene-event-routing";
import { ENABLE_LINEUP_RECURRING } from "@/lib/launch-flags";
import { RecurringStrip } from "./lineup/RecurringStrip";
import FeedSectionHeader from "./FeedSectionHeader";
import { TieredEventList } from "@/components/feed/TieredEventList";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowRight, Lightning, CalendarBlank,
  ListBullets, Plus, X, Check, SignIn, FloppyDisk,
  // Interest chip icons
  Waveform, FilmSlate, Palette, PersonSimpleRun, MoonStars,
  UsersFour, MaskHappy, Barbell, Smiley, Martini,
  BeerStein, Ticket,
  // Extended interest icons
  UsersThree, GraduationCap, Leaf,
  MusicNotes, Mountains, Warehouse,
  // Genre + additional interest icons
  Question, MicrophoneStage, Crown, Microphone,
  Lightbulb, Headphones, GameController, BookOpen,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";

// ---------------------------------------------------------------------------
// Icon resolver — maps iconName string → Phosphor component
// ---------------------------------------------------------------------------

const ICON_LOOKUP: Record<string, ComponentType<IconProps>> = {
  Waveform, FilmSlate, Palette, PersonSimpleRun, MoonStars,
  UsersFour, MaskHappy, Barbell, Smiley, Martini,
  BeerStein, Ticket,
  UsersThree, GraduationCap, Leaf,
  MusicNotes, Mountains, Warehouse,
  Question, MicrophoneStage, Crown, Microphone,
  Lightbulb, Headphones, GameController, BookOpen,
};

function getChipIcon(chip: InterestChip): ComponentType<IconProps> {
  return ICON_LOOKUP[chip.iconName] || ListBullets;
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

interface TabConfig {
  id: string;
  label: string;
  dateFilter: (event: { start_date: string }) => boolean;
  accent: string;
  icon: typeof Lightning;
  seeAllHref: (slug: string) => string;
}

function getToday(): string {
  const d = new Date();
  if (d.getHours() < 5) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getDatePlusDays(days: number): string {
  const d = new Date();
  if (d.getHours() < 5) d.setDate(d.getDate() - 1);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TABS: TabConfig[] = [
  {
    id: "today",
    label: "TODAY",
    dateFilter: (e) => e.start_date <= getToday(),
    accent: "var(--coral)",
    icon: Lightning,
    seeAllHref: (s) => `/${s}?view=happening&date=today`,
  },
  {
    id: "this_week",
    label: "THIS WEEK",
    dateFilter: (e) => {
      const tomorrow = getDatePlusDays(1);
      const sixOut = getDatePlusDays(7);
      return e.start_date >= tomorrow && e.start_date <= sixOut;
    },
    accent: "var(--neon-green)",
    icon: CalendarBlank,
    seeAllHref: (s) => `/${s}?view=happening&date=next_7_days`,
  },
  {
    id: "coming_up",
    label: "COMING UP",
    dateFilter: (e) => {
      const weekOut = getDatePlusDays(7);
      const monthOut = getDatePlusDays(28);
      return e.start_date >= weekOut && e.start_date <= monthOut;
    },
    accent: "var(--gold)",
    icon: CalendarBlank,
    seeAllHref: (s) => `/${s}?view=happening&date=next_30_days`,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LineupSectionProps {
  sections: CityPulseSection[];
  portalSlug: string;
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  /** Server-side per-category counts for each tab — exact GROUP BY results */
  categoryCounts?: {
    today: Record<string, number>;
    this_week: Record<string, number>;
    coming_up: Record<string, number>;
  } | null;
  fetchTab?: (tab: "this_week" | "coming_up") => Promise<CityPulseResponse>;
  /** Active interest IDs from user preferences. null/undefined = defaults. */
  activeInterests?: string[] | null;
  /** Last-saved interests (controls server-side per-category queries). */
  savedInterests?: string[];
  /** Callback when user edits their interest chips via the "+" picker (local only). */
  onInterestsChange?: (ids: string[]) => void;
  /** Callback to persist interests + trigger API refetch with new categories. */
  onSaveInterests?: (ids: string[]) => void;
  /** Hide the category filter chips (e.g. civic portals). Defaults to true. */
  showCategoryFilters?: boolean;
  /** Override the section header title (default: "The Lineup"). */
  sectionTitle?: string;
  /** Override the section header accent color (default: var(--coral)). */
  sectionAccentColor?: string;
  /** Keep recurring events in the lineup (civic portals). Defaults to false. */
  keepRecurring?: boolean;
  /** Portal vertical — used for civic routing (e.g. "community") */
  vertical?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LineupSection({
  sections,
  portalSlug,
  tabCounts,
  categoryCounts,
  fetchTab,
  activeInterests,
  savedInterests,
  onInterestsChange,
  onSaveInterests,
  showCategoryFilters = true,
  sectionTitle = "The Lineup",
  sectionAccentColor = "var(--coral)",
  keepRecurring = false,
  vertical,
}: LineupSectionProps) {
  const { user } = useAuth();

  const [activeTabId, setActiveTabId] = useState(TABS[0].id);
  const [activeChipId, setActiveChipId] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tabFetchError, setTabFetchError] = useState<string | null>(null);

  // Login nudge state
  const filterInteractionCount = useRef(0);
  const [showLoginNudge, setShowLoginNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Lazy-loaded tab data + fresh server counts from tab responses
  const [lazyData, setLazyData] = useState<Record<string, CityPulseSection[]>>({});
  const [lazyTabCounts, setLazyTabCounts] = useState<Record<string, number>>({});
  const [lazyCategoryCounts, setLazyCategoryCounts] = useState<Record<string, Record<string, number>>>({});
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  // Local interest state — synced from props but editable via picker
  // When activeInterests is explicitly passed (even empty), use it.
  // Only fall back to defaults when activeInterests is undefined/null.
  const [localInterests, setLocalInterests] = useState<string[]>(() => {
    if (activeInterests != null) return [...activeInterests];
    return [...DEFAULT_INTEREST_IDS];
  });

  // Sync from props when they change (e.g. prefs loaded async)
  useEffect(() => {
    if (activeInterests && activeInterests.length > 0) {
      setLocalInterests([...activeInterests]);
    }
  }, [activeInterests]);

  // Build the visible interest chips
  const visibleChips = useMemo(() => {
    return localInterests
      .map((id) => INTEREST_MAP.get(id))
      .filter((c): c is InterestChip => !!c);
  }, [localInterests]);

  // Detect unsaved lineup changes — compare local vs saved (sorted for order-independence)
  const hasUnsavedChanges = useMemo(() => {
    const saved = savedInterests ?? [...DEFAULT_INTEREST_IDS];
    if (localInterests.length !== saved.length) return true;
    const sortedLocal = [...localInterests].sort();
    const sortedSaved = [...saved].sort();
    return sortedLocal.some((id, i) => id !== sortedSaved[i]);
  }, [localInterests, savedInterests]);

  const [isSaving, setIsSaving] = useState(false);
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    await onSaveInterests?.(localInterests);
    setIsSaving(false);
    setPickerOpen(false);
  }, [localInterests, onSaveInterests]);

  const pendingInterestsRef = useRef<string[] | null>(null);

  const handleToggleInterest = useCallback((chipId: string) => {
    setLocalInterests((prev) => {
      let next: string[];
      if (prev.includes(chipId)) {
        // Don't allow removing all category chips
        const remaining = prev.filter((id) => id !== chipId);
        const hasCategory = remaining.some((id) => {
          const chip = INTEREST_MAP.get(id);
          return chip?.type === "category";
        });
        if (!hasCategory) return prev;
        next = remaining;
        // If the removed chip was the active filter, reset to "all"
        if (activeChipId === chipId) setActiveChipId("all");
      } else {
        next = [...prev, chipId];
      }
      pendingInterestsRef.current = next;
      return next;
    });
    // Side effect outside the updater — fires reliably once
    if (pendingInterestsRef.current) {
      onInterestsChange?.(pendingInterestsRef.current);
      pendingInterestsRef.current = null;
    }
  }, [activeChipId, onInterestsChange]);

  const trackFilterInteraction = useCallback(() => {
    if (user) return;
    filterInteractionCount.current += 1;
    if (filterInteractionCount.current >= 2 && !nudgeDismissed) {
      setShowLoginNudge(true);
    }
  }, [user, nudgeDismissed]);

  const handleChipTap = useCallback((chipId: string) => {
    triggerHaptic("selection");
    setActiveChipId(chipId);
    trackFilterInteraction();
  }, [trackFilterInteraction]);

  const handleTabClick = useCallback(async (tabId: string) => {
    setActiveTabId(tabId);
    setTabFetchError(null);
    // Filter persists across tabs — do NOT reset activeChipId
    if (tabId !== "today" && !lazyData[tabId] && fetchTab) {
      setLoadingTab(tabId);
      try {
        const data = await fetchTab(tabId as "this_week" | "coming_up");
        setLazyData((prev) => ({ ...prev, [tabId]: data.sections }));
        // Capture fresh server counts so tab badges update
        if (data.tab_counts) {
          setLazyTabCounts((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data.tab_counts!).filter(([, v]) => v > 0),
            ),
          }));
        }
        // Capture per-category counts for the loaded tab
        if (data.category_counts) {
          setLazyCategoryCounts((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data.category_counts!).filter(([, v]) => v && Object.keys(v).length > 0),
            ),
          }));
        }
      } catch {
        const activeLabel = TABS.find((t) => t.id === tabId)?.label ?? tabId;
        setTabFetchError(`Couldn't load ${activeLabel.toLowerCase()} events. Tap to retry.`);
      } finally {
        setLoadingTab(null);
      }
    }
  }, [lazyData, fetchTab]);

  const activeTab = TABS.find((t) => t.id === activeTabId) || TABS[0];

  // Build union matcher for "All" chip
  const unionMatcher = useMemo(
    () => buildUnionMatcher(localInterests),
    [localInterests],
  );

  // Per-tab event pools — kept separate so lazy-loading THIS WEEK doesn't
  // inflate TODAY's counts. Each tab only contains its own events.
  // Events that belong in other blocks are excluded to avoid duplication:
  //   • Regular Hangs — recurring events matching an activity type
  //   • Now Showing — film showtimes (series_type = "film")
  const tabEventPools = useMemo(() => {
    const pools: Record<string, CityPulseEventItem[]> = {};
    const dedup = (items: CityPulseEventItem[]) => {
      const seen = new Set<number>();
      return items.filter((e) => {
        if (!keepRecurring && !ENABLE_LINEUP_RECURRING && isSceneEvent(e.event as FeedEventData)) return false;
        const ev = e.event as FeedEventData & Record<string, unknown>;
        const ev_series = ev.series as { series_type?: string | null } | null;
        const evTags = ((ev.tags as string[] | null) ?? []);

        // Entertainment-specific filters — skip for civic portals (keepRecurring)
        if (!keepRecurring) {
          // Film events → Now Showing block handles all showtimes
          if (ev_series?.series_type === "film") return false;
          if (ev.category === "film") return false;
          // Activism/mobilize → separate opt-in block
          if (evTags.includes("activism") || evTags.includes("mobilize")) return false;
        }
        // Recurring fall-throughs: recurring events that don't match any Scene
        // activity type AND have no premium signal (touring, album-release, tour
        // series) are low-signal for the Lineup — they belong in their category
        // feed, not the curated "what's happening" block.
        // Civic portals keep all recurring events (meetings, volunteer shifts).
        if (!keepRecurring) {
          const seriesId = ev.series_id;
          const isRecurring = ev.is_recurring;
          if (seriesId || isRecurring) {
            const hasLineupTag = evTags.some((t: string) =>
              t === "touring" || t === "album-release" || t === "one-night-only",
            );
            const hasTourSeries = ev_series?.series_type === "tour";
            if (!hasLineupTag && !hasTourSeries) return false;
          }
        }
        if (seen.has(e.event.id)) return false;
        seen.add(e.event.id);
        return true;
      });
    };

    // Initial sections cover "today" tab
    const initialEvents = sections
      .flatMap((s) => s.items)
      .filter((i): i is CityPulseEventItem => i.item_type === "event");
    pools["today"] = dedup(initialEvents);

    // Lazy-loaded tabs get their own pool
    for (const [tabId, tabSections] of Object.entries(lazyData)) {
      const tabEvents = tabSections
        .flatMap((s) => s.items)
        .filter((i): i is CityPulseEventItem => i.item_type === "event");
      pools[tabId] = dedup(tabEvents);
    }

    return pools;
  }, [sections, lazyData, keepRecurring]);

  // Events for the active tab only
  const tabDateEvents = useMemo(() => {
    const pool = tabEventPools[activeTabId];
    if (pool) return pool;
    // Fallback: filter initial sections by date (before lazy data arrives)
    return (tabEventPools["today"] || []).filter(
      (e) => activeTab.dateFilter(e.event),
    );
  }, [tabEventPools, activeTabId, activeTab]);

  // Apply interest-based filtering on top of the active tab's events
  const events = useMemo(() => {
    let evts = tabDateEvents;

    if (activeChipId === "all") {
      // "All" means all events — no category restriction
    } else if (activeChipId === "free") {
      const freeChip = INTEREST_MAP.get("free");
      if (freeChip) {
        evts = evts.filter((e) => freeChip.match(e));
      }
    } else {
      const chip = INTEREST_MAP.get(activeChipId);
      if (chip) {
        evts = evts.filter((e) => chip.match(e));
      }
    }

    return evts;
  }, [tabDateEvents, activeChipId, unionMatcher]);

  // Fetch tonight's recurring events for RecurringStrip (separate data source from city-pulse)
  const [regularsData, setRegularsData] = useState<CityPulseEventItem[]>([]);
  useEffect(() => {
    if (!ENABLE_LINEUP_RECURRING) return;
    const controller = new AbortController();
    fetch(`/api/regulars?portal=${portalSlug}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        const allEvents = (data.events || []) as FeedEventData[];
        const filtered = allEvents.filter((event: FeedEventData) => {
          return matchActivityType(event as unknown as Parameters<typeof matchActivityType>[0]) !== null;
        });
        // No hidden sort — show in chronological order from the API
        const items: CityPulseEventItem[] = filtered
          .slice(0, 20)
          .map((event: FeedEventData) => ({
            item_type: "event" as const,
            event: {
              ...event,
              is_recurring: true,
              recurrence_label: (event as Record<string, unknown>).recurrence_label as string | undefined,
            },
          }));
        setRegularsData(items);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [portalSlug]);

  // Split: standard events from city-pulse + recurring from regulars fetch
  const { standardEvents, recurringEvents } = useMemo(() => {
    if (!ENABLE_LINEUP_RECURRING) {
      return { standardEvents: events, recurringEvents: [] as CityPulseEventItem[] };
    }
    return { standardEvents: events, recurringEvents: regularsData };
  }, [events, regularsData]);

  // Merged category counts: initial response + lazy-loaded tab overrides
  // Date tab counts — show TOTAL lineup depth per tab (not filtered by interests).
  // The badge signals city vitality to the user; interest chips filter the list below.
  const dateTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of TABS) {
      counts[tab.id] = lazyTabCounts[tab.id]
        ?? tabCounts?.[tab.id as keyof typeof tabCounts]
        ?? 0;
    }
    return counts as { today: number; this_week: number; coming_up: number };
  }, [tabCounts, lazyTabCounts]);

  // Category chip counts — always computed from the actual event pool so
  // counts match what the user sees when clicking a chip. Server counts
  // (category_counts) are only used for tab badges, not chip badges,
  // because the SQL count query can't replicate every section-builder filter.
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts["all"] = tabDateEvents.length;
    for (const chip of INTEREST_CHIPS) {
      if (chip.type === "tag" && chip.id === "free") {
        counts[chip.id] = tabDateEvents.filter(
          (e) => unionMatcher(e) && chip.match(e),
        ).length;
      } else {
        counts[chip.id] = tabDateEvents.filter((e) => chip.match(e)).length;
      }
    }
    return counts;
  }, [tabDateEvents, unionMatcher]);

  const visibleItems = standardEvents;

  // If no sections have any events at all, hide entirely
  const hasAnyContent = sections.some((s) =>
    s.items.some((i) => i.item_type === "event"),
  );
  if (!hasAnyContent) return null;

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title={sectionTitle}
        priority="secondary"
        accentColor={sectionAccentColor}
        icon={<Lightning weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening`}
      />

      {/* Date tabs — counts are lineup-filtered */}
      <div className="flex items-center gap-4 mb-3 border-b border-[var(--twilight)]/30 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTabId;
          const TabIcon = tab.icon;
          const itemCount = dateTabCounts?.[tab.id as keyof typeof dateTabCounts] ?? 0;
          const tabAccent = sectionAccentColor !== "var(--coral)" ? sectionAccentColor : tab.accent;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={[
                "shrink-0 flex items-center gap-1.5 pb-3 font-mono text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px",
                isActive
                  ? "text-[var(--cream)]"
                  : "text-[var(--muted)] hover:text-[var(--soft)] border-transparent",
              ].join(" ")}
              style={isActive ? { borderBottomColor: tabAccent } : undefined}
            >
              <TabIcon weight={isActive ? "fill" : "bold"} className="w-4 h-4" />
              {tab.label}
              {itemCount > 0 && (
                <span
                  className="font-mono text-2xs tabular-nums px-1.5 py-0.5 rounded-full leading-none min-w-6 text-center inline-block"
                  style={
                    isActive
                      ? { backgroundColor: `color-mix(in srgb, ${tabAccent} 20%, transparent)`, color: tabAccent }
                      : { backgroundColor: "var(--twilight)", color: "var(--muted)" }
                  }
                >
                  {itemCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category chips — counts reflect active date tab */}
      {showCategoryFilters && (<>
      <div className={[
          "relative mb-3 rounded-xl transition-all duration-300",
          hasUnsavedChanges
            ? "bg-[var(--coral)]/[0.03] ring-1 ring-[var(--coral)]/15 -mx-2 px-2 py-0.5"
            : "",
        ].join(" ")}>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-1.5 pt-1.5 pb-0.5 px-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--coral)] animate-pulse" />
              <span className="font-mono text-2xs uppercase tracking-[0.15em] text-[var(--coral)]/70 font-semibold">
                Draft
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 pr-8">
            {/* "All" chip */}
            <ChipButton
              label="All"
              Icon={ListBullets}
              color="var(--coral)"
              count={chipCounts["all"] || 0}
              isActive={activeChipId === "all"}
              onClick={() => handleChipTap("all")}
            />

            {/* User's selected interest chips */}
            {visibleChips.map((chip) => (
              <ChipButton
                key={chip.id}
                label={chip.label}
                Icon={getChipIcon(chip)}
                color={chip.color}
                count={chipCounts[chip.id]}
                isActive={activeChipId === chip.id}
                onClick={() => handleChipTap(chip.id)}
              />
            ))}

            {/* "+" configure lineup — opens inline picker */}
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className={[
                "shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95 border",
                pickerOpen
                  ? "bg-white/10 border-white/15 text-[var(--cream)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)] hover:border-[var(--soft)]/30",
              ].join(" ")}
              aria-label="Configure your lineup categories"
              title="Customize categories"
            >
              {pickerOpen ? (
                <X weight="bold" className="w-3.5 h-3.5" />
              ) : (
                <Plus weight="bold" className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          {/* Right fade — signals more chips are scrollable */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[var(--void)] to-transparent" />
        </div>

      {/* Unsaved lineup changes — prominent save bar */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-3 mb-3 px-4 py-3 rounded-xl bg-[var(--coral)]/[0.08] border border-[var(--coral)]/30 animate-[fadeInSave_0.25s_ease-out]">
          <div className="flex-1 min-w-0">
            <span className="block font-mono text-xs font-semibold text-[var(--cream)]">
              Unsaved changes
            </span>
            <span className="block font-mono text-2xs text-[var(--muted)] mt-0.5">
              Save to update your feed
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-full font-mono text-xs font-bold uppercase tracking-wider bg-[var(--coral)] text-[var(--void)] hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_12px_color-mix(in_srgb,var(--coral)_40%,transparent)]"
          >
            <FloppyDisk weight="bold" className="w-3.5 h-3.5" />
            {isSaving ? "Saving…" : "Save lineup"}
          </button>
        </div>
      )}

      {/* Login nudge (anonymous users, after 2nd filter interaction) */}
      {showLoginNudge && !user && !nudgeDismissed && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-[var(--twilight)]/30">
          <SignIn weight="bold" className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
          <span className="font-mono text-2xs text-[var(--muted)] flex-1">
            Sign in to save your filters
          </span>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(`/${portalSlug}`)}`}
            className="font-mono text-2xs font-medium text-[var(--coral)] hover:underline shrink-0"
          >
            Sign in
          </Link>
          <button
            onClick={() => setNudgeDismissed(true)}
            className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X weight="bold" className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Inline interest picker */}
      {pickerOpen && (
        <InterestPicker
          activeIds={localInterests}
          onToggle={handleToggleInterest}
          onClose={() => setPickerOpen(false)}
          counts={chipCounts}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          onSave={handleSave}
        />
      )}
      </>)}

      {/* Loading state for lazy tab */}
      {loadingTab === activeTabId && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Tab fetch error */}
      {tabFetchError && loadingTab !== activeTabId && (
        <button
          type="button"
          onClick={() => handleTabClick(activeTabId)}
          className="w-full py-6 text-center font-mono text-xs text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
        >
          {tabFetchError}
        </button>
      )}

      {/* Event list — tiered rendering */}
      {loadingTab !== activeTabId && !tabFetchError && (
        <>
          <TieredEventList
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            events={visibleItems.map((item) => item.event as any)}
            portalSlug={portalSlug}
            sectionType={activeTabId === "today" ? "tonight" : activeTabId}
            maxHero={1}
            maxFeatured={4}
          />

          {ENABLE_LINEUP_RECURRING && recurringEvents.length > 0 && (
            <RecurringStrip events={recurringEvents} portalSlug={portalSlug} activeTab={activeTabId} />
          )}

          {events.length === 0 && (
            <p className="text-center text-[var(--muted)] text-sm py-8 font-mono">
              No events matching this filter
            </p>
          )}
        </>
      )}

      {/* See all — glow button, contextual to active chip */}
      {(() => {
        const chipMeta = INTEREST_MAP.get(activeChipId);
        const ctaColor = chipMeta?.color || sectionAccentColor;
        const ctaLabel =
          activeChipId !== "all" && activeChipId !== "free"
            ? `See all ${chipMeta?.label?.toLowerCase() || ""} events`
            : "See all events";
        const ctaHref = (() => {
          const base = activeTab.seeAllHref(portalSlug);
          if (activeChipId !== "all" && activeChipId !== "free") {
            const chip = INTEREST_MAP.get(activeChipId);
            if (chip && chip.type === "category") {
              const sep = base.includes("?") ? "&" : "?";
              return `${base}${sep}categories=${activeChipId}`;
            }
          }
          return base;
        })();

        return (
          <Link
            href={ctaHref}
            className="mt-3 flex items-center justify-center gap-1 font-mono text-xs transition-colors hover:opacity-80"
            style={{ color: ctaColor }}
          >
            {ctaLabel}
            <ArrowRight weight="bold" className="w-3 h-3" />
          </Link>
        );
      })()}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chip button — consistent width via min-w on count badge
// ---------------------------------------------------------------------------

function ChipButton({
  label,
  Icon,
  color,
  count,
  isActive,
  onClick,
}: {
  label: string;
  Icon: ComponentType<IconProps>;
  color: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs tracking-wide transition-all active:scale-95 border min-h-[44px] sm:min-h-[32px]",
        "focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:outline-none",
        isActive
          ? "font-medium"
          : "border-transparent text-[var(--muted)] hover:bg-white/[0.03]",
      ].join(" ")}
      style={
        isActive
          ? {
              color,
              backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
              boxShadow: `0 0 12px color-mix(in srgb, ${color} 40%, transparent), 0 0 24px color-mix(in srgb, ${color} 20%, transparent)`,
            }
          : undefined
      }
    >
      <Icon weight={isActive ? "fill" : "bold"} className="w-4 h-4" />
      {label}
      {count != null && count > 0 && (
        <span
          className="font-mono text-2xs tabular-nums min-w-5 text-center"
          style={{ opacity: isActive ? 0.8 : 0.5 }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline interest picker — opened by "+" chip
// ---------------------------------------------------------------------------

function InterestPicker({
  activeIds,
  onToggle,
  onClose,
  counts,
  hasUnsavedChanges,
  isSaving,
  onSave,
}: {
  activeIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  counts: Record<string, number>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const activeSet = new Set(activeIds);

  return (
    <div
      ref={ref}
      className="mb-4 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--twilight)]/50"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Edit Filters
        </span>
        <button
          onClick={onClose}
          className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {INTEREST_CHIPS.map((chip) => {
          const isOn = activeSet.has(chip.id);
          const ChipIcon = getChipIcon(chip);
          const count = counts[chip.id];
          return (
            <button
              key={chip.id}
              onClick={() => onToggle(chip.id)}
              className={[
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-2xs tracking-wide transition-all active:scale-95 border",
                isOn
                  ? "bg-white/[0.08] border-white/15 text-[var(--cream)]"
                  : "border-transparent text-[var(--muted)] hover:bg-white/[0.03]",
              ].join(" ")}
            >
              {isOn ? (
                <Check weight="bold" className="w-3 h-3" style={{ color: chip.color }} />
              ) : (
                <ChipIcon weight="bold" className="w-3 h-3" />
              )}
              {chip.label}
              {count != null && count > 0 && (
                <span className="text-2xs tabular-nums min-w-4 text-center opacity-50">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Inline save footer — shown inside the picker when changes are pending */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--twilight)]/30">
          <span className="flex-1 font-mono text-2xs text-[var(--muted)]">
            Tap save to update your feed
          </span>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-2xs font-bold uppercase tracking-wider bg-[var(--coral)] text-[var(--void)] hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_10px_color-mix(in_srgb,var(--coral)_35%,transparent)]"
          >
            <FloppyDisk weight="bold" className="w-3 h-3" />
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

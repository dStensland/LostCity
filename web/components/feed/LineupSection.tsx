"use client";

/**
 * LineupSection — tabbed event timeline with configurable category chips.
 *
 * Date tabs: TODAY / THIS WEEK / COMING UP (show total event counts).
 * Category chips: "All" + user's 5 picks + "+" to configure.
 *   - Each chip shows count for that category in the active date tab.
 *   - Counts update when switching date tabs.
 *   - Chip selection persists for auth'd users.
 *   - Max 8 events shown, then expand to see more.
 *
 * "Happy Hour" chip switches to specials-only view.
 * "Free" chip is a cross-cut filter on top of the active union.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type {
  CityPulseSection,
  CityPulseEventItem,
  CityPulseSpecialItem,
  CityPulseResponse,
} from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";
import {
  INTEREST_CHIPS,
  INTEREST_MAP,
  DEFAULT_INTEREST_IDS,
  buildUnionMatcher,
  getServerChipCount,
  type InterestChip,
} from "@/lib/city-pulse/interests";
import LineupHero from "./LineupHero";
import CompactEventRow from "./CompactEventRow";
import InlineSpecialRow from "./InlineSpecialRow";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowRight, CaretDown, Lightning, CalendarBlank,
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

const INITIAL_ROWS = 6;

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
    seeAllHref: (s) => `/${s}?view=find&type=events&date=today`,
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
    seeAllHref: (s) => `/${s}?view=find&type=events&date=next_7_days`,
  },
  {
    id: "coming_up",
    label: "COMING UP",
    dateFilter: (e) => {
      const weekOut = getDatePlusDays(8);
      const monthOut = getDatePlusDays(28);
      return e.start_date >= weekOut && e.start_date <= monthOut;
    },
    accent: "var(--gold)",
    icon: CalendarBlank,
    seeAllHref: (s) => `/${s}?view=find&type=events&date=next_30_days`,
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
  /** Event IDs to exclude from the lineup (e.g. events shown in Regular Hangs) */
  excludeEventIds?: Set<number>;
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
  excludeEventIds,
}: LineupSectionProps) {
  const { user } = useAuth();
  const visibleTabs = useMemo(() => TABS, []);

  const [activeTabId, setActiveTabId] = useState(visibleTabs[0].id);
  const [activeChipId, setActiveChipId] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
  const [localInterests, setLocalInterests] = useState<string[]>(() => {
    if (activeInterests && activeInterests.length > 0) return [...activeInterests];
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
    setShowAllRows(false);
    trackFilterInteraction();
  }, [trackFilterInteraction]);

  const handleTabClick = useCallback(async (tabId: string) => {
    setActiveTabId(tabId);
    // Filter persists across tabs — do NOT reset activeChipId
    setShowAllRows(false);
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
      } finally {
        setLoadingTab(null);
      }
    }
  }, [lazyData, fetchTab]);

  const activeTab = visibleTabs.find((t) => t.id === activeTabId) || visibleTabs[0];

  // Build union matcher for "All" chip
  const unionMatcher = useMemo(
    () => buildUnionMatcher(localInterests),
    [localInterests],
  );

  const isHappyHour = activeChipId === "happy_hour";

  // Per-tab event pools — kept separate so lazy-loading THIS WEEK doesn't
  // inflate TODAY's counts. Each tab only contains its own events.
  // Events shown in Regular Hangs are excluded to avoid duplication.
  const tabEventPools = useMemo(() => {
    const pools: Record<string, CityPulseEventItem[]> = {};
    const dedup = (items: CityPulseEventItem[]) => {
      const seen = new Set<number>();
      return items.filter((e) => {
        if (excludeEventIds?.has(e.event.id)) return false;
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
  }, [sections, lazyData, excludeEventIds]);

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
    if (isHappyHour) return [];

    let evts = tabDateEvents;

    if (activeChipId === "all") {
      evts = evts.filter(unionMatcher);
    } else if (activeChipId === "free") {
      const freeChip = INTEREST_MAP.get("free");
      if (freeChip) {
        evts = evts.filter((e) => unionMatcher(e) && freeChip.match(e));
      }
    } else {
      const chip = INTEREST_MAP.get(activeChipId);
      if (chip) {
        evts = evts.filter((e) => chip.match(e));
      }
    }

    return evts;
  }, [tabDateEvents, activeChipId, unionMatcher, isHappyHour]);

  // Merged category counts: initial response + lazy-loaded tab overrides
  const mergedCategoryCounts = useMemo(() => {
    const merged: Record<string, Record<string, number>> = {};
    // Start with initial-load counts
    if (categoryCounts) {
      for (const [tab, counts] of Object.entries(categoryCounts)) {
        merged[tab] = { ...counts };
      }
    }
    // Override with lazy-loaded tab counts (fresher)
    for (const [tab, counts] of Object.entries(lazyCategoryCounts)) {
      merged[tab] = { ...counts };
    }
    return merged;
  }, [categoryCounts, lazyCategoryCounts]);

  // Date tab counts — sum server-side category counts for the user's active interests.
  // Falls back to ratio estimation only if server counts aren't available.
  const dateTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const tab of TABS) {
      const serverCats = mergedCategoryCounts[tab.id];
      if (serverCats) {
        // Exact server count: sum all active interest chip counts
        let total = 0;
        for (const id of localInterests) {
          const chip = INTEREST_MAP.get(id);
          if (!chip || chip.type === "specials" || chip.type === "tag") continue;
          const chipCount = getServerChipCount(id, serverCats);
          if (chipCount != null) total += chipCount;
        }
        counts[tab.id] = total;
      } else {
        // Fallback: use raw tab count (no interest filtering)
        counts[tab.id] = lazyTabCounts[tab.id]
          ?? tabCounts?.[tab.id as keyof typeof tabCounts]
          ?? 0;
      }
    }
    return counts as { today: number; this_week: number; coming_up: number };
  }, [mergedCategoryCounts, localInterests, tabCounts, lazyTabCounts]);

  // Category chip counts — prefer exact server counts, fall back to pool counts
  const chipCounts = useMemo(() => {
    const serverCats = mergedCategoryCounts[activeTabId];
    const counts: Record<string, number> = {};

    if (serverCats) {
      // "All" = sum of active category/genre interest counts
      let allTotal = 0;
      for (const id of localInterests) {
        const chip = INTEREST_MAP.get(id);
        if (!chip || chip.type === "specials" || chip.type === "tag") continue;
        const c = getServerChipCount(id, serverCats);
        if (c != null) allTotal += c;
      }
      counts["all"] = allTotal;

      // Per-chip counts from server
      for (const chip of INTEREST_CHIPS) {
        if (chip.type === "specials") continue;
        const c = getServerChipCount(chip.id, serverCats);
        if (c != null) {
          counts[chip.id] = c;
        } else {
          // Chip not represented in server counts — fall back to pool
          counts[chip.id] = tabDateEvents.filter((e) => chip.match(e)).length;
        }
      }
    } else {
      // No server counts — fall back to pool counting
      counts["all"] = tabDateEvents.filter(unionMatcher).length;
      for (const chip of INTEREST_CHIPS) {
        if (chip.type === "specials") continue;
        if (chip.type === "tag" && chip.id === "free") {
          counts[chip.id] = tabDateEvents.filter(
            (e) => unionMatcher(e) && chip.match(e),
          ).length;
        } else {
          counts[chip.id] = tabDateEvents.filter((e) => chip.match(e)).length;
        }
      }
    }
    return counts;
  }, [mergedCategoryCounts, activeTabId, localInterests, tabDateEvents, unionMatcher]);

  // Specials — only shown in Happy Hour mode
  const specials = useMemo(() => {
    if (!isHappyHour) return [];
    const all = sections.flatMap((s) => s.items);
    const allSpecials = all.filter(
      (i): i is CityPulseSpecialItem => i.item_type === "special",
    );
    const seen = new Set<number>();
    return allSpecials.filter((s) => {
      if (seen.has(s.special.id)) return false;
      seen.add(s.special.id);
      return true;
    });
  }, [sections, isHappyHour]);

  // Hero event
  const heroEventId = useMemo(() => {
    if (isHappyHour) return null;

    const nowHH = new Date().getHours();
    const isStale = (e: CityPulseEventItem) => {
      if (e.event.end_time) {
        const endHour = parseInt(e.event.end_time.split(":")[0], 10);
        if (endHour > 0 && endHour < nowHH) return true;
      }
      return false;
    };

    const isFeaturedEvent = (e: CityPulseEventItem) =>
      e.event.featured || e.event.is_tentpole || (e.event as Record<string, unknown>).is_featured;

    const featured = events.find(
      (e) => isFeaturedEvent(e) && e.event.image_url && !isStale(e),
    );
    if (featured) return featured.event.id;

    const featuredAny = events.find(
      (e) => isFeaturedEvent(e) && e.event.image_url,
    );
    if (featuredAny) return featuredAny.event.id;

    const withImage = events.find((e) => e.event.image_url);
    if (withImage) return withImage.event.id;

    return null;
  }, [events, isHappyHour]);

  const heroEvent = useMemo(() => {
    if (!heroEventId) return null;
    return events.find((e) => e.event.id === heroEventId) || null;
  }, [events, heroEventId]);

  const listEvents = useMemo(() => {
    if (!heroEventId) return events;
    return events.filter((e) => e.event.id !== heroEventId);
  }, [events, heroEventId]);

  const visibleItems = showAllRows
    ? listEvents
    : listEvents.slice(0, INITIAL_ROWS);

  const hasMoreRows = listEvents.length > INITIAL_ROWS;
  const hiddenCount = listEvents.length - INITIAL_ROWS;

  // If no sections have any events at all, hide entirely
  const hasAnyContent = sections.some((s) =>
    s.items.some((i) => i.item_type === "event" || i.item_type === "special"),
  );
  if (!hasAnyContent) return null;

  return (
    <section>
      {/* Date tabs — counts are lineup-filtered */}
      <div className="flex items-center gap-4 mb-3 border-b border-[var(--twilight)]/30 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const TabIcon = tab.icon;
          const itemCount = dateTabCounts?.[tab.id as keyof typeof dateTabCounts] ?? 0;

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
              style={isActive ? { borderBottomColor: tab.accent } : undefined}
            >
              <TabIcon weight={isActive ? "fill" : "bold"} className="w-4 h-4" />
              {tab.label}
              {itemCount > 0 && (
                <span
                  className="font-mono text-2xs tabular-nums px-1.5 py-0.5 rounded-full leading-none min-w-6 text-center inline-block"
                  style={
                    isActive
                      ? { backgroundColor: `color-mix(in srgb, ${tab.accent} 20%, transparent)`, color: tab.accent }
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
              count={chip.type === "specials" ? undefined : chipCounts[chip.id]}
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

      {/* Loading state for lazy tab */}
      {loadingTab === activeTabId && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Happy Hour: specials-only view */}
      {loadingTab !== activeTabId && isHappyHour && (
        <>
          {specials.length > 0 ? (
            specials.map((s, idx) => (
              <InlineSpecialRow
                key={`special-${s.special.id}`}
                special={s.special}
                portalSlug={portalSlug}
                isLast={idx === specials.length - 1}
              />
            ))
          ) : (
            <p className="text-center text-[var(--muted)] text-sm py-8 font-mono">
              No specials right now
            </p>
          )}
        </>
      )}

      {/* Event view: hero + grid */}
      {loadingTab !== activeTabId && !isHappyHour && (
        <>
          {heroEvent && (
            <LineupHero
              event={heroEvent.event as FeedEventData}
              portalSlug={portalSlug}
            />
          )}

          {visibleItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {visibleItems.map((item) => (
                <CompactEventRow
                  key={`row-${item.event.id}`}
                  event={item.event as FeedEventData}
                  portalSlug={portalSlug}
                  size="sm"
                />
              ))}
            </div>
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
        const ctaColor = chipMeta?.color || "var(--coral)";
        const ctaLabel =
          activeChipId !== "all" && activeChipId !== "free" && activeChipId !== "happy_hour"
            ? `See all ${chipMeta?.label?.toLowerCase() || ""} events`
            : "See all events";
        const ctaHref = (() => {
          const base = activeTab.seeAllHref(portalSlug);
          if (activeChipId !== "all" && activeChipId !== "free" && activeChipId !== "happy_hour") {
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
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-mono font-bold py-3 rounded-xl transition-all active:scale-[0.98] hover:brightness-110 hover:shadow-[0_0_24px_var(--cta-glow)]"
            style={{
              backgroundColor: ctaColor,
              color: "var(--void)",
              boxShadow: `0 0 16px color-mix(in srgb, ${ctaColor} 35%, transparent)`,
              "--cta-glow": `color-mix(in srgb, ${ctaColor} 50%, transparent)`,
            } as React.CSSProperties}
          >
            {ctaLabel}
            <ArrowRight weight="bold" className="w-3.5 h-3.5" />
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
      className={[
        "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs tracking-wide transition-all active:scale-95 border",
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
              {count != null && count > 0 && chip.type !== "specials" && (
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

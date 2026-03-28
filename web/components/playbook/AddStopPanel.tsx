"use client";

/**
 * AddStopPanel — Enhanced "Add a stop" panel for the Playbook editor.
 *
 * Features:
 * - Debounced venue search via /api/places/search
 * - Category filter chips (Food, Drinks, Activity, Nightlife)
 * - Smart suggestions from outing-suggestions API
 * - Custom stop creation form
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import SmartImage from "@/components/SmartImage";
import { useDebounce } from "@/lib/hooks/useDebounce";
import CategoryIcon from "@/components/CategoryIcon";
import type { AddItineraryItemInput } from "@/lib/itinerary-utils";
import type { OutingSuggestion as Suggestion } from "@/lib/outing-suggestions-utils";
import { usePortalCity } from "@/lib/portal-context";
import {
  MagnifyingGlass,
  Plus,
  ForkKnife,
  Martini,
  Lightning,
  MoonStars,
  CaretDown,
  X,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddStopPanelProps {
  portalSlug: string;
  anchorLat?: number;
  anchorLng?: number;
  anchorTime?: string;
  anchorDate?: string;
  onAddItem: (input: AddItineraryItemInput) => Promise<void>;
}

type CategoryFilter = "all" | "food" | "drinks" | "activity" | "nightlife";

type VenueSearchResult = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_CHIPS: { key: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: null },
  { key: "food", label: "Food", icon: <ForkKnife size={13} weight="light" /> },
  { key: "drinks", label: "Drinks", icon: <Martini size={13} weight="light" /> },
  { key: "activity", label: "Activity", icon: <Lightning size={13} weight="light" /> },
  { key: "nightlife", label: "Nightlife", icon: <MoonStars size={13} weight="light" /> },
];

// Map suggestion categories to our filter keys
const CATEGORY_FILTER_MAP: Record<string, CategoryFilter> = {
  food: "food",
  drinks: "drinks",
  activity: "activity",
  sight: "activity",
};

// Map venue_type to rough category
function venueTypeToFilter(venueType: string | null): CategoryFilter {
  if (!venueType) return "all";
  const t = venueType.toLowerCase();
  if (["restaurant", "food_hall", "cooking", "cooking_school", "farmers_market"].includes(t)) return "food";
  if (["bar", "brewery", "winery", "distillery", "cocktail_bar", "coffee_shop"].includes(t)) return "drinks";
  if (["nightclub", "club", "nightlife", "dance"].includes(t)) return "nightlife";
  return "activity";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddStopPanel({
  portalSlug,
  anchorLat,
  anchorLng,
  anchorTime,
  anchorDate,
  onAddItem,
}: AddStopPanelProps) {
  const portalCity = usePortalCity();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<VenueSearchResult[]>([]);
  const [fetchedQuery, setFetchedQuery] = useState(""); // tracks which query was last resolved
  const searchVersionRef = useRef(0);

  // Suggestions state
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<"before" | "after">("before");
  const [beforeSuggestions, setBeforeSuggestions] = useState<Suggestion[]>([]);
  const [afterSuggestions, setAfterSuggestions] = useState<Suggestion[]>([]);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // Custom stop state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDuration, setCustomDuration] = useState(60);
  const [customDescription, setCustomDescription] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [showCustomExtras, setShowCustomExtras] = useState(false);

  // Fetch smart suggestions on mount (only when we have anchor coords)
  const hasAnchor = anchorLat != null && anchorLng != null && anchorTime != null && anchorDate != null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasAnchor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSuggestions() {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestionsLoading(true);
      const baseParams = new URLSearchParams({
        anchor_lat: String(anchorLat),
        anchor_lng: String(anchorLng),
        anchor_time: String(anchorTime),
        anchor_date: String(anchorDate),
        radius_km: "2",
      });

      const [beforeRes, afterRes] = await Promise.all([
        fetch(`/api/portals/${portalSlug}/outing-suggestions?${baseParams.toString()}&slot=before`).catch(() => null),
        fetch(`/api/portals/${portalSlug}/outing-suggestions?${baseParams.toString()}&slot=after`).catch(() => null),
      ]);

      if (cancelled) return;

      if (beforeRes?.ok) {
        const data = await beforeRes.json();
        setBeforeSuggestions(data.suggestions || []);
      }
      if (afterRes?.ok) {
        const data = await afterRes.json();
        setAfterSuggestions(data.suggestions || []);
      }

      setSuggestionsLoading(false);
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [portalSlug, anchorLat, anchorLng, anchorTime, anchorDate, hasAnchor]);

  // Derive current suggestions from slot
  const suggestions = useMemo(
    () => (activeSlot === "before" ? beforeSuggestions : afterSuggestions),
    [activeSlot, beforeSuggestions, afterSuggestions],
  );

  // Search venues when debounced query changes
  const isSearchActive = debouncedQuery.length >= 2;
  useEffect(() => {
    if (!isSearchActive) return;

    // Track version to ignore stale responses
    const version = ++searchVersionRef.current;

    (async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(debouncedQuery)}&limit=8&city=${encodeURIComponent(portalCity)}`);
        if (version !== searchVersionRef.current) return;
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.venues || []);
          setFetchedQuery(debouncedQuery);
        }
      } catch {
        // Silently fail — user can retry
        if (version === searchVersionRef.current) {
          setFetchedQuery(debouncedQuery);
        }
      }
    })();
  }, [debouncedQuery, isSearchActive, portalCity]);

  // Derive loading: searching but results haven't arrived for the current query
  const searchLoading = isSearchActive && fetchedQuery !== debouncedQuery;
  const effectiveSearchResults = useMemo(
    () => (isSearchActive ? searchResults : []),
    [isSearchActive, searchResults],
  );

  // Filtered suggestions based on category
  const filteredSuggestions = useMemo(() => {
    if (categoryFilter === "all") return suggestions;
    return suggestions.filter((s) => {
      const mapped = CATEGORY_FILTER_MAP[s.category];
      return mapped === categoryFilter;
    });
  }, [suggestions, categoryFilter]);

  // Filtered search results based on category
  const filteredSearchResults = useMemo(() => {
    if (categoryFilter === "all") return effectiveSearchResults;
    return effectiveSearchResults.filter((v) => venueTypeToFilter(v.venue_type) === categoryFilter);
  }, [effectiveSearchResults, categoryFilter]);

  const handleAddSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      await onAddItem({
        item_type: suggestion.type === "event" ? "event" : "venue",
        ...(suggestion.type === "event"
          ? { event_id: suggestion.id, event_title: suggestion.title }
          : { venue_id: suggestion.venue.id, venue_name: suggestion.venue.name }),
        custom_lat: suggestion.venue.lat || undefined,
        custom_lng: suggestion.venue.lng || undefined,
        venue_image: suggestion.image_url || null,
      });
    },
    [onAddItem],
  );

  const handleAddVenue = useCallback(
    async (venue: VenueSearchResult) => {
      await onAddItem({
        item_type: "venue",
        venue_id: venue.id,
        venue_name: venue.name,
        venue_image: venue.image_url,
        custom_lat: venue.lat || undefined,
        custom_lng: venue.lng || undefined,
      });
    },
    [onAddItem],
  );

  const handleAddCustom = useCallback(async () => {
    if (!customTitle.trim()) return;
    await onAddItem({
      item_type: "custom",
      custom_title: customTitle.trim(),
      duration_minutes: customDuration,
      custom_description: customDescription.trim() || undefined,
      custom_address: customAddress.trim() || undefined,
    });
    // Reset form
    setCustomTitle("");
    setCustomDuration(60);
    setCustomDescription("");
    setCustomAddress("");
    setShowCustomForm(false);
    setShowCustomExtras(false);
  }, [onAddItem, customTitle, customDuration, customDescription, customAddress]);

  const isSearching = isSearchActive;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: "rgba(255, 255, 255, 0.015)",
        borderColor: "rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <MagnifyingGlass size={15} className="text-white/30 shrink-0" />
          <input
            type="text"
            placeholder="Search venues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-white/30 hover:text-white/50 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Category chips */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = categoryFilter === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setCategoryFilter(chip.key)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              {chip.icon}
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="px-3 pb-3">
        {/* Search results */}
        {isSearching && (
          <div className="space-y-1">
            {searchLoading && (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}

            {!searchLoading && filteredSearchResults.length === 0 && (
              <p className="text-center text-xs text-white/30 py-6">
                No venues found for &ldquo;{searchQuery}&rdquo;
              </p>
            )}

            {!searchLoading && filteredSearchResults.map((venue) => (
              <button
                key={venue.id}
                onClick={() => handleAddVenue(venue)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
              >
                <div
                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
                >
                  <CategoryIcon type={venue.venue_type || "venue"} size={16} glow="subtle" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)" }}
                  >
                    {venue.name}
                  </p>
                  <p
                    className="text-[10px] truncate"
                    style={{ color: "var(--muted)", opacity: 0.5, fontFamily: "var(--font-mono)" }}
                  >
                    {venue.venue_type || "venue"}{venue.neighborhood ? ` · ${venue.neighborhood}` : ""}
                  </p>
                </div>
                <div
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/20 hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 transition-all"
                >
                  <Plus size={12} weight="bold" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Quick-start prompts (shown when no anchor and not searching) */}
        {!isSearching && !hasAnchor && (
          <div className="space-y-2 py-2">
            <p className="text-[11px] text-white/25 font-mono px-1">Try searching for</p>
            {[
              { label: "Restaurants nearby", query: "restaurant" },
              { label: "Bars & cocktail spots", query: "bar" },
              { label: "Coffee shops", query: "coffee" },
              { label: "Live music venues", query: "music" },
            ].map((hint) => (
              <button
                key={hint.query}
                onClick={() => setSearchQuery(hint.query)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
              >
                <div
                  className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
                >
                  <MagnifyingGlass size={12} className="text-white/30" />
                </div>
                <span className="text-[12px] text-white/40" style={{ fontFamily: "var(--font-outfit)" }}>
                  {hint.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Smart suggestions (shown when not searching and anchor exists) */}
        {!isSearching && hasAnchor && (
          <>
            {/* Before / After toggle */}
            <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg mb-2">
              <button
                onClick={() => setActiveSlot("before")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeSlot === "before"
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Before ({beforeSuggestions.length})
              </button>
              <button
                onClick={() => setActiveSlot("after")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeSlot === "after"
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                After ({afterSuggestions.length})
              </button>
            </div>

            {suggestionsLoading && (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            )}

            {!suggestionsLoading && filteredSuggestions.length === 0 && (
              <p className="text-center text-xs text-white/30 py-6">
                No suggestions found nearby
              </p>
            )}

            {!suggestionsLoading && filteredSuggestions.map((s) => {
              return (
                <button
                  key={`${s.type}-${s.id}`}
                  onClick={() => handleAddSuggestion(s)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div
                    className="shrink-0 w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)" }}
                  >
                    {s.image_url ? (
                      <SmartImage
                        src={s.image_url}
                        alt={s.title}
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <CategoryIcon type={s.venue?.venue_type || s.category} size={16} glow="subtle" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-medium truncate"
                      style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)" }}
                    >
                      {s.title}
                    </p>
                    <p
                      className="text-[10px] truncate"
                      style={{ color: "var(--muted)", opacity: 0.5, fontFamily: "var(--font-mono)" }}
                    >
                      {s.category} · {s.walking_minutes} min walk
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--muted)", opacity: 0.4, fontFamily: "var(--font-mono)" }}
                    >
                      {s.suggested_time}
                    </span>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white/20 hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 transition-all"
                    >
                      <Plus size={12} weight="bold" />
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Custom stop section */}
        <div className="mt-3 pt-3 border-t border-white/5">
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.03] transition-all"
              style={{ border: "1px dashed rgba(255, 255, 255, 0.08)" }}
            >
              <Plus size={13} />
              Add custom stop
            </button>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">Custom stop</span>
                <button
                  onClick={() => { setShowCustomForm(false); setShowCustomExtras(false); }}
                  className="text-white/30 hover:text-white/50 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Title input */}
              <input
                type="text"
                placeholder="Stop name (required)"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder:text-white/25 outline-none bg-white/[0.04] border border-white/[0.06] focus:border-[var(--neon-cyan)]/30 transition-colors"
                autoFocus
              />

              {/* Duration picker */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/40 shrink-0">Duration</span>
                <div className="flex gap-1">
                  {[30, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCustomDuration(mins)}
                      className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                        customDuration === mins
                          ? "bg-white/10 text-white"
                          : "bg-white/[0.03] text-white/30 hover:text-white/50"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional extras toggle */}
              <button
                onClick={() => setShowCustomExtras(!showCustomExtras)}
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/50 transition-colors"
              >
                <CaretDown
                  size={10}
                  style={{
                    transform: showCustomExtras ? "rotate(0)" : "rotate(-90deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
                More details
              </button>

              {showCustomExtras && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Address (optional)"
                    value={customAddress}
                    onChange={(e) => setCustomAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder:text-white/25 outline-none bg-white/[0.04] border border-white/[0.06] focus:border-[var(--neon-cyan)]/30 transition-colors"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder:text-white/25 outline-none bg-white/[0.04] border border-white/[0.06] focus:border-[var(--neon-cyan)]/30 transition-colors resize-none"
                  />
                </div>
              )}

              {/* Add button */}
              <button
                onClick={handleAddCustom}
                disabled={!customTitle.trim()}
                className="w-full py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: customTitle.trim() ? "rgba(0, 212, 232, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  color: customTitle.trim() ? "var(--neon-cyan)" : "var(--muted)",
                  border: `1px solid ${customTitle.trim() ? "rgba(0, 212, 232, 0.25)" : "rgba(255, 255, 255, 0.06)"}`,
                }}
              >
                Add stop
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

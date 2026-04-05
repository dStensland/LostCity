"use client";

import { memo, useState, useDeferredValue, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type ProgramWithVenue,
  type ProgramType,
  type CostPeriod,
} from "@/lib/types/programs";
import { isAgeMatch, type KidProfile } from "@/lib/types/kid-profiles";
import { ACTIVITY_TAGS, type ActivityTagKey } from "@/lib/family-constants";
import type { GenericFilter } from "./KidFilterChips";
import { ProgramDetailSheet } from "./ProgramDetailSheet";
import { ProgramCard } from "./ProgramCard";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { buildExploreUrl } from "@/lib/find-url";

// ---- Palette ---------------------------------------------------------------

const CARD_BG = FAMILY_TOKENS.card;
const SAGE = FAMILY_TOKENS.sage;
const AMBER = FAMILY_TOKENS.amber;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const BORDER = FAMILY_TOKENS.border;

// ---- Types -----------------------------------------------------------------

interface ProgramsBrowserProps {
  portalSlug: string;
  activeKidIds?: string[];
  kids?: KidProfile[];
  activeGenericFilters?: GenericFilter[];
}

type CategoryFilter = "all" | "camps" | "enrichment" | "leagues" | "classes";

const CATEGORY_PILLS: Array<{ id: CategoryFilter; label: string; type?: ProgramType }> = [
  { id: "all", label: "All" },
  { id: "camps", label: "Camps", type: "camp" },
  { id: "enrichment", label: "Enrichment", type: "enrichment" },
  { id: "leagues", label: "Leagues", type: "league" },
  { id: "classes", label: "Classes", type: "class" },
];

// Only show a curated subset of activity tags in the filter row —
// those most likely to have data and be actionable for parents.
const FILTER_ACTIVITY_TAGS: ActivityTagKey[] = [
  "sports",
  "arts",
  "stem",
  "swimming",
  "music",
  "theater",
  "dance",
  "coding",
  "gymnastics",
  "nature",
  "cooking",
];

// ---- Cost filter ----------------------------------------------------------

type CostFilter = "free" | "under_50" | "under_100" | "under_200" | "any";

interface CostFilterOption {
  id: CostFilter;
  label: string;
  /** Max weekly cost (null = no limit, 0 = free only). */
  maxWeekly: number | null;
}

const COST_FILTER_OPTIONS: CostFilterOption[] = [
  { id: "any",      label: "Any price",    maxWeekly: null },
  { id: "free",     label: "Free",         maxWeekly: 0 },
  { id: "under_50", label: "Under $50/wk", maxWeekly: 50 },
  { id: "under_100",label: "Under $100/wk",maxWeekly: 100 },
  { id: "under_200",label: "Under $200/wk",maxWeekly: 200 },
];

/**
 * Normalize a cost to a per-week equivalent for comparison.
 * Returns null if cost is null (treated as free/unknown — passes through).
 */
function normalizeToWeekly(
  amount: number | null,
  period: CostPeriod | null
): number | null {
  if (amount === null) return null;
  if (amount === 0) return 0;
  switch (period) {
    case "per_week":    return amount;
    case "per_session": return amount; // treat session ≈ week (conservative estimate)
    case "per_month":   return amount / 4;
    case "per_season":  return amount / 12; // ~12 weeks per season
    default:            return amount; // unknown period — use raw amount
  }
}

/** Returns true if the program passes the cost filter. */
function matchesCostFilter(program: ProgramWithVenue, filter: CostFilter): boolean {
  if (filter === "any") return true;
  const weeklyEquiv = normalizeToWeekly(program.cost_amount, program.cost_period);
  if (filter === "free") {
    // Free = cost is null, 0, or genuinely $0
    return weeklyEquiv === null || weeklyEquiv === 0;
  }
  const max = COST_FILTER_OPTIONS.find((o) => o.id === filter)?.maxWeekly ?? null;
  if (max === null) return true;
  // Null cost passes through (don't exclude programs with unknown cost)
  if (weeklyEquiv === null) return true;
  return weeklyEquiv <= max;
}

// ---- Commitment filter ----------------------------------------------------

type CommitmentFilter = "drop_in" | "half_day" | "full_day" | "multi_day" | "any";

interface CommitmentFilterOption {
  id: CommitmentFilter;
  label: string;
  description: string;
}

const COMMITMENT_FILTER_OPTIONS: CommitmentFilterOption[] = [
  { id: "any",       label: "Any",       description: "Show all" },
  { id: "drop_in",   label: "Drop-in",   description: "1–3 hours" },
  { id: "half_day",  label: "Half day",  description: "3–5 hours" },
  { id: "full_day",  label: "Full day",  description: "6–8 hours" },
  { id: "multi_day", label: "Multi-day", description: "Multiple days" },
];

/**
 * Compute session duration in hours from HH:MM:SS strings.
 * Returns null if either time is missing.
 */
function sessionDurationHours(
  startTime: string | null,
  endTime: string | null
): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins <= startMins) return null; // overnight or bad data
  return (endMins - startMins) / 60;
}

/** Returns true if the program spans multiple calendar days. */
function isMultiDay(program: ProgramWithVenue): boolean {
  if (!program.session_start || !program.session_end) return false;
  return program.session_start !== program.session_end;
}

/** Returns true if the program passes the commitment filter. */
function matchesCommitmentFilter(
  program: ProgramWithVenue,
  filter: CommitmentFilter
): boolean {
  if (filter === "any") return true;

  // Multi-day: spans multiple calendar days (camps, week-long programs)
  if (filter === "multi_day") {
    return isMultiDay(program);
  }

  const hours = sessionDurationHours(
    program.schedule_start_time,
    program.schedule_end_time
  );

  // If we can't determine duration, pass through to avoid over-filtering
  if (hours === null) return true;

  switch (filter) {
    case "drop_in":  return hours <= 3;
    case "half_day": return hours > 3 && hours <= 5.5;
    case "full_day": return hours > 5.5;
    default:         return true;
  }
}

// ---- Data fetcher ----------------------------------------------------------

async function fetchPrograms(
  portalSlug: string,
  type: ProgramType | "",
  tag: ActivityTagKey | "",
  environment: "indoor" | "outdoor" | "",
  costFilter: CostFilter
): Promise<ProgramWithVenue[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "100", active: "true" });
  if (type) params.set("type", type);
  if (tag) params.set("tag", tag);
  if (environment) params.set("environment", environment);

  // Pass free/cost_max to the API to reduce payload size.
  // Client-side filter handles the nuance; the API param is a coarse pre-filter.
  const costOpt = COST_FILTER_OPTIONS.find((o) => o.id === costFilter);
  if (costFilter === "free") {
    params.set("cost_max", "0");
  } else if (costOpt?.maxWeekly != null) {
    // Use a generous multiplier since we normalize periods client-side —
    // a "per_season" cost will be much higher than the weekly threshold.
    params.set("cost_max", String(costOpt.maxWeekly * 20));
  }

  const res = await fetch(`/api/programs?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.programs ?? []) as ProgramWithVenue[];
}

// ---- Filter Sheet ----------------------------------------------------------

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeCostFilter: CostFilter;
  onCostChange: (v: CostFilter) => void;
  activeCommitment: CommitmentFilter;
  onCommitmentChange: (v: CommitmentFilter) => void;
  externalFreeActive: boolean;
  onClear: () => void;
}

function FilterSheet({
  isOpen,
  onClose,
  activeCostFilter,
  onCostChange,
  activeCommitment,
  onCommitmentChange,
  externalFreeActive,
  onClear,
}: FilterSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasActive = (activeCostFilter !== "any" && !externalFreeActive) || activeCommitment !== "any";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter programs"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: CARD_BG,
          borderTop: `1px solid ${BORDER}`,
          borderRadius: "20px 20px 0 0",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 20px 12px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
              fontSize: 17,
              fontWeight: 700,
              color: TEXT,
            }}
          >
            Filters
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${BORDER}`,
              backgroundColor: CARD_BG,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: MUTED,
              fontSize: 14,
            }}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "0 20px 8px" }}>
          {/* Cost */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: MUTED,
                marginBottom: 8,
              }}
            >
              Cost
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {COST_FILTER_OPTIONS.map((opt) => {
                // Suppress "Free" pill when external chip is active
                if (opt.id === "free" && externalFreeActive) return null;
                const isActive = activeCostFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onCostChange(opt.id)}
                    aria-pressed={isActive}
                    style={{
                      borderRadius: 20,
                      padding: "7px 14px",
                      fontSize: 13,
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      border: isActive ? `1.5px solid ${SAGE}` : `1px solid ${BORDER}`,
                      backgroundColor: isActive ? `${SAGE}14` : CARD_BG,
                      color: isActive ? SAGE : MUTED,
                      transition: "all 0.15s",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Commitment */}
          <div style={{ marginBottom: 8 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: MUTED,
                marginBottom: 8,
              }}
            >
              Time commitment
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {COMMITMENT_FILTER_OPTIONS.map((opt) => {
                const isActive = activeCommitment === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onCommitmentChange(opt.id)}
                    aria-pressed={isActive}
                    title={opt.description}
                    style={{
                      borderRadius: 20,
                      padding: "7px 14px",
                      fontSize: 13,
                      fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      border: isActive ? `1.5px solid ${AMBER}` : `1px solid ${BORDER}`,
                      backgroundColor: isActive ? `${AMBER}14` : CARD_BG,
                      color: isActive ? AMBER : MUTED,
                      transition: "all 0.15s",
                    }}
                  >
                    {opt.label}
                    {opt.id !== "any" && (
                      <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>
                        {opt.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "12px 20px",
            display: "flex",
            gap: 10,
          }}
        >
          {hasActive && (
            <button
              onClick={() => { onClear(); }}
              style={{
                flex: 1,
                padding: "11px 0",
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
                backgroundColor: CARD_BG,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 13,
                fontWeight: 600,
                color: MUTED,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 2,
              padding: "11px 0",
              borderRadius: 14,
              border: "none",
              backgroundColor: SAGE,
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 13,
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Main component --------------------------------------------------------

export const ProgramsBrowser = memo(function ProgramsBrowser({
  portalSlug,
  activeKidIds = [],
  kids = [],
  activeGenericFilters = [],
}: ProgramsBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeTag, setActiveTag] = useState<ActivityTagKey | "">("");
  const [matchingOnly, setMatchingOnly] = useState(false);
  const [searchQuery] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithVenue | null>(null);
  const [activeCostFilter, setActiveCostFilter] = useState<CostFilter>("any");
  const [activeCommitment, setActiveCommitment] = useState<CommitmentFilter>("any");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);

  // Resolve selected kids
  const selectedKids =
    activeKidIds.length > 0 ? kids.filter((k) => activeKidIds.includes(k.id)) : [];

  // Map category pill to ProgramType
  const activeType =
    CATEGORY_PILLS.find((p) => p.id === activeCategory)?.type ?? "";

  // Derive environment filter from generic chips
  const activeEnvironment: "indoor" | "outdoor" | "" =
    activeGenericFilters.includes("indoor") ? "indoor" :
    activeGenericFilters.includes("outdoor") ? "outdoor" :
    "";

  // Sync "Free" generic chip → cost filter
  // When parent passes "free" in activeGenericFilters, override the cost filter.
  const effectiveCostFilter: CostFilter =
    activeGenericFilters.includes("free") ? "free" : activeCostFilter;

  // Count of active sheet filters (cost + commitment), for the badge on the Filters button.
  // Exclude effectiveCostFilter from external "free" chip (that's the chip's job, not the sheet's).
  const activeFilterCount =
    (activeCostFilter !== "any" && !activeGenericFilters.includes("free") ? 1 : 0) +
    (activeCommitment !== "any" ? 1 : 0);

  const { data: programs, isLoading } = useQuery({
    queryKey: ["family-programs", portalSlug, activeType, activeTag, activeEnvironment, effectiveCostFilter],
    queryFn: () => fetchPrograms(portalSlug, activeType, activeTag, activeEnvironment, effectiveCostFilter),
    staleTime: 2 * 60 * 1000,
  });

  const allResults = programs ?? [];

  // Text search (deferred)
  let results = deferredQuery.trim()
    ? allResults.filter(
        (p) =>
          p.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
          (p.provider_name ?? "").toLowerCase().includes(deferredQuery.toLowerCase())
      )
    : allResults;

  // Cost filter (client-side — handles period normalization the API can't)
  results = results.filter((p) => matchesCostFilter(p, effectiveCostFilter));

  // Commitment/duration filter (client-side — depends on time fields)
  if (activeCommitment !== "any") {
    // For multi-day, only filter programs that span multiple days (have session data).
    // For time-based filters, pass through programs with no time data.
    results = results.filter((p) => matchesCommitmentFilter(p, activeCommitment));
  }

  // Kid age filtering
  if (selectedKids.length > 0 && (matchingOnly || activeKidIds.length > 0)) {
    results = results.filter((p) =>
      selectedKids.some((kid) => isAgeMatch(kid.age, p.age_min, p.age_max))
    );
  }

  // Count for match display
  const matchCount = results.length;

  // Derive age range label from selected kids
  const ageRangeLabel =
    selectedKids.length === 1
      ? `${selectedKids[0].age}'s age`
      : selectedKids.length > 1
      ? `${Math.min(...selectedKids.map((k) => k.age))}–${Math.max(...selectedKids.map((k) => k.age))}`
      : null;

  // For each result, find the first matching kid (for card accent color)
  function getMatchingKid(program: ProgramWithVenue): KidProfile | null {
    if (selectedKids.length === 0) return null;
    return (
      selectedKids.find((kid) => isAgeMatch(kid.age, program.age_min, program.age_max)) ?? null
    );
  }

  function handleTagClick(tagKey: ActivityTagKey) {
    setActiveTag((prev) => (prev === tagKey ? "" : tagKey));
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Sticky header — 2 rows + Filters button */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: CARD_BG,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {/* Row 1: Title + kid-match toggle + Filters button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 10px",
            gap: 8,
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
                fontSize: 28,
                fontWeight: 800,
                color: TEXT,
                lineHeight: 1.15,
              }}
            >
              Programs &amp; Camps
            </span>
            {!isLoading && (
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontSize: 12,
                  fontWeight: 400,
                  color: MUTED,
                  marginTop: 1,
                }}
              >
                {matchCount} program{matchCount !== 1 ? "s" : ""} near you
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Kid-match toggle — prominent on/off when kids are selected */}
            {selectedKids.length > 0 && (
              <button
                onClick={() => setMatchingOnly((v) => !v)}
                aria-label={matchingOnly ? "Show all programs" : `Show matches for ${selectedKids.map((k) => k.nickname).join(", ")}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 20,
                  border: `1.5px solid ${matchingOnly ? SAGE : BORDER}`,
                  backgroundColor: matchingOnly ? `${SAGE}14` : CARD_BG,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: matchingOnly ? SAGE : BORDER,
                    position: "relative",
                    transition: "background-color 0.18s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: matchingOnly ? 14 : 2,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: "white",
                      transition: "left 0.18s",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                    fontSize: 11,
                    fontWeight: matchingOnly ? 600 : 500,
                    color: matchingOnly ? SAGE : MUTED,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedKids.length === 1
                    ? `For ${selectedKids[0].nickname}`
                    : "For my kids"}
                </span>
              </button>
            )}

            {/* Filters button — opens sheet for cost + commitment */}
            <button
              onClick={() => setFilterSheetOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 20,
                border: activeFilterCount > 0 ? `1.5px solid ${SAGE}` : `1px solid ${BORDER}`,
                backgroundColor: activeFilterCount > 0 ? `${SAGE}14` : CARD_BG,
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: activeFilterCount > 0 ? 600 : 500,
                color: activeFilterCount > 0 ? SAGE : MUTED,
                transition: "all 0.15s",
              }}
            >
              {/* Sliders icon */}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="5" cy="4" r="2" fill={activeFilterCount > 0 ? SAGE : MUTED} />
                <circle cx="11" cy="8" r="2" fill={activeFilterCount > 0 ? SAGE : MUTED} />
                <circle cx="7" cy="12" r="2" fill={activeFilterCount > 0 ? SAGE : MUTED} />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: SAGE,
                    color: "white",
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Category pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "0 20px 10px",
            scrollbarWidth: "none",
          }}
        >
          {CATEGORY_PILLS.map((pill) => {
            const isActive = activeCategory === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveCategory(pill.id)}
                style={{
                  flexShrink: 0,
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 14,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontWeight: 500,
                  border: isActive ? "none" : `1px solid ${BORDER}`,
                  backgroundColor: isActive ? SAGE : CARD_BG,
                  color: isActive ? "white" : TEXT,
                  cursor: "pointer",
                  transition: "background-color 0.15s, color 0.15s",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Row 3: Activity tag pills */}
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "0 20px 10px",
            scrollbarWidth: "none",
          }}
        >
          {FILTER_ACTIVITY_TAGS.map((tagKey) => {
            const tag = ACTIVITY_TAGS[tagKey];
            const isActive = activeTag === tagKey;
            return (
              <button
                key={tagKey}
                onClick={() => handleTagClick(tagKey)}
                aria-pressed={isActive}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 20,
                  padding: "4px 11px",
                  fontSize: 12,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
                  border: isActive
                    ? `1.5px solid ${tag.color}`
                    : `1px solid ${BORDER}`,
                  backgroundColor: isActive ? `${tag.color}14` : CARD_BG,
                  color: isActive ? tag.color : MUTED,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>{tag.icon}</span>
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter sheet — Cost + Commitment */}
      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        activeCostFilter={effectiveCostFilter}
        onCostChange={setActiveCostFilter}
        activeCommitment={activeCommitment}
        onCommitmentChange={setActiveCommitment}
        externalFreeActive={activeGenericFilters.includes("free")}
        onClear={() => {
          setActiveCostFilter("any");
          setActiveCommitment("any");
        }}
      />

      {/* Age filter row + match count */}
      {selectedKids.length > 0 && (
        <div style={{ padding: "10px 20px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Age chip row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                color: MUTED,
              }}
            >
              Ages:
            </span>
            {selectedKids.map((kid) => (
              <span
                key={kid.id}
                style={{
                  borderRadius: 14,
                  padding: "2px 10px",
                  fontSize: 12,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontWeight: 500,
                  backgroundColor: `${kid.color}15`,
                  border: `1px solid ${kid.color}30`,
                  color: kid.color,
                }}
              >
                {kid.age} · {kid.nickname}
              </span>
            ))}
          </div>

          {/* Match count */}
          {ageRangeLabel && (
            <span
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                color: MUTED,
              }}
            >
              {matchCount} program{matchCount !== 1 ? "s" : ""} match{matchCount === 1 ? "es" : ""}{" "}
              {selectedKids.length === 1
                ? `${selectedKids[0].nickname}'s age`
                : "your kids' ages"}
            </span>
          )}
        </div>
      )}

      {/* Card list */}
      <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 10, maxWidth: 680 }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 120,
                  borderRadius: 14,
                  backgroundColor: BORDER,
                  opacity: 0.5,
                }}
                className="skeleton-shimmer"
              />
            ))}
          </>
        ) : results.length > 0 ? (
          results.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              accentColor={getMatchingKid(program)?.color}
              onClick={() => setSelectedProgram(program)}
            />
          ))
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 16,
                fontWeight: 500,
                color: SAGE,
                marginBottom: 8,
              }}
            >
              {activeTag
                ? `No ${ACTIVITY_TAGS[activeTag].label.toLowerCase()} programs found`
                : activeCategory !== "all"
                ? `No ${CATEGORY_PILLS.find((p) => p.id === activeCategory)?.label.toLowerCase() ?? activeCategory} programs found`
                : effectiveCostFilter !== "any"
                ? "No programs match this price filter"
                : activeCommitment !== "any"
                ? "No programs match this time commitment"
                : "No programs found"}
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 14,
                color: MUTED,
                opacity: 0.6,
                marginTop: 0,
              }}
            >
              {activeTag || effectiveCostFilter !== "any" || activeCommitment !== "any"
                ? "Try adjusting or clearing your filters"
                : "Try a different category or check back soon"}
            </p>
            {(activeTag || effectiveCostFilter !== "any" || activeCommitment !== "any") ? (
              <button
                onClick={() => {
                  setActiveTag("");
                  setActiveCostFilter("any");
                  setActiveCommitment("any");
                }}
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  padding: "10px 24px",
                  backgroundColor: SAGE,
                  color: "white",
                  borderRadius: 12,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontWeight: 600,
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            ) : (
              <a
                href={buildExploreUrl({
                  portalSlug,
                  lane: "events",
                  categories: "family,community",
                })}
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  padding: "10px 24px",
                  backgroundColor: SAGE,
                  color: "white",
                  borderRadius: 12,
                  fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Browse family events instead
              </a>
            )}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <ProgramDetailSheet
        program={selectedProgram}
        onClose={() => setSelectedProgram(null)}
        portalSlug={portalSlug}
        matchingKid={selectedProgram ? getMatchingKid(selectedProgram) : null}
      />
    </div>
  );
});

export type { ProgramsBrowserProps };

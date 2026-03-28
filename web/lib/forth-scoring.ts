/**
 * Per-hotel concierge scoring for FORTH feed.
 *
 * Replaces the old proximity-only scoreDestination() with a two-tier model:
 *   Tier 1: Citywide significance signals (touring, festival, championship, etc.)
 *   Tier 2: Per-hotel proximity + category boosts from scoring_config JSONB
 *
 * Daypart weighting:
 *   Morning/Afternoon: proximity * 1.5 + significance * 0.5
 *   Evening/Late Night: significance * 1.5 + proximity * 0.5
 *
 * Editorial pins (+100) come from portal_section_items — the section
 * assembler checks those separately; this function scores unpinned events.
 */

import type { DayPart } from "./forth-types";
import type { ProximityTier } from "./geo";

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export interface ScoringConfigProximity {
  walkable: number;
  close: number;
  far: number;
}

export interface ScoringConfig {
  proximity: ScoringConfigProximity;
  neighborhood_boost: number;
  category_boosts: Record<string, number>;
  suppress_categories: string[];
}

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  proximity: { walkable: 80, close: 25, far: 15 },
  neighborhood_boost: 20,
  category_boosts: {},
  suppress_categories: ["support", "religious"],
};

export function parseScoringConfig(raw: Record<string, unknown> | null | undefined): ScoringConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_SCORING_CONFIG;
  const prox = (raw.proximity && typeof raw.proximity === "object")
    ? (raw.proximity as Partial<ScoringConfigProximity>)
    : {};
  return {
    proximity: {
      walkable: typeof prox.walkable === "number" ? prox.walkable : DEFAULT_SCORING_CONFIG.proximity.walkable,
      close:    typeof prox.close    === "number" ? prox.close    : DEFAULT_SCORING_CONFIG.proximity.close,
      far:      typeof prox.far      === "number" ? prox.far      : DEFAULT_SCORING_CONFIG.proximity.far,
    },
    neighborhood_boost: typeof raw.neighborhood_boost === "number"
      ? raw.neighborhood_boost
      : DEFAULT_SCORING_CONFIG.neighborhood_boost,
    category_boosts: (raw.category_boosts && typeof raw.category_boosts === "object" && !Array.isArray(raw.category_boosts))
      ? Object.fromEntries(
          Object.entries(raw.category_boosts as Record<string, unknown>)
            .filter(([, v]) => typeof v === "number")
        ) as Record<string, number>
      : {},
    suppress_categories: Array.isArray(raw.suppress_categories)
      ? (raw.suppress_categories as string[])
      : DEFAULT_SCORING_CONFIG.suppress_categories,
  };
}

// ---------------------------------------------------------------------------
// Scorable event shape — subset of DbEvent needed by scoring
// ---------------------------------------------------------------------------

export interface ScoringEvent {
  id: number;
  category_id: string | null;
  significance?: string | null;
  significance_signals?: string[] | null;
  image_url?: string | null;
  is_tentpole?: boolean | null;
  venue?: {
    neighborhood: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Tier 1: Citywide significance score
// ---------------------------------------------------------------------------

const SIGNAL_POINTS: Record<string, number> = {
  touring:       8,
  festival:      8,
  championship:  8,
  large_venue:   5,
  limited_run:   5,
  opening:       5,
};

const SIGNAL_CAP = 25;

function significanceScore(event: ScoringEvent): number {
  let score = 0;

  if (event.is_tentpole)                     score += 35;
  else if (event.significance === "high")    score += 30;
  else if (event.significance === "medium")  score += 22;

  if (event.significance_signals && event.significance_signals.length > 0) {
    const signalBonus = event.significance_signals.reduce(
      (sum, signal) => sum + (SIGNAL_POINTS[signal] ?? 0),
      0,
    );
    score += Math.min(SIGNAL_CAP, signalBonus);
  }

  if (event.image_url) score += 5;

  return score;
}

// ---------------------------------------------------------------------------
// Tier 2: Per-hotel proximity + category boost
// ---------------------------------------------------------------------------

function proximityScore(
  proximityTier: ProximityTier,
  config: ScoringConfig,
  eventNeighborhood: string | null,
  hotelNeighborhood: string,
): number {
  let score = 0;

  if (proximityTier === "walkable")            score += config.proximity.walkable;
  else if (proximityTier === "close")          score += config.proximity.close;
  else /* "destination" or unknown */          score += config.proximity.far;

  if (eventNeighborhood && eventNeighborhood === hotelNeighborhood) {
    score += config.neighborhood_boost;
  }

  return score;
}

function categoryBoost(event: ScoringEvent, config: ScoringConfig): number {
  if (!event.category_id) return 0;
  return config.category_boosts[event.category_id] ?? 0;
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Score an event for the FORTH concierge feed.
 *
 * @param event         - Event with significance fields.
 * @param portal        - Portal record with scoring_config and neighborhood.
 * @param proximityTier - Pre-computed proximity tier from geo.ts.
 * @param daypart       - Current daypart for weighting.
 * @returns             - Numeric score. Higher = rank higher in the section.
 *                        Returns -1 for suppressed categories.
 */
export function scoreForConcierge(
  event: ScoringEvent,
  portal: {
    scoring_config: Record<string, unknown> | null | undefined;
    neighborhood: string;
  },
  proximityTier: ProximityTier,
  daypart: DayPart,
): number {
  const config = parseScoringConfig(portal.scoring_config);

  // Suppress categories entirely
  if (event.category_id && config.suppress_categories.includes(event.category_id)) {
    return -1;
  }

  const sigScore  = significanceScore(event);
  const proxScore = proximityScore(
    proximityTier,
    config,
    event.venue?.neighborhood ?? null,
    portal.neighborhood,
  );
  const catBoost = categoryBoost(event, config);

  let blendedScore: number;
  if (daypart === "morning" || daypart === "afternoon") {
    // Proximity-first: guests want nearby, accessible things
    blendedScore = proxScore * 1.5 + sigScore * 0.5;
  } else {
    // Evening/late night: significance-first; big events beat distance
    blendedScore = sigScore * 1.5 + proxScore * 0.5;
  }

  return blendedScore + catBoost;
}

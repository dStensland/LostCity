import type { DayPart, FeedEvent, FeedSection } from "@/lib/forth-types";
import { dedupeConciergeEvents, scoreEventForConcierge } from "@/lib/concierge/event-relevance";

type ConciergeContentPolicySettings = {
  strict_mode?: boolean;
  around_min_score?: number;
  around_tonight_min_score?: number;
  planner_min_score?: number;
  min_events_per_section?: number;
  min_tonight_events?: number;
  excluded_categories?: string[];
  excluded_keywords?: string[];
};

type NormalizedPolicy = {
  strictMode: boolean;
  aroundMinScore: number;
  aroundTonightMinScore: number;
  plannerMinScore: number;
  minEventsPerSection: number;
  minTonightEvents: number;
  excludedCategories: Set<string>;
  excludedKeywords: string[];
};

type ScoredEvent = FeedEvent & { _score: number };

export type ConciergePolicyResult = {
  aroundSections: FeedSection[];
  plannerSections: FeedSection[];
};

export type ConciergePolicyPortal = {
  settings?: Record<string, unknown> | null;
};

const DEFAULT_POLICY: NormalizedPolicy = {
  strictMode: true,
  aroundMinScore: -0.2,
  aroundTonightMinScore: 0.4,
  plannerMinScore: -1.1,
  minEventsPerSection: 4,
  minTonightEvents: 6,
  excludedCategories: new Set(["community", "learning"]),
  excludedKeywords: [
    "vaccine",
    "mobile clinic",
    "support group",
    "city council",
    "committee",
    "board meeting",
    "public hearing",
    "ordinance",
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePolicy(portal: ConciergePolicyPortal): NormalizedPolicy {
  const raw = portal.settings?.concierge_content_policy as ConciergeContentPolicySettings | undefined;

  const excludedCategories = Array.isArray(raw?.excluded_categories)
    ? new Set(raw!.excluded_categories.map((category) => category.toLowerCase().trim()).filter(Boolean))
    : DEFAULT_POLICY.excludedCategories;

  const excludedKeywords = Array.isArray(raw?.excluded_keywords)
    ? raw!.excluded_keywords.map((keyword) => keyword.toLowerCase().trim()).filter(Boolean)
    : DEFAULT_POLICY.excludedKeywords;

  return {
    strictMode: raw?.strict_mode ?? DEFAULT_POLICY.strictMode,
    aroundMinScore: typeof raw?.around_min_score === "number" ? raw.around_min_score : DEFAULT_POLICY.aroundMinScore,
    aroundTonightMinScore:
      typeof raw?.around_tonight_min_score === "number"
        ? raw.around_tonight_min_score
        : DEFAULT_POLICY.aroundTonightMinScore,
    plannerMinScore: typeof raw?.planner_min_score === "number" ? raw.planner_min_score : DEFAULT_POLICY.plannerMinScore,
    minEventsPerSection:
      typeof raw?.min_events_per_section === "number"
        ? clamp(Math.round(raw.min_events_per_section), 2, 12)
        : DEFAULT_POLICY.minEventsPerSection,
    minTonightEvents:
      typeof raw?.min_tonight_events === "number"
        ? clamp(Math.round(raw.min_tonight_events), 2, 16)
        : DEFAULT_POLICY.minTonightEvents,
    excludedCategories,
    excludedKeywords,
  };
}

function eventText(event: FeedEvent): string {
  return `${event.title || ""} ${event.description || ""}`.toLowerCase();
}

function isHardExcluded(event: FeedEvent, policy: NormalizedPolicy): boolean {
  const category = (event.category || "").toLowerCase();
  if (category && policy.excludedCategories.has(category)) {
    return true;
  }

  const combined = eventText(event);
  return policy.excludedKeywords.some((keyword) => combined.includes(keyword));
}

function scoreEvents(events: FeedEvent[], dayPart: DayPart): ScoredEvent[] {
  return dedupeConciergeEvents(events)
    .map((event) => ({ ...event, _score: scoreEventForConcierge(event, dayPart) }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      if ((a.distance_km ?? 999) !== (b.distance_km ?? 999)) return (a.distance_km ?? 999) - (b.distance_km ?? 999);
      return a.title.localeCompare(b.title);
    });
}

function pickEvents(
  events: FeedEvent[],
  dayPart: DayPart,
  policy: NormalizedPolicy,
  minScore: number,
  minCount: number,
): FeedEvent[] {
  const scored = scoreEvents(events, dayPart);
  if (scored.length === 0) return [];

  const eligible = policy.strictMode
    ? scored.filter((event) => !isHardExcluded(event, policy))
    : scored;

  const pool = eligible.length > 0 ? eligible : scored;

  const passing = pool.filter((event) => event._score >= minScore);
  const required = Math.min(minCount, pool.length);

  const selected = passing.length >= required
    ? passing
    : pool.slice(0, required);

  return selected.map((event) => {
    const { _score, ...rest } = event;
    void _score;
    return rest;
  });
}

function isTonightSection(section: FeedSection): boolean {
  const slug = (section.slug || "").toLowerCase();
  if (slug.includes("tonight") || slug.includes("today") || slug.includes("this-evening")) return true;

  const title = section.title.toLowerCase();
  return title.includes("tonight") || title.includes("today") || title.includes("evening");
}

export function applyConciergeContentPolicy(
  portal: ConciergePolicyPortal,
  sections: FeedSection[],
  dayPart: DayPart,
): ConciergePolicyResult {
  const policy = normalizePolicy(portal);

  const aroundSections = sections
    .map((section) => {
      const sectionMinScore = isTonightSection(section)
        ? policy.aroundTonightMinScore
        : policy.aroundMinScore;
      const minCount = isTonightSection(section)
        ? policy.minTonightEvents
        : policy.minEventsPerSection;

      const events = pickEvents(
        section.events,
        dayPart,
        policy,
        sectionMinScore,
        minCount,
      );

      if (events.length < 2) return null;
      return { ...section, events };
    })
    .filter((section): section is FeedSection => section !== null);

  const plannerSections = sections
    .map((section) => {
      const events = pickEvents(
        section.events,
        dayPart,
        {
          ...policy,
          strictMode: false,
        },
        policy.plannerMinScore,
        4,
      );

      if (events.length < 2) return null;
      return { ...section, events };
    })
    .filter((section): section is FeedSection => section !== null);

  return { aroundSections, plannerSections };
}

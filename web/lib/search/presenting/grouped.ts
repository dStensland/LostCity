import type { EntityType } from "@/lib/search/types";
import type { RankedCandidate } from "@/lib/search/ranking/types";
import type {
  Presenter,
  PresentationPolicy,
  PresentedResults,
} from "@/lib/search/presenting/types";

const TYPE_TITLES: Record<EntityType, string> = {
  event: "Events",
  venue: "Places",
  organizer: "Organizers",
  series: "Series",
  festival: "Festivals",
  exhibition: "Exhibitions",
  program: "Classes",
  neighborhood: "Neighborhoods",
  category: "Tags",
};

const SECTION_ORDER: EntityType[] = [
  "event",
  "venue",
  "series",
  "festival",
  "exhibition",
  "program",
  "organizer",
  "category",
  "neighborhood",
];

/**
 * GroupedPresenter builds the public response shape: a Top Matches rail
 * (cross-type interleaved, best-of-each) above per-type grouped sections.
 *
 * Dedup happens via policy.dedupeKey (default: "type:id"). Sections are
 * ordered by SECTION_ORDER and capped by policy.groupCaps. Per-type totals
 * track the true count (pre-cap) so the UI can show "Events · 15".
 */
export const GroupedPresenter: Presenter = {
  present(ranked: RankedCandidate[], policy: PresentationPolicy): PresentedResults {
    // Dedupe while preserving first-seen order
    const seen = new Set<string>();
    const deduped: RankedCandidate[] = [];
    for (const c of ranked) {
      const k = policy.dedupeKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(c);
    }

    // Top matches: first N candidates globally (already sorted by rank)
    const topMatches = deduped.slice(0, policy.topMatchesCount);

    // Group by type
    const byType = new Map<EntityType, RankedCandidate[]>();
    for (const c of deduped) {
      const list = byType.get(c.type) ?? [];
      list.push(c);
      byType.set(c.type, list);
    }

    const totals: Partial<Record<EntityType, number>> = {};
    for (const [type, list] of byType) {
      totals[type] = list.length;
    }

    // Section-order, capped per type
    const sections = SECTION_ORDER
      .filter((type) => byType.has(type))
      .map((type) => {
        const list = byType.get(type)!;
        const cap = policy.groupCaps[type] ?? list.length;
        return {
          type,
          title: TYPE_TITLES[type],
          items: list.slice(0, cap),
          total: list.length,
        };
      });

    return {
      topMatches,
      sections,
      totals,
      diagnostics: {
        total_ms: 0, // filled by orchestrator
        cache_hit: "miss",
        degraded: false,
        retriever_ms: {},
        result_type_counts: totals,
      },
    };
  },
};

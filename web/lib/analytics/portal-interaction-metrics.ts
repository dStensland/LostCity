import type { AnySupabase } from "@/lib/api-utils";
import {
  PORTAL_INTERACTION_ACTION_TYPES,
  type PortalInteractionActionType,
} from "@/lib/analytics/portal-action-types";

const PAGE_SIZE = 5000;
const REASON_CHIP_IMPRESSION_SECTION_KEY = "concierge_reason_chip_impression";
const QUICK_ADD_SECTION_PREFIX = "event_card_quick_add";
const BEST_BET_QUICK_ADD_SECTION_KEY = "best_bet_quick_add";
const CONCIERGE_BRIEF_QUICK_ADD_SECTION_KEY = "concierge_brief_quick_add";

function isQuickAddSection(sectionKey: string | null): boolean {
  if (!sectionKey) return false;
  return (
    sectionKey === BEST_BET_QUICK_ADD_SECTION_KEY ||
    sectionKey === CONCIERGE_BRIEF_QUICK_ADD_SECTION_KEY ||
    sectionKey.startsWith(QUICK_ADD_SECTION_PREFIX)
  );
}

export const PORTAL_INTERACTION_ACTIONS = PORTAL_INTERACTION_ACTION_TYPES;

export type PortalInteractionAction = PortalInteractionActionType;

export type PortalInteractionRow = {
  portal_id: string;
  action_type: PortalInteractionAction;
  mode_context: string | null;
  section_key: string | null;
  target_kind: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type InteractionSummary = {
  total_interactions: number;
  mode_selected: number;
  wayfinding_opened: number;
  resource_clicked: number;
  wayfinding_open_rate: number;
  resource_click_rate: number;
  reason_chip_impressions: number;
  reason_chip_influenced_clicks: number;
  reason_chip_influenced_click_rate: number;
  reason_chip_impression_click_through_rate: number;
  conversion_action_rail_clicks: number;
  conversion_action_rail_click_rate: number;
  quick_add_attempts: number;
  quick_add_successes: number;
  quick_add_failures: number;
  quick_add_success_rate: number;
  quick_add_by_storage: Array<{ storage: string; count: number }>;
  conversion_action_rail_by_mode: Array<{
    mode: string;
    clicks: number;
    mode_selections: number;
    ctr: number | null;
  }>;
  conversion_action_rail_by_target_kind: Array<{ target_kind: string; clicks: number }>;
  mode_breakdown: Array<{ mode: string; count: number }>;
  interactions_by_day: Array<{ date: string; count: number }>;
};

export async function fetchPortalInteractionRows(
  supabase: AnySupabase,
  options: {
    portalIds: string[];
    startTimestamp: string;
    endTimestamp: string;
  }
): Promise<PortalInteractionRow[]> {
  const { portalIds, startTimestamp, endTimestamp } = options;
  if (portalIds.length === 0) return [];

  const rows: PortalInteractionRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("portal_interaction_events")
      .select("portal_id, action_type, mode_context, section_key, target_kind, metadata, created_at")
      .in("portal_id", portalIds)
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || "Failed to fetch portal interaction events");
    }

    const pageRows = ((data || []) as PortalInteractionRow[])
      .filter((row) => PORTAL_INTERACTION_ACTIONS.includes(row.action_type));

    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return rows;
}

export function summarizeInteractionRows(
  rows: PortalInteractionRow[],
  totalViews: number
): InteractionSummary {
  let modeSelected = 0;
  let wayfindingOpened = 0;
  let resourceClicked = 0;
  let reasonChipImpressions = 0;
  let reasonChipInfluencedClicks = 0;
  let conversionActionRailClicks = 0;
  let quickAddAttempts = 0;
  let quickAddSuccesses = 0;
  let quickAddFailures = 0;

  const modeCounts = new Map<string, number>();
  const modeSelectionCounts = new Map<string, number>();
  const conversionActionRailByMode = new Map<string, number>();
  const conversionActionRailByTargetKind = new Map<string, number>();
  const quickAddByStorage = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const row of rows) {
    const isReasonChipImpression = (
      row.action_type === "resource_clicked" &&
      row.section_key === REASON_CHIP_IMPRESSION_SECTION_KEY
    );

    if (row.action_type === "mode_selected") {
      modeSelected += 1;
      if (row.mode_context) {
        modeCounts.set(row.mode_context, (modeCounts.get(row.mode_context) || 0) + 1);
        modeSelectionCounts.set(row.mode_context, (modeSelectionCounts.get(row.mode_context) || 0) + 1);
      }
    } else if (row.action_type === "wayfinding_opened") {
      wayfindingOpened += 1;
    } else if (row.action_type === "resource_clicked") {
      if (isReasonChipImpression) {
        reasonChipImpressions += 1;
      } else {
        resourceClicked += 1;
        if (row.metadata && row.metadata.reason_chip_present === true) {
          reasonChipInfluencedClicks += 1;
        }
      }
    }

    if (
      row.section_key === "conversion_action_rail" &&
      (row.action_type === "resource_clicked" || row.action_type === "wayfinding_opened")
    ) {
      conversionActionRailClicks += 1;
      const mode = row.mode_context || "unknown";
      conversionActionRailByMode.set(mode, (conversionActionRailByMode.get(mode) || 0) + 1);

      const targetKind = row.target_kind || "unknown";
      conversionActionRailByTargetKind.set(
        targetKind,
        (conversionActionRailByTargetKind.get(targetKind) || 0) + 1
      );
    }

    if (
      row.action_type === "resource_clicked" &&
      row.target_kind === "itinerary_quick_add" &&
      isQuickAddSection(row.section_key)
    ) {
      const outcome = typeof row.metadata?.outcome === "string" ? row.metadata.outcome : "attempt";
      if (outcome === "success") {
        quickAddSuccesses += 1;
        const storage = typeof row.metadata?.storage === "string" ? row.metadata.storage : "unknown";
        quickAddByStorage.set(storage, (quickAddByStorage.get(storage) || 0) + 1);
      } else if (outcome === "error") {
        quickAddFailures += 1;
      } else {
        quickAddAttempts += 1;
      }
    }

    const day = row.created_at.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  const resolvedQuickAddAttempts = Math.max(
    quickAddAttempts,
    quickAddSuccesses + quickAddFailures
  );

  const totalInteractions = rows.length;
  const wayfindingOpenRate = totalViews > 0
    ? Number(((wayfindingOpened / totalViews) * 100).toFixed(2))
    : 0;
  const resourceClickRate = totalViews > 0
    ? Number(((resourceClicked / totalViews) * 100).toFixed(2))
    : 0;
  const reasonChipInfluencedClickRate = resourceClicked > 0
    ? Number(((reasonChipInfluencedClicks / resourceClicked) * 100).toFixed(2))
    : 0;
  const reasonChipImpressionClickThroughRate = reasonChipImpressions > 0
    ? Number(((reasonChipInfluencedClicks / reasonChipImpressions) * 100).toFixed(2))
    : 0;
  const conversionActionRailClickRate = totalViews > 0
    ? Number(((conversionActionRailClicks / totalViews) * 100).toFixed(2))
    : 0;
  const quickAddSuccessRate = resolvedQuickAddAttempts > 0
    ? Number(((quickAddSuccesses / resolvedQuickAddAttempts) * 100).toFixed(2))
    : 0;

  const conversionRailModes = new Set<string>([
    ...modeSelectionCounts.keys(),
    ...conversionActionRailByMode.keys(),
  ]);

  return {
    total_interactions: totalInteractions,
    mode_selected: modeSelected,
    wayfinding_opened: wayfindingOpened,
    resource_clicked: resourceClicked,
    wayfinding_open_rate: wayfindingOpenRate,
    resource_click_rate: resourceClickRate,
    reason_chip_impressions: reasonChipImpressions,
    reason_chip_influenced_clicks: reasonChipInfluencedClicks,
    reason_chip_influenced_click_rate: reasonChipInfluencedClickRate,
    reason_chip_impression_click_through_rate: reasonChipImpressionClickThroughRate,
    conversion_action_rail_clicks: conversionActionRailClicks,
    conversion_action_rail_click_rate: conversionActionRailClickRate,
    quick_add_attempts: resolvedQuickAddAttempts,
    quick_add_successes: quickAddSuccesses,
    quick_add_failures: quickAddFailures,
    quick_add_success_rate: quickAddSuccessRate,
    quick_add_by_storage: Array.from(quickAddByStorage.entries())
      .map(([storage, count]) => ({ storage, count }))
      .sort((a, b) => b.count - a.count || a.storage.localeCompare(b.storage)),
    conversion_action_rail_by_mode: Array.from(conversionRailModes.values())
      .map((mode) => {
        const clicks = conversionActionRailByMode.get(mode) || 0;
        const selections = modeSelectionCounts.get(mode) || 0;
        const ctr = selections > 0
          ? Number(((clicks / selections) * 100).toFixed(2))
          : null;
        return {
          mode,
          clicks,
          mode_selections: selections,
          ctr,
        };
      })
      .sort((a, b) => b.clicks - a.clicks || a.mode.localeCompare(b.mode)),
    conversion_action_rail_by_target_kind: Array.from(conversionActionRailByTargetKind.entries())
      .map(([target_kind, clicks]) => ({ target_kind, clicks }))
      .sort((a, b) => b.clicks - a.clicks || a.target_kind.localeCompare(b.target_kind)),
    mode_breakdown: Array.from(modeCounts.entries())
      .map(([mode, count]) => ({ mode, count }))
      .sort((a, b) => b.count - a.count),
    interactions_by_day: Array.from(dayCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function summarizeRowsByPortal(
  rows: PortalInteractionRow[]
): Map<
  string,
  Omit<
    InteractionSummary,
    "wayfinding_open_rate" |
    "resource_click_rate" |
    "reason_chip_influenced_click_rate" |
    "reason_chip_impression_click_through_rate" |
    "quick_add_success_rate"
  >
> {
  const byPortal = new Map<string, PortalInteractionRow[]>();

  for (const row of rows) {
    const current = byPortal.get(row.portal_id) || [];
    current.push(row);
    byPortal.set(row.portal_id, current);
  }

  const result = new Map<
    string,
    Omit<
      InteractionSummary,
      "wayfinding_open_rate" |
      "resource_click_rate" |
      "reason_chip_influenced_click_rate" |
      "reason_chip_impression_click_through_rate" |
      "quick_add_success_rate"
    >
  >();

  for (const [portalId, portalRows] of byPortal.entries()) {
    const summary = summarizeInteractionRows(portalRows, 0);
    result.set(portalId, {
      total_interactions: summary.total_interactions,
      mode_selected: summary.mode_selected,
      wayfinding_opened: summary.wayfinding_opened,
      resource_clicked: summary.resource_clicked,
      reason_chip_impressions: summary.reason_chip_impressions,
      reason_chip_influenced_clicks: summary.reason_chip_influenced_clicks,
      conversion_action_rail_clicks: summary.conversion_action_rail_clicks,
      conversion_action_rail_click_rate: summary.conversion_action_rail_click_rate,
      quick_add_attempts: summary.quick_add_attempts,
      quick_add_successes: summary.quick_add_successes,
      quick_add_failures: summary.quick_add_failures,
      quick_add_by_storage: summary.quick_add_by_storage,
      conversion_action_rail_by_mode: summary.conversion_action_rail_by_mode,
      conversion_action_rail_by_target_kind: summary.conversion_action_rail_by_target_kind,
      mode_breakdown: summary.mode_breakdown,
      interactions_by_day: summary.interactions_by_day,
    });
  }

  return result;
}

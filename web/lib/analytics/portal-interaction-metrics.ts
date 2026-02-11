import type { AnySupabase } from "@/lib/api-utils";

const PAGE_SIZE = 5000;

export const PORTAL_INTERACTION_ACTIONS = [
  "mode_selected",
  "wayfinding_opened",
  "resource_clicked",
] as const;

export type PortalInteractionAction = (typeof PORTAL_INTERACTION_ACTIONS)[number];

export type PortalInteractionRow = {
  portal_id: string;
  action_type: PortalInteractionAction;
  mode_context: string | null;
  created_at: string;
};

export type InteractionSummary = {
  total_interactions: number;
  mode_selected: number;
  wayfinding_opened: number;
  resource_clicked: number;
  wayfinding_open_rate: number;
  resource_click_rate: number;
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
      .select("portal_id, action_type, mode_context, created_at")
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

  const modeCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.action_type === "mode_selected") {
      modeSelected += 1;
      if (row.mode_context) {
        modeCounts.set(row.mode_context, (modeCounts.get(row.mode_context) || 0) + 1);
      }
    } else if (row.action_type === "wayfinding_opened") {
      wayfindingOpened += 1;
    } else if (row.action_type === "resource_clicked") {
      resourceClicked += 1;
    }

    const day = row.created_at.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  const totalInteractions = rows.length;
  const wayfindingOpenRate = totalViews > 0
    ? Number(((wayfindingOpened / totalViews) * 100).toFixed(2))
    : 0;
  const resourceClickRate = totalViews > 0
    ? Number(((resourceClicked / totalViews) * 100).toFixed(2))
    : 0;

  return {
    total_interactions: totalInteractions,
    mode_selected: modeSelected,
    wayfinding_opened: wayfindingOpened,
    resource_clicked: resourceClicked,
    wayfinding_open_rate: wayfindingOpenRate,
    resource_click_rate: resourceClickRate,
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
): Map<string, Omit<InteractionSummary, "wayfinding_open_rate" | "resource_click_rate">> {
  const byPortal = new Map<string, PortalInteractionRow[]>();

  for (const row of rows) {
    const current = byPortal.get(row.portal_id) || [];
    current.push(row);
    byPortal.set(row.portal_id, current);
  }

  const result = new Map<string, Omit<InteractionSummary, "wayfinding_open_rate" | "resource_click_rate">>();

  for (const [portalId, portalRows] of byPortal.entries()) {
    const summary = summarizeInteractionRows(portalRows, 0);
    result.set(portalId, {
      total_interactions: summary.total_interactions,
      mode_selected: summary.mode_selected,
      wayfinding_opened: summary.wayfinding_opened,
      resource_clicked: summary.resource_clicked,
      mode_breakdown: summary.mode_breakdown,
      interactions_by_day: summary.interactions_by_day,
    });
  }

  return result;
}

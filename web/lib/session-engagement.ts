import type { SupabaseClient } from "@supabase/supabase-js";

export type EngagementTarget = "event" | "festival_session";

export interface SessionEngagementContext {
  engagement_target: EngagementTarget;
  festival_id: string | null;
  program_id: string | null;
}

type SeriesRow = {
  id: string;
  series_type: string | null;
  festival_id: string | null;
};

const DEFAULT_CONTEXT: SessionEngagementContext = {
  engagement_target: "event",
  festival_id: null,
  program_id: null,
};

export function deriveSessionEngagementContext(
  series: SeriesRow | null | undefined
): SessionEngagementContext {
  if (!series) return DEFAULT_CONTEXT;

  if (series.series_type === "festival_program" && series.festival_id) {
    return {
      engagement_target: "festival_session",
      festival_id: series.festival_id,
      program_id: series.id,
    };
  }

  return DEFAULT_CONTEXT;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export async function resolveSessionEngagementContext(
  serviceClient: AnySupabaseClient,
  eventId: number
): Promise<SessionEngagementContext> {
  const { data: eventRow, error: eventError } = await serviceClient
    .from("events")
    .select("series_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !eventRow || !eventRow.series_id) {
    return DEFAULT_CONTEXT;
  }

  const { data: seriesRow, error: seriesError } = await serviceClient
    .from("series")
    .select("id, series_type, festival_id")
    .eq("id", eventRow.series_id)
    .maybeSingle();

  if (seriesError || !seriesRow) {
    return DEFAULT_CONTEXT;
  }

  return deriveSessionEngagementContext(seriesRow as SeriesRow);
}

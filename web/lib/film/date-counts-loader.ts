// web/lib/film/date-counts-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type DateCount = {
  date: string;
  count: number;
  hasPremiere: boolean;
};

type RawRow = { start_date: string; is_premiere: boolean };

export function summarizeDateCounts(
  rows: RawRow[],
  from: string,
  to: string,
): DateCount[] {
  const dates: string[] = [];
  const startMs = new Date(from + 'T00:00:00Z').getTime();
  const endMs = new Date(to + 'T00:00:00Z').getTime();
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  const byDate = new Map<string, { count: number; hasPremiere: boolean }>();
  for (const d of dates) byDate.set(d, { count: 0, hasPremiere: false });

  for (const r of rows) {
    const entry = byDate.get(r.start_date);
    if (!entry) continue;
    entry.count += 1;
    if (r.is_premiere) entry.hasPremiere = true;
  }

  return dates.map((d) => ({
    date: d,
    count: byDate.get(d)!.count,
    hasPremiere: byDate.get(d)!.hasPremiere,
  }));
}

// Inline portal-id resolver — matches pattern from this-week-loader.ts exactly
async function resolvePortalId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  portalSlug: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('portals')
    .select('id')
    .eq('slug', portalSlug)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(`resolvePortalId failed: ${error.message}`);
  if (!data) throw new Error(`Portal not found: ${portalSlug}`);

  const row = data as { id: string };
  return row.id;
}

export async function loadDateCounts(args: {
  portalSlug: string;
  from: string;
  to: string;
}): Promise<DateCount[]> {
  const supabase = await createClient();
  const portalId = await resolvePortalId(supabase, args.portalSlug);

  const { data, error } = await supabase
    .from('screening_times')
    .select(
      `start_date, screening_runs!inner (screening_titles!inner (is_premiere))`,
    )
    .gte('start_date', args.from)
    .lte('start_date', args.to)
    .eq('status', 'scheduled')
    .eq('screening_runs.portal_id', portalId);

  if (error) throw new Error(`loadDateCounts query failed: ${error.message}`);

  type RawJoinedRow = {
    start_date: string;
    screening_runs: {
      screening_titles: { is_premiere: boolean | null };
    } | null;
  };

  const rows: RawRow[] = (data as unknown as RawJoinedRow[]).map((r) => ({
    start_date: r.start_date,
    is_premiere: Boolean(r.screening_runs?.screening_titles?.is_premiere),
  }));

  return summarizeDateCounts(rows, args.from, args.to);
}

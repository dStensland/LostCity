"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/formats";

type FestivalRow = {
  id: string;
  name: string;
  slug: string;
  announced_start: string | null;
  announced_end: string | null;
  festival_type: string | null;
  location: string | null;
  neighborhood: string | null;
};

type ProgramRow = {
  id: string;
  festival_id: string | null;
};

type SessionRow = {
  id: number;
  series_id: string | null;
};

type FestivalDebugItem = FestivalRow & {
  programCount: number;
  sessionCount: number;
};

export default function FestivalDebugPanel({ portalSlug }: { portalSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FestivalDebugItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadFestivals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = getLocalDateString();
      const { data: festivals, error: festivalsError } = await supabase
        .from("festivals")
        .select("id, name, slug, festival_type, announced_start, announced_end, location, neighborhood")
        .lte("announced_start", today)
        .or(`announced_end.gte.${today},announced_end.is.null`)
        .order("announced_start", { ascending: true });

      if (festivalsError) {
        throw festivalsError;
      }

      const festivalRows = (festivals || []) as FestivalRow[];
      if (festivalRows.length === 0) {
        setItems([]);
        setLastUpdated(new Date().toLocaleTimeString());
        return;
      }

      const festivalIds = festivalRows.map((f) => f.id);
      const { data: programs, error: programsError } = await supabase
        .from("series")
        .select("id, festival_id")
        .in("festival_id", festivalIds)
        .eq("series_type", "festival_program")
        .eq("is_active", true);

      if (programsError) {
        throw programsError;
      }

      const programRows = (programs || []) as ProgramRow[];
      const programIds = programRows.map((p) => p.id);
      const programToFestival = new Map<string, string>();
      programRows.forEach((p) => {
        if (p.id && p.festival_id) {
          programToFestival.set(p.id, p.festival_id);
        }
      });

      let sessionRows: SessionRow[] = [];
      if (programIds.length > 0) {
        const { data: sessions, error: sessionsError } = await supabase
          .from("events")
          .select("id, series_id")
          .in("series_id", programIds)
          .gte("start_date", today)
          .is("canonical_event_id", null);

        if (sessionsError) {
          throw sessionsError;
        }

        sessionRows = (sessions || []) as SessionRow[];
      }

      const programCountByFestival = new Map<string, number>();
      programRows.forEach((program) => {
        if (!program.festival_id) return;
        programCountByFestival.set(
          program.festival_id,
          (programCountByFestival.get(program.festival_id) || 0) + 1
        );
      });

      const sessionCountByFestival = new Map<string, number>();
      sessionRows.forEach((session) => {
        if (!session.series_id) return;
        const festivalId = programToFestival.get(session.series_id);
        if (!festivalId) return;
        sessionCountByFestival.set(
          festivalId,
          (sessionCountByFestival.get(festivalId) || 0) + 1
        );
      });

      const enriched = festivalRows.map((festival) => ({
        ...festival,
        programCount: programCountByFestival.get(festival.id) || 0,
        sessionCount: sessionCountByFestival.get(festival.id) || 0,
      }));

      setItems(enriched);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load festivals";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadFestivals();
  }, [loadFestivals]);

  const todayLabel = getLocalDateString();

  return (
    <section className="mb-6 rounded-xl border border-[var(--twilight)] bg-[var(--dusk)]/60 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--neon-amber)] shadow-[0_0_8px_var(--neon-amber)]" />
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--neon-amber)]">
            Festival Debug
          </h2>
          <p className="text-[0.65rem] text-[var(--muted)]">
            Active festivals where announced_start ≤ {todayLabel} and (announced_end ≥ {todayLabel} or unset)
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[0.6rem] font-mono text-[var(--muted)]">
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={loadFestivals}
            className="px-2.5 py-1 rounded-full text-[0.6rem] font-mono bg-[var(--twilight)]/60 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-[0.7rem] font-mono text-[var(--muted)]">Loading festivals…</div>
      )}

      {!loading && error && (
        <div className="text-[0.7rem] font-mono text-[var(--neon-red)]">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-[0.7rem] font-mono text-[var(--muted)]">
          No active festivals found.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-2">
          {items.map((festival) => (
            <div
              key={festival.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--twilight)]/60 bg-[var(--night)]/40 px-3 py-2"
            >
              <div className="flex-1 min-w-[220px]">
                <div className="text-sm text-[var(--cream)] font-medium">
                  {festival.name}
                </div>
                <div className="text-[0.65rem] text-[var(--muted)] font-mono">
                  {festival.announced_start || "TBA"} → {festival.announced_end || "TBA"}
                  {festival.festival_type && (
                    <span className="ml-2">· {festival.festival_type}</span>
                  )}
                  {festival.location && (
                    <span className="ml-2">· {festival.location}</span>
                  )}
                  {!festival.location && festival.neighborhood && (
                    <span className="ml-2">· {festival.neighborhood}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[0.65rem] font-mono text-[var(--muted)]">
                <span>{festival.programCount} programs</span>
                <span>{festival.sessionCount} sessions</span>
              </div>
              <Link
                href={`/${portalSlug}/festivals/${festival.slug}`}
                className="ml-auto px-2.5 py-1 rounded-full text-[0.6rem] font-mono bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] hover:bg-[var(--neon-amber)]/30 transition-colors"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

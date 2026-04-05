"use client";

/**
 * GameDayView — the Game Day lane for the Find tab.
 *
 * Fetches team-grouped schedule data from the game-day API,
 * flattens it into date-grouped games, and renders with
 * team filter chips and GameCard rows.
 *
 * URL sync: ?team=hawks via replaceState (no router.push).
 */

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { Trophy } from "@phosphor-icons/react";
import { GameCard } from "@/components/find/gameday/GameCard";
import { TeamChip } from "@/components/find/gameday/TeamChip";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import {
  TEAMS,
  type GameEvent,
  type TeamSchedule,
} from "@/lib/teams-config";
import type { GameDayLaneInitialData } from "@/lib/explore-platform/lane-data";

// ── Types ───────────────────────────────────────────────────────────

interface GameDayViewProps {
  portalId: string;
  portalSlug: string;
  initialData?: GameDayLaneInitialData | null;
}

/** A game with team metadata attached, for date-grouped rendering. */
interface FlatGame {
  event: GameEvent;
  teamSlug: string;
  teamName: string;
  teamShortName: string;
  teamLogo: string;
  teamAccent: string;
  league: string;
}

interface DateGroup {
  label: string;
  dateKey: string;
  games: FlatGame[];
}

// ── Date label helpers (Eastern timezone) ───────────────────────────

const ET_TZ = "America/New_York";

/** Parse "YYYY-MM-DD" into a Date at midnight local time. */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Get today's date string in ET. */
function getTodayET(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Get current hour in ET (for Tonight vs Today). */
function getCurrentHourET(): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(new Date())
    .find((p) => p.type === "hour")?.value;
  return parseInt(hour ?? "0", 10);
}

/**
 * Build a human-readable date label for game grouping.
 * - Today -> "Tonight" (after 5pm ET) or "Today"
 * - Tomorrow -> "Tomorrow"
 * - This week -> "Friday, Apr 4"
 * - Next week+ -> "Saturday, Apr 12"
 */
function getDateLabel(dateStr: string, todayStr: string): string {
  const gameDate = parseDateLocal(dateStr);
  const today = parseDateLocal(todayStr);

  const diffDays = Math.round(
    (gameDate.getTime() - today.getTime()) / 86_400_000,
  );

  if (diffDays === 0) {
    return getCurrentHourET() >= 17 ? "Tonight" : "Today";
  }
  if (diffDays === 1) return "Tomorrow";

  const weekday = gameDate.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = gameDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${weekday}, ${monthDay}`;
}

// ── Game helpers ────────────────────────────────────────────────────

/** Extract opponent name from title: "Hawks vs. Celtics at State Farm" -> "Celtics" */
function extractOpponent(title: string, shortName: string): string {
  const vsMatch = title.match(/\s+vs\.?\s+/i);
  if (!vsMatch || vsMatch.index === undefined) return title;
  const before = title.substring(0, vsMatch.index).trim();
  const after = title.substring(vsMatch.index + vsMatch[0].length).trim();
  const isHomeFirst = before.toLowerCase().includes(shortName.toLowerCase());
  const opponent = isHomeFirst ? after : before;
  // Strip venue suffix: "Orlando Magic at Tony's Sports Grill" -> "Orlando Magic"
  const atIdx = opponent.lastIndexOf(" at ");
  return atIdx > 0 ? opponent.substring(0, atIdx) : opponent;
}

// ── Component ───────────────────────────────────────────────────────

export const GameDayView = memo(function GameDayView({
  portalSlug,
  initialData,
}: GameDayViewProps) {
  const state = useExploreUrlState();
  // State
  const [teamSchedules, setTeamSchedules] = useState<TeamSchedule[]>(
    initialData?.teams ?? [],
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);

  const activeTeam = state.params.get("team");

  // Fetch game-day data
  useEffect(() => {
    if (initialData) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/portals/${portalSlug}/game-day`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ teams: TeamSchedule[] }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setTeamSchedules(data.teams ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [initialData, portalSlug]);

  // URL sync for team filter
  const handleTeamChange = useCallback((teamSlug: string | null) => {
    state.setLaneParams({ team: teamSlug }, "replace");
  }, [state]);

  // Build team config lookup
  const teamConfigMap = useMemo(
    () => new Map(TEAMS.map((t) => [t.slug, t])),
    [],
  );

  // Teams visible in the chip row. Keep the active team visible even when it
  // has no upcoming games so intent-driven links still feel anchored.
  const visibleTeams = useMemo(() => {
    const dataSlugs = new Set(teamSchedules.map((t) => t.slug));
    const teams = TEAMS.filter((t) => dataSlugs.has(t.slug));

    if (activeTeam && !teams.some((team) => team.slug === activeTeam)) {
      const activeTeamConfig = teamConfigMap.get(activeTeam);
      if (activeTeamConfig) {
        return [activeTeamConfig, ...teams];
      }
    }

    return teams;
  }, [activeTeam, teamSchedules, teamConfigMap]);

  // Flatten team-grouped -> date-grouped
  const dateGroups = useMemo((): DateGroup[] => {
    const todayStr = getTodayET();

    // 1. Collect all games from filtered teams
    const filteredSchedules = activeTeam
      ? teamSchedules.filter((ts) => ts.slug === activeTeam)
      : teamSchedules;

    const flatGames: FlatGame[] = [];
    const seenIds = new Set<number>();

    for (const schedule of filteredSchedules) {
      const config = teamConfigMap.get(schedule.slug);
      // Include nextGame + upcoming
      const allGames = [
        ...(schedule.nextGame ? [schedule.nextGame] : []),
        ...schedule.upcoming,
      ];

      for (const game of allGames) {
        // Deduplicate by event ID
        if (seenIds.has(game.id)) continue;
        seenIds.add(game.id);

        flatGames.push({
          event: game,
          teamSlug: schedule.slug,
          teamName: schedule.name,
          teamShortName: schedule.shortName,
          teamLogo: config?.logoUrl ?? schedule.logoUrl,
          teamAccent: schedule.accentColor,
          league: schedule.league,
        });
      }
    }

    // 2. Group by date
    const groupMap = new Map<string, FlatGame[]>();
    for (const game of flatGames) {
      const dateKey = game.event.startDate;
      const existing = groupMap.get(dateKey) ?? [];
      existing.push(game);
      groupMap.set(dateKey, existing);
    }

    // 3. Sort dates, then sort games within each date by time
    const sortedDates = [...groupMap.keys()].sort();

    return sortedDates.map((dateKey) => {
      const games = groupMap.get(dateKey)!;
      // Sort by start_time (nulls last)
      games.sort((a, b) => {
        const ta = a.event.startTime ?? "99:99";
        const tb = b.event.startTime ?? "99:99";
        return ta.localeCompare(tb);
      });

      return {
        label: getDateLabel(dateKey, todayStr),
        dateKey,
        games,
      };
    });
  }, [teamSchedules, activeTeam, teamConfigMap]);

  // ── Loading skeleton ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Chip skeleton */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-4 py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="shrink-0 h-8 rounded-full bg-[var(--twilight)]/30 animate-pulse"
              style={{ width: i === 0 ? 48 : 80 }}
            />
          ))}
        </div>
        {/* Card skeletons */}
        <div className="space-y-3 px-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-card border border-[var(--twilight)]/40 p-4 flex items-center gap-4 animate-pulse"
              style={{
                backgroundColor: "var(--night)",
              }}
            >
              <div className="shrink-0 w-12 h-12 rounded-full bg-[var(--twilight)]/30" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[var(--twilight)]/30 rounded w-16" />
                <div className="h-4 bg-[var(--twilight)]/30 rounded w-3/4" />
                <div className="h-3 bg-[var(--twilight)]/20 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error / empty ─────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Trophy
          weight="duotone"
          className="w-10 h-10 text-[var(--muted)] mb-3"
        />
        <p className="text-sm text-[var(--soft)]">
          No games scheduled this week.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Team filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-4 py-2">
        <TeamChip
          slug="all"
          name="All"
          accent="var(--coral)"
          isActive={!activeTeam}
          onClick={() => handleTeamChange(null)}
        />
        {visibleTeams.map((team) => (
          <TeamChip
            key={team.slug}
            slug={team.slug}
            name={team.shortName || team.name}
            accent={team.accentColor}
            logo={team.logoUrl}
            isActive={activeTeam === team.slug}
            onClick={() => handleTeamChange(team.slug)}
          />
        ))}
      </div>

      {/* Date-grouped games */}
      {dateGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <Trophy
            weight="duotone"
            className="w-10 h-10 text-[var(--muted)] mb-3"
          />
          <p className="text-sm text-[var(--soft)]">
            {activeTeam
              ? `No ${(teamConfigMap.get(activeTeam)?.shortName ?? "selected team")} games scheduled this week.`
              : "No games scheduled this week."}
          </p>
        </div>
      ) : (
        <div className="space-y-5 px-4">
          {dateGroups.map((group) => (
            <div key={group.dateKey}>
              {/* Date header */}
              <h3 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--soft)] mb-2">
                {group.label}
              </h3>
              {/* Game cards */}
              <div className="space-y-2">
                {group.games.map((game) => (
                  <GameCard
                    key={game.event.id}
                    teamName={game.teamShortName}
                    teamLogo={game.teamLogo}
                    teamAccent={game.teamAccent}
                    opponent={extractOpponent(
                      game.event.title,
                      game.teamShortName,
                    )}
                    venue={game.event.venueName}
                    date={game.event.startDate}
                    time={game.event.startTime}
                    league={game.league}
                    ticketUrl={game.event.ticketUrl}
                    eventUrl={`/${portalSlug}/events/${game.event.id}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export type { GameDayViewProps };

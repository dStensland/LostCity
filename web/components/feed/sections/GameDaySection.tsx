"use client";

/**
 * GameDaySection — horizontal carousel of team cards for the Game Day feed section.
 *
 * Each card shows the team's accent color band, logo, next game details, and a
 * compact upcoming list. Users can hide default teams and add non-default ones
 * via an inline customizer (gear icon, logged-in only).
 *
 * Carousel mechanics mirror NowShowingSection: snap scroll, ResizeObserver,
 * dot indicators on mobile.
 */

import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import {
  Trophy,
  GearSix,
  Plus,
  X,
  MagnifyingGlass,
  Minus,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import SmartImage from "@/components/SmartImage";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { formatTime, getLocalDateString } from "@/lib/formats";
import {
  getMyTeams,
  addMyTeam,
  removeMyTeam,
  getHiddenTeams,
  hideTeam,
  unhideTeam,
} from "@/lib/my-teams";
import {
  TEAMS,
  GROUP_LABELS,
  type TeamConfig,
  type TeamSchedule,
  type GameDayResponse,
} from "@/lib/teams-config";

// ── Constants ────────────────────────────────────────────────────────

const CARD_WIDTH = 256; // w-64
const GAP = 12; // gap-3
const MAX_UPCOMING = 3;

// ── Helpers ──────────────────────────────────────────────────────────

/** Formats "2026-04-02" as "Apr 2" */
function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Component ────────────────────────────────────────────────────────

interface GameDaySectionProps {
  portalSlug: string;
}

export default function GameDaySection({ portalSlug }: GameDaySectionProps) {
  const { user } = useAuth();

  const [allTeams, setAllTeams] = useState<TeamSchedule[]>([]);
  const [myTeamSlugs, setMyTeamSlugs] = useState<string[]>([]);
  const [hiddenTeamSlugs, setHiddenTeamSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerSearch, setCustomizerSearch] = useState("");

  // Carousel state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load data
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/game-day`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<GameDayResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAllTeams(data.teams ?? []);
        setMyTeamSlugs(getMyTeams());
        setHiddenTeamSlugs(getHiddenTeams());
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [portalSlug]);

  // Build display list:
  //   - Default teams that have data + are not hidden, sorted by priority
  //   - User-added non-default teams that have data
  const defaultTeamSlugs = useMemo(
    () => new Set(TEAMS.filter((t) => t.defaultEnabled).map((t) => t.slug)),
    [],
  );

  const displayedTeams = useMemo(() => {
    const hiddenSet = new Set(hiddenTeamSlugs);
    const dataMap = new Map(allTeams.map((t) => [t.slug, t]));

    // Default teams: have data, not hidden — sorted by TEAMS priority order
    const defaults = TEAMS.filter(
      (tc) =>
        tc.defaultEnabled &&
        !hiddenSet.has(tc.slug) &&
        dataMap.has(tc.slug),
    ).map((tc) => dataMap.get(tc.slug)!);

    // User-added non-default teams: explicitly added, have data
    const added = myTeamSlugs
      .filter((slug) => !defaultTeamSlugs.has(slug))
      .map((slug) => dataMap.get(slug))
      .filter((t): t is TeamSchedule => Boolean(t));

    return [...defaults, ...added];
  }, [allTeams, myTeamSlugs, hiddenTeamSlugs, defaultTeamSlugs]);

  const totalCards = displayedTeams.length;

  // Track active card index for dot indicators
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft } = scrollRef.current;
    const index = Math.round(scrollLeft / (CARD_WIDTH + GAP));
    setActiveIndex(Math.min(index, Math.max(totalCards - 1, 0)));
  }, [totalCards]);

  useEffect(() => {
    if (!scrollRef.current) return;
    updateScrollState();

    const el = scrollRef.current;
    el.addEventListener("scroll", updateScrollState, { passive: true });

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateScrollState, 150);
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  // Add/hide handlers
  const handleAddTeam = (slug: string, isDefault: boolean) => {
    if (isDefault) {
      unhideTeam(slug);
      setHiddenTeamSlugs(getHiddenTeams());
    } else {
      addMyTeam(slug);
      setMyTeamSlugs(getMyTeams());
    }
  };

  const handleRemoveTeam = (slug: string, isDefault: boolean) => {
    if (isDefault) {
      hideTeam(slug);
      setHiddenTeamSlugs(getHiddenTeams());
    } else {
      removeMyTeam(slug);
      setMyTeamSlugs(getMyTeams());
    }
  };

  // Teams available to add: hidden defaults + non-default teams with data
  const availableTeams = useMemo(() => {
    const displayedSlugs = new Set(displayedTeams.map((t) => t.slug));
    const hiddenSet = new Set(hiddenTeamSlugs);
    const dataMap = new Map(allTeams.map((t) => [t.slug, t]));
    const q = customizerSearch.toLowerCase();

    const matchesSearch = (t: TeamSchedule) => {
      if (!customizerSearch) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.league.toLowerCase().includes(q)
      );
    };

    // Hidden default teams
    const hiddenDefaults = TEAMS.filter(
      (tc) => tc.defaultEnabled && hiddenSet.has(tc.slug) && dataMap.has(tc.slug),
    )
      .map((tc) => dataMap.get(tc.slug)!)
      .filter(matchesSearch);

    // Non-default teams with data not already shown
    const nonDefaults = TEAMS.filter(
      (tc) => !tc.defaultEnabled && dataMap.has(tc.slug) && !displayedSlugs.has(tc.slug),
    )
      .map((tc) => dataMap.get(tc.slug)!)
      .filter(matchesSearch);

    return [...hiddenDefaults, ...nonDefaults];
  }, [allTeams, displayedTeams, hiddenTeamSlugs, customizerSearch]);

  // ── Render gates ───────────────────────────────────────────────────

  if (loading) {
    return (
      <section className="pb-2">
        <FeedSectionHeader
          title="Game Day"
          priority="secondary"
          accentColor="var(--neon-cyan)"
          icon={<Trophy weight="duotone" className="w-5 h-5" />}
          seeAllHref={`/${portalSlug}?view=happening&category=sports`}
        />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
            >
              <div className="h-8 bg-[var(--twilight)]/30" />
              <div className="p-3 space-y-2.5">
                <div className="h-4 bg-[var(--twilight)]/30 rounded w-3/4" />
                <div className="h-3 bg-[var(--twilight)]/20 rounded w-full" />
                <div className="space-y-1.5 mt-2">
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-5/6" />
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-2/3" />
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (failed || displayedTeams.length === 0) return null;

  return (
    <section className="pb-2 feed-section-enter">
      {/* Section header */}
      <FeedSectionHeader
        title="Game Day"
        priority="secondary"
        accentColor="var(--neon-cyan)"
        icon={<Trophy weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening&category=sports`}
        actionIcon={user ? <GearSix weight="bold" className="w-3.5 h-3.5" /> : undefined}
        onAction={user ? () => setCustomizerOpen((v) => !v) : undefined}
        actionActive={customizerOpen}
        actionLabel="Customize teams"
      />

      {/* Carousel */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth"
        >
          {displayedTeams.map((team) => (
            <TeamCard
              key={team.slug}
              team={team}
              portalSlug={portalSlug}
              isDefault={defaultTeamSlugs.has(team.slug)}
            />
          ))}
        </div>

        {/* Mobile scroll indicator */}
        {totalCards > 1 && (
          <div className="flex sm:hidden justify-center items-center gap-1.5 mt-3">
            {totalCards <= 7 ? (
              Array.from({ length: totalCards }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollTo({
                        left: idx * (CARD_WIDTH + GAP),
                        behavior: "smooth",
                      });
                    }
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeIndex
                      ? "bg-[var(--neon-cyan)] w-4"
                      : "bg-[var(--twilight)] hover:bg-[var(--muted)] w-1.5"
                  }`}
                  aria-label={`Go to card ${idx + 1}`}
                />
              ))
            ) : (
              <span className="text-2xs font-mono tabular-nums text-[var(--muted)]">
                {activeIndex + 1} / {totalCards}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Team customizer (inline, below carousel) */}
      {customizerOpen && (
        <TeamCustomizer
          currentTeams={displayedTeams}
          availableTeams={availableTeams}
          defaultTeamSlugs={defaultTeamSlugs}
          allTeamConfigs={TEAMS}
          search={customizerSearch}
          onSearchChange={setCustomizerSearch}
          onAdd={handleAddTeam}
          onRemove={handleRemoveTeam}
          onClose={() => {
            setCustomizerOpen(false);
            setCustomizerSearch("");
          }}
        />
      )}
    </section>
  );
}

// ── TeamCard ──────────────────────────────────────────────────────────

function TeamCard({
  team,
  portalSlug,
  isDefault: _isDefault,
}: {
  team: TeamSchedule;
  portalSlug: string;
  isDefault: boolean;
}) {
  const today = getLocalDateString(new Date());
  const accentClass = createCssVarClass("--team-accent", team.accentColor, "team-accent");
  const upcoming = team.upcoming.slice(0, MAX_UPCOMING);
  const overflowCount = team.totalUpcoming > MAX_UPCOMING ? team.totalUpcoming - MAX_UPCOMING : 0;

  const isTonight =
    team.nextGame?.startDate === today &&
    team.nextGame?.startTime !== null;

  return (
    <>
      {accentClass && <ScopedStyles css={accentClass.css} />}
      <div
        className={`flex-shrink-0 w-64 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border border-[var(--twilight)]/40 ${accentClass?.className ?? ""}`}
      >
        {/* Accent band — h-8 gradient + border-t-2 stripe */}
        <div
          className="h-8 border-t-2 relative overflow-hidden"
          style={{
            borderTopColor: team.accentColor,
            background: `linear-gradient(135deg, ${team.accentColor}20 0%, ${team.accentColor}08 100%)`,
          }}
        >
          {/* Subtle diagonal shimmer */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              background: `repeating-linear-gradient(45deg, ${team.accentColor}, ${team.accentColor} 1px, transparent 1px, transparent 8px)`,
            }}
          />
        </div>

        {/* Card header */}
        <div className="px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-2">
            {/* Team logo */}
            <div className="shrink-0 w-6 h-6 relative">
              <SmartImage
                src={team.logoUrl}
                alt={team.shortName}
                width={24}
                height={24}
                className="object-contain"
                fallback={
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold text-white"
                    style={{ backgroundColor: team.accentColor }}
                  >
                    {team.shortName.slice(0, 1)}
                  </div>
                }
              />
            </div>

            {/* Team name + league badge */}
            <span className="text-base font-semibold text-[var(--cream)] truncate flex-1 min-w-0">
              {team.shortName}
            </span>
            <span className="shrink-0 font-mono text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--muted)]">
              {team.league}
            </span>
          </div>
        </div>

        {/* Next game */}
        {team.nextGame && (
          <div className="px-3 pb-2">
            <Link
              href={`/${portalSlug}/events/${team.nextGame.id}`}
              className="group block"
            >
              <div className="text-sm text-[var(--soft)] group-hover:text-[var(--cream)] transition-colors truncate leading-snug">
                {team.nextGame.title}
              </div>
              {/* Time chips */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {isTonight && (
                  <span className="px-1.5 py-0.5 rounded font-mono text-2xs font-bold uppercase tracking-wider bg-[var(--neon-red)]/15 text-[var(--neon-red)]">
                    Tonight
                  </span>
                )}
                {team.nextGame.startTime && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--gold)]/10 text-2xs font-mono tabular-nums text-[var(--gold)]/80">
                    {formatTime(team.nextGame.startTime)}
                  </span>
                )}
                {!isTonight && team.nextGame.startDate && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--gold)]/10 text-2xs font-mono tabular-nums text-[var(--gold)]/80">
                    {formatShortDate(team.nextGame.startDate)}
                  </span>
                )}
                {team.nextGame.isFree && (
                  <span className="px-1.5 py-0.5 rounded font-mono text-2xs font-bold uppercase tracking-wider bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]">
                    Free
                  </span>
                )}
              </div>
              {/* Venue */}
              {team.nextGame.venueName && (
                <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                  {team.nextGame.venueName}
                </div>
              )}
            </Link>
          </div>
        )}

        {/* Divider — only when upcoming list is non-empty */}
        {upcoming.length > 0 && (
          <div className="mx-3 border-t border-[var(--twilight)]/60" />
        )}

        {/* Upcoming rows */}
        {upcoming.length > 0 && (
          <div className="pb-1">
            {upcoming.map((game) => (
              <Link
                key={game.id}
                href={`/${portalSlug}/events/${game.id}`}
                className="group flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-[var(--cream)]/[0.03] transition-colors"
              >
                <span className="text-xs text-[var(--soft)] truncate flex-1 min-w-0 group-hover:text-[var(--cream)] transition-colors">
                  {game.title}
                </span>
                <span className="shrink-0 font-mono text-2xs tabular-nums text-[var(--muted)]">
                  {formatShortDate(game.startDate)}
                  {game.startTime ? ` · ${formatTime(game.startTime)}` : ""}
                </span>
              </Link>
            ))}

            {/* +N more overflow link */}
            {overflowCount > 0 && (
              <Link
                href={`/${portalSlug}?view=happening&category=sports&q=${encodeURIComponent(team.shortName)}`}
                className="block px-3 py-1 text-xs text-[var(--neon-cyan)]/70 hover:text-[var(--neon-cyan)] transition-colors"
              >
                +{overflowCount} more →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── TeamCustomizer ────────────────────────────────────────────────────

function TeamCustomizer({
  currentTeams,
  availableTeams,
  defaultTeamSlugs,
  allTeamConfigs,
  search,
  onSearchChange,
  onAdd,
  onRemove,
  onClose,
}: {
  currentTeams: TeamSchedule[];
  availableTeams: TeamSchedule[];
  defaultTeamSlugs: Set<string>;
  allTeamConfigs: TeamConfig[];
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: (slug: string, isDefault: boolean) => void;
  onRemove: (slug: string, isDefault: boolean) => void;
  onClose: () => void;
}) {
  const matchesSearch = (t: TeamSchedule) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.shortName.toLowerCase().includes(q) ||
      t.league.toLowerCase().includes(q)
    );
  };

  const filteredCurrent = currentTeams.filter(matchesSearch);

  // Group available teams by group
  const groupedAvailable = useMemo(() => {
    const groups = new Map<TeamConfig["group"], TeamSchedule[]>();
    const configMap = new Map(allTeamConfigs.map((tc) => [tc.slug, tc]));

    for (const team of availableTeams) {
      const config = configMap.get(team.slug);
      if (!config) continue;
      const existing = groups.get(config.group) ?? [];
      existing.push(team);
      groups.set(config.group, existing);
    }

    return groups;
  }, [availableTeams, allTeamConfigs]);

  const groupOrder: TeamConfig["group"][] = ["major", "minor", "college", "nearby", "alternative"];
  const hasResults = filteredCurrent.length > 0 || availableTeams.length > 0;

  return (
    <div className="mt-2 rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--cream)]">
          Customize teams
        </span>
        <button
          onClick={onClose}
          className="p-2.5 -m-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          aria-label="Close customizer"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-2">
        <MagnifyingGlass
          weight="bold"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search teams..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-xs text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--neon-cyan)] transition-colors"
        />
      </div>

      <div className="max-h-56 overflow-y-auto">
        {!hasResults && (
          <p className="text-xs text-[var(--muted)] py-3 text-center">
            No teams match your search
          </p>
        )}

        {/* Your teams — currently visible */}
        {filteredCurrent.length > 0 && (
          <div>
            <div className="px-2 py-1.5">
              <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Your teams
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredCurrent.map((team) => {
                const isDefault = defaultTeamSlugs.has(team.slug);
                return (
                  <div
                    key={team.slug}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cream)]/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--cream)] truncate">
                        {team.name}
                      </div>
                      <div className="text-2xs text-[var(--muted)]">
                        {team.league}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(team.slug, isDefault)}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[var(--muted)] text-2xs font-semibold hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                    >
                      <Minus weight="bold" className="w-2.5 h-2.5" />
                      Hide
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add teams — grouped by team.group */}
        {availableTeams.length > 0 && (
          <div className={filteredCurrent.length > 0 ? "mt-2" : ""}>
            <div className="px-2 py-1.5">
              <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Add teams
              </span>
            </div>
            {groupOrder.map((group) => {
              const teamsInGroup = groupedAvailable.get(group);
              if (!teamsInGroup || teamsInGroup.length === 0) return null;
              return (
                <div key={group} className="mb-1.5">
                  <div className="px-2 py-1 font-mono text-2xs uppercase tracking-wider text-[var(--muted)]/60">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="space-y-0.5">
                    {teamsInGroup.map((team) => {
                      const isDefault = defaultTeamSlugs.has(team.slug);
                      return (
                        <div
                          key={team.slug}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cream)]/[0.03] transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs text-[var(--cream)] truncate">
                              {team.name}
                            </div>
                            <div className="text-2xs text-[var(--muted)]">
                              {team.league}
                            </div>
                          </div>
                          <button
                            onClick={() => onAdd(team.slug, isDefault)}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] text-2xs font-semibold hover:bg-[var(--neon-cyan)]/25 transition-colors"
                          >
                            <Plus weight="bold" className="w-2.5 h-2.5" />
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

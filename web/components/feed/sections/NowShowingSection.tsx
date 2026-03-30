"use client";

/**
 * NowShowingSection — horizontal carousel of theater cards for indie cinema.
 *
 * Each card shows a poster strip (up to 3 film posters), theater name + neighborhood,
 * and a compact film lineup with showtimes. Users can add chain theaters via a picker
 * that persists to localStorage.
 *
 * Carousel mechanics mirror FeaturedCarousel: snap scroll, ResizeObserver,
 * desktop arrows, mobile dot indicators.
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
  FilmSlate,
  Plus,
  X,
  MagnifyingGlass,
  GearSix,
  Minus,
} from "@phosphor-icons/react";
import { formatTime, getLocalDateString } from "@/lib/formats";
import {
  isIndieCinemaVenue,
  isChainCinemaVenue,
  getIndieCinemaPriority,
} from "@/lib/cinema-filter";
import {
  getMyTheaters,
  addMyTheater,
  removeMyTheater,
  getHiddenTheaters,
  hideTheater,
  unhideTheater,
} from "@/lib/my-theaters";
import { useAuth } from "@/lib/auth-context";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";

// ── Types ────────────────────────────────────────────────────────────

type ShowtimeEntry = { time: string; event_id?: number } | string;

type TheaterFilm = {
  title: string;
  series_id: string | null;
  series_slug: string | null;
  image_url: string | null;
  genres?: string[];
  director?: string | null;
  year?: number | null;
  runtime_minutes?: number | null;
  rating?: string | null;
  festival_id?: string | null;
  festival_name?: string | null;
  remaining_count?: number | null;
  first_date?: string | null;
  times: ShowtimeEntry[];
};

type TheaterItem = {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  films: TheaterFilm[];
};

type ShowtimesResponse = {
  date: string;
  theaters?: TheaterItem[];
};

// ── Constants ────────────────────────────────────────────────────────

const MAX_FILMS_PER_CARD = 4;
const MAX_TIMES_PER_FILM = 4;
const CARD_WIDTH = 256; // w-64
const GAP = 12; // gap-3

// ── Helpers ──────────────────────────────────────────────────────────

function extractTime(entry: ShowtimeEntry): string {
  return typeof entry === "string" ? entry : entry.time;
}

// ── Component ────────────────────────────────────────────────────────

interface NowShowingSectionProps {
  portalSlug: string;
  /** When true, suppresses the section header and wrapper — for embedding inside a parent tab shell */
  embedded?: boolean;
}

export default function NowShowingSection({ portalSlug, embedded = false }: NowShowingSectionProps) {
  const { user } = useAuth();
  const [allTheaters, setAllTheaters] = useState<TheaterItem[]>([]);
  const [myTheaterSlugs, setMyTheaterSlugs] = useState<string[]>([]);
  const [hiddenTheaterSlugs, setHiddenTheaterSlugs] = useState<string[]>([]);
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

    fetch(`/api/showtimes?mode=by-theater&include_chains=true&meta=true&portal=${portalSlug}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ShowtimesResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAllTheaters(data.theaters || []);
        setMyTheaterSlugs(getMyTheaters());
        setHiddenTheaterSlugs(getHiddenTheaters());
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
  }, []);

  // Build display list: indie theaters (minus hidden) + user-added chains
  const displayedTheaters = useMemo(() => {
    const hiddenSet = new Set(hiddenTheaterSlugs);

    const indie = allTheaters
      .filter((t) =>
        isIndieCinemaVenue({ name: t.venue_name, slug: t.venue_slug })
      )
      .filter((t) => !hiddenSet.has(t.venue_slug))
      .filter((t) => t.films.length > 0)
      .sort(
        (a, b) =>
          getIndieCinemaPriority(a.venue_name) -
          getIndieCinemaPriority(b.venue_name)
      );

    const userAdded = myTheaterSlugs
      .map((slug) => allTheaters.find((t) => t.venue_slug === slug))
      .filter((t): t is TheaterItem => Boolean(t))
      .filter(
        (t) =>
          !isIndieCinemaVenue({ name: t.venue_name, slug: t.venue_slug })
      );

    return [...indie, ...userAdded];
  }, [allTheaters, myTheaterSlugs, hiddenTheaterSlugs]);

  const totalCards = displayedTheaters.length;

  // Track active card index for mobile dot indicators
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

  // Add/remove/hide/unhide theater handlers
  const handleAddTheater = (slug: string, isIndie: boolean) => {
    if (isIndie) {
      unhideTheater(slug);
      setHiddenTheaterSlugs(getHiddenTheaters());
    } else {
      addMyTheater(slug);
      setMyTheaterSlugs(getMyTheaters());
    }
  };

  const handleRemoveTheater = (slug: string, isIndie: boolean) => {
    if (isIndie) {
      hideTheater(slug);
      setHiddenTheaterSlugs(getHiddenTheaters());
    } else {
      removeMyTheater(slug);
      setMyTheaterSlugs(getMyTheaters());
    }
  };

  // Theaters available to add: chains not currently shown + hidden indie theaters
  const availableTheaters = useMemo(() => {
    const displayedSlugs = new Set(displayedTheaters.map((t) => t.venue_slug));
    const hiddenSet = new Set(hiddenTheaterSlugs);
    const q = customizerSearch.toLowerCase();

    const matchesSearch = (t: TheaterItem) => {
      if (!customizerSearch) return true;
      return (
        t.venue_name.toLowerCase().includes(q) ||
        (t.neighborhood && t.neighborhood.toLowerCase().includes(q))
      );
    };

    // Chains not currently displayed
    const chains = allTheaters
      .filter((t) =>
        isChainCinemaVenue({ name: t.venue_name, slug: t.venue_slug })
      )
      .filter((t) => !displayedSlugs.has(t.venue_slug))
      .filter(matchesSearch);

    // Hidden indie theaters (user previously hid them)
    const hiddenIndies = allTheaters
      .filter((t) =>
        isIndieCinemaVenue({ name: t.venue_name, slug: t.venue_slug })
      )
      .filter((t) => hiddenSet.has(t.venue_slug))
      .filter(matchesSearch);

    return [...hiddenIndies, ...chains].sort((a, b) =>
      a.venue_name.localeCompare(b.venue_name)
    );
  }, [allTheaters, displayedTheaters, hiddenTheaterSlugs, customizerSearch]);

  // ── Render gates ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={embedded ? "" : "pb-2"}>
        {!embedded && (
          <FeedSectionHeader
            title="Now Showing"
            priority="secondary"
            accentColor="var(--vibe)"
            icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
            seeAllHref={`/${portalSlug}?view=happening&content=showtimes`}
          />
        )}
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
            >
              <div className="h-40 bg-[var(--twilight)]/30" />
              <div className="p-3 space-y-2.5">
                <div className="h-4 bg-[var(--twilight)]/30 rounded w-3/4" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-full" />
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-5/6" />
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (failed) return null;

  // Hide if no indie theaters have showtimes (and user hasn't added any chains)
  const hasIndieShowtimes = allTheaters.some(
    (t) =>
      isIndieCinemaVenue({ name: t.venue_name, slug: t.venue_slug }) &&
      t.films.length > 0
  );
  if (!hasIndieShowtimes && myTheaterSlugs.length === 0) return null;

  const Wrapper = embedded ? "div" : "section";

  return (
    <Wrapper className={embedded ? "" : "pb-2 feed-section-enter"}>
      {/* Section header — hidden when embedded inside VenuesSection tab */}
      {!embedded && (
        <FeedSectionHeader
          title="Now Showing"
          priority="secondary"
          accentColor="var(--vibe)"
          icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
          seeAllHref={`/${portalSlug}?view=happening&content=showtimes`}
          actionIcon={user ? <GearSix weight="bold" className="w-3.5 h-3.5" /> : undefined}
          onAction={user ? () => setCustomizerOpen((v) => !v) : undefined}
          actionActive={customizerOpen}
          actionLabel="Customize theaters"
        />
      )}

      {/* Carousel */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth"
        >
          {displayedTheaters.map((theater) => (
            <TheaterCard
              key={theater.venue_id}
              theater={theater}
              portalSlug={portalSlug}
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
                      ? "bg-[var(--vibe)] w-4"
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

      {/* Theater customizer (inline, below carousel) */}
      {customizerOpen && (
        <TheaterCustomizer
          currentTheaters={displayedTheaters}
          availableTheaters={availableTheaters}
          search={customizerSearch}
          onSearchChange={setCustomizerSearch}
          onAdd={handleAddTheater}
          onRemove={handleRemoveTheater}
          onClose={() => {
            setCustomizerOpen(false);
            setCustomizerSearch("");
          }}
        />
      )}
    </Wrapper>
  );
}

// ── TheaterCard ──────────────────────────────────────────────────────

function TheaterCard({
  theater,
  portalSlug,
}: {
  theater: TheaterItem;
  portalSlug: string;
}) {
  const films = theater.films.slice(0, MAX_FILMS_PER_CARD);
  const overflow = theater.films.length - MAX_FILMS_PER_CARD;

  // Collect up to 3 poster images
  const posters = films
    .map((f) => f.image_url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 3);

  return (
    <div className="flex-shrink-0 w-64 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border-t-2 border border-[var(--twilight)]/40 border-t-[var(--vibe)]/25">
      {/* Poster strip — only rendered when images exist */}
      {posters.length > 0 && (
        <div className="relative h-40 flex overflow-hidden">
          {posters.map((url, i) => (
            <div
              key={i}
              className={`flex-1 relative ${i < posters.length - 1 ? "border-r border-[var(--twilight)]/30" : ""}`}
            >
              <SmartImage
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 200px"
                className="object-cover"
                fallback={
                  <div className="absolute inset-0 bg-[var(--dusk)]" />
                }
              />
            </div>
          ))}
          {/* Vignette overlay */}
          <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)] pointer-events-none" />
          {/* Gradient merge into card body */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent pointer-events-none" />
          {/* Film count pill */}
          <span className="absolute bottom-2 left-2.5 z-10 text-2xs font-mono text-[var(--cream)]/70 bg-[var(--void)]/60 backdrop-blur-sm px-2 py-0.5 rounded">
            {theater.films.length} {theater.films.length === 1 ? "film" : "films"}
          </span>
        </div>
      )}

      {/* Theater header */}
      <Link
        href={`/${portalSlug}?spot=${theater.venue_slug}`}
        className="group block px-3 pt-3 pb-2"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base font-semibold text-[var(--cream)] group-hover:text-[var(--vibe)] transition-colors truncate flex-1 min-w-0">
            {theater.venue_name}
          </span>
          {theater.google_rating != null && (
            <>
              <Dot className="shrink-0" />
              <span className="shrink-0 text-xs text-[var(--gold)]">
                {theater.google_rating.toFixed(1)} ★
              </span>
            </>
          )}
        </div>
      </Link>

      {/* Film rows */}
      <div className="pb-2.5">
        {films.map((film) => (
          <FilmRow
            key={film.series_id || film.title}
            film={film}
            portalSlug={portalSlug}
          />
        ))}
        {overflow > 0 && (
          <Link
            href={`/${portalSlug}?spot=${theater.venue_slug}`}
            className="block px-3 py-1 text-xs text-[var(--vibe)]/70 hover:text-[var(--vibe)] transition-colors"
          >
            + {overflow} more →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── FilmRow ──────────────────────────────────────────────────────────

function FilmRow({
  film,
  portalSlug,
}: {
  film: TheaterFilm;
  portalSlug: string;
}) {
  const times = film.times.slice(0, MAX_TIMES_PER_FILM);
  const href = film.series_slug
    ? `/${portalSlug}/series/${film.series_slug}`
    : undefined;

  // ── Urgency badge logic ──────────────────────────────────────────
  const isLastShowing =
    film.remaining_count != null && film.remaining_count <= 2;
  // "Opening Night" removed — first_date is MIN(remaining start_date), not
  // the film's actual premiere. A film showing for 3 weeks gets first_date
  // === today once prior dates expire, producing false "OPENING NIGHT" labels.
  const urgencyBadge: "last" | null = isLastShowing ? "last" : null;

  // ── Metadata row ─────────────────────────────────────────────────
  const metaParts: string[] = [];
  if (film.rating) metaParts.push(film.rating);
  if (film.runtime_minutes) {
    const h = Math.floor(film.runtime_minutes / 60);
    const m = film.runtime_minutes % 60;
    metaParts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
  }
  if (film.director) metaParts.push(`Dir. ${film.director}`);
  const metaString = metaParts.join(" · ");

  const row = (
    <div className="group px-3 py-1.5 transition-colors hover:bg-[var(--cream)]/[0.03]">
      {/* Title + urgency badge */}
      <div className="flex items-start gap-1.5">
        <span className="text-sm text-[var(--soft)] truncate flex-1 min-w-0 group-hover:text-[var(--cream)] transition-colors">
          {film.title}
        </span>
        {urgencyBadge === "last" && (
          <span className="shrink-0 text-2xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--neon-red)]/15 text-[var(--neon-red)]">
            Last Showing
          </span>
        )}
      </div>

      {/* Showtime chips */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {times.map((entry) => {
          const raw = extractTime(entry);
          return (
            <span
              key={raw}
              className="px-1.5 py-0.5 rounded bg-[var(--vibe)]/10 text-2xs font-mono tabular-nums text-[var(--vibe)]/80 group-hover:bg-[var(--vibe)]/15 group-hover:text-[var(--vibe)] transition-colors"
            >
              {formatTime(raw)}
            </span>
          );
        })}
        {film.times.length > MAX_TIMES_PER_FILM && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--twilight)]/50 text-2xs font-mono text-[var(--muted)]">
            +{film.times.length - MAX_TIMES_PER_FILM}
          </span>
        )}
      </div>

      {/* Metadata row — only when at least one field is present */}
      {metaString && (
        <p className="text-2xs text-[var(--muted)] mt-0.5 leading-snug">
          {metaString}
        </p>
      )}

      {/* Festival parent link */}
      {film.festival_name && (
        <p className="text-2xs text-[var(--gold)] mt-0.5">
          Part of {film.festival_name}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} prefetch={false}>{row}</Link>;
  }
  return row;
}

// ── TheaterCustomizer ────────────────────────────────────────────────

function TheaterCustomizer({
  currentTheaters,
  availableTheaters,
  search,
  onSearchChange,
  onAdd,
  onRemove,
  onClose,
}: {
  currentTheaters: TheaterItem[];
  availableTheaters: TheaterItem[];
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: (slug: string, isIndie: boolean) => void;
  onRemove: (slug: string, isIndie: boolean) => void;
  onClose: () => void;
}) {
  const matchesSearch = (t: TheaterItem) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.venue_name.toLowerCase().includes(q) ||
      (t.neighborhood && t.neighborhood.toLowerCase().includes(q))
    );
  };

  const filteredCurrent = currentTheaters.filter(matchesSearch);
  const filteredAvailable = availableTheaters;
  const hasResults = filteredCurrent.length > 0 || filteredAvailable.length > 0;

  return (
    <div className="mt-2 rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--cream)]">
          Customize theaters
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
          placeholder="Search theaters..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-xs text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--vibe)] transition-colors"
        />
      </div>

      <div className="max-h-56 overflow-y-auto">
        {!hasResults && (
          <p className="text-xs text-[var(--muted)] py-3 text-center">
            No theaters match your search
          </p>
        )}

        {/* Your theaters — currently visible */}
        {filteredCurrent.length > 0 && (
          <div>
            <div className="px-2 py-1.5">
              <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Your theaters
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredCurrent.map((theater) => {
                const indie = isIndieCinemaVenue({ name: theater.venue_name, slug: theater.venue_slug });
                return (
                  <div
                    key={theater.venue_id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cream)]/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--cream)] truncate">
                        {theater.venue_name}
                      </div>
                      {theater.neighborhood && (
                        <div className="text-2xs text-[var(--muted)]">
                          {theater.neighborhood}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(theater.venue_slug, indie)}
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

        {/* Add theaters — available chains + hidden indie theaters */}
        {filteredAvailable.length > 0 && (
          <div className={filteredCurrent.length > 0 ? "mt-2" : ""}>
            <div className="px-2 py-1.5">
              <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Add theaters
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredAvailable.map((theater) => {
                const indie = isIndieCinemaVenue({ name: theater.venue_name, slug: theater.venue_slug });
                return (
                  <div
                    key={theater.venue_id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cream)]/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--cream)] truncate">
                        {theater.venue_name}
                      </div>
                      {theater.neighborhood && (
                        <div className="text-2xs text-[var(--muted)]">
                          {theater.neighborhood}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onAdd(theater.venue_slug, indie)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--vibe)]/15 text-[var(--vibe)] text-2xs font-semibold hover:bg-[var(--vibe)]/25 transition-colors"
                    >
                      <Plus weight="bold" className="w-2.5 h-2.5" />
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
} from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import {
  isIndieCinemaVenue,
  isChainCinemaVenue,
  getIndieCinemaPriority,
} from "@/lib/cinema-filter";
import {
  getMyTheaters,
  addMyTheater,
  removeMyTheater,
} from "@/lib/my-theaters";

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
  times: ShowtimeEntry[];
};

type TheaterItem = {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  films: TheaterFilm[];
};

type ShowtimesResponse = {
  date: string;
  theaters?: TheaterItem[];
};

// ── Constants ────────────────────────────────────────────────────────

const MAX_FILMS_PER_CARD = 4;
const MAX_TIMES_PER_FILM = 2;
const CARD_WIDTH = 288; // w-72
const GAP = 12; // gap-3

// ── Helpers ──────────────────────────────────────────────────────────

function extractTime(entry: ShowtimeEntry): string {
  return typeof entry === "string" ? entry : entry.time;
}

// ── Skeleton ─────────────────────────────────────────────────────────

function NowShowingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3.5 h-3.5 rounded bg-[var(--twilight)]" />
        <div className="h-4 w-36 rounded bg-[var(--twilight)]" />
      </div>
      <div className="relative -mx-4">
        <div className="flex gap-3 px-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden"
            >
              <div className="h-32 bg-[var(--twilight)]/40" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-32 rounded bg-[var(--twilight)]" />
                <div className="h-3 w-full rounded bg-[var(--twilight)]/60" />
                <div className="h-3 w-3/4 rounded bg-[var(--twilight)]/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

interface NowShowingSectionProps {
  portalSlug: string;
}

export default function NowShowingSection({ portalSlug }: NowShowingSectionProps) {
  const [allTheaters, setAllTheaters] = useState<TheaterItem[]>([]);
  const [myTheaterSlugs, setMyTheaterSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Carousel state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Load data
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/showtimes?mode=by-theater&include_chains=true&meta=true", {
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

  // Build display list: indie theaters + user-added chains
  const displayedTheaters = useMemo(() => {
    const indie = allTheaters
      .filter((t) =>
        isIndieCinemaVenue({ name: t.venue_name, slug: t.venue_slug })
      )
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
  }, [allTheaters, myTheaterSlugs]);

  // Set of user-added slugs for quick lookup
  const userAddedSet = useMemo(
    () => new Set(myTheaterSlugs),
    [myTheaterSlugs]
  );

  // Total items in carousel (theaters + add card)
  const totalCards = displayedTheaters.length + 1;

  // Carousel scroll mechanics (mirrors FeaturedCarousel)
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(
      scrollWidth > clientWidth &&
        scrollLeft < scrollWidth - clientWidth - 10
    );
    const index = Math.round(scrollLeft / (CARD_WIDTH + GAP));
    setActiveIndex(Math.min(index, Math.max(totalCards - 1, 0)));
  }, [totalCards]);

  useEffect(() => {
    if (!scrollRef.current) return;
    updateScrollState();

    const el = scrollRef.current;
    el.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = CARD_WIDTH + GAP;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Add/remove theater handlers
  const handleAddTheater = (slug: string) => {
    addMyTheater(slug);
    setMyTheaterSlugs(getMyTheaters());
  };

  const handleRemoveTheater = (slug: string) => {
    removeMyTheater(slug);
    setMyTheaterSlugs(getMyTheaters());
  };

  // Chain theaters available in picker (not already displayed)
  const availableChains = useMemo(() => {
    const displayedSlugs = new Set(displayedTheaters.map((t) => t.venue_slug));
    return allTheaters
      .filter((t) =>
        isChainCinemaVenue({ name: t.venue_name, slug: t.venue_slug })
      )
      .filter((t) => !displayedSlugs.has(t.venue_slug))
      .filter((t) => {
        if (!pickerSearch) return true;
        const q = pickerSearch.toLowerCase();
        return (
          t.venue_name.toLowerCase().includes(q) ||
          (t.neighborhood && t.neighborhood.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.venue_name.localeCompare(b.venue_name));
  }, [allTheaters, displayedTheaters, pickerSearch]);

  // ── Render gates ───────────────────────────────────────────────────

  if (loading) return <NowShowingSkeleton />;
  if (failed) return null;

  // Hide if no indie theaters have showtimes (and user hasn't added any chains)
  const hasIndieShowtimes = allTheaters.some(
    (t) =>
      isIndieCinemaVenue({ name: t.venue_name, slug: t.venue_slug }) &&
      t.films.length > 0
  );
  if (!hasIndieShowtimes && myTheaterSlugs.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title="Movies Today"
        priority="secondary"
        accentColor="var(--vibe)"
        icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=find&type=showtimes`}
        seeAllLabel="Now Playing"
      />

      {/* Carousel */}
      <div className="relative -mx-4">
        {/* Desktop nav arrows (overlaid on carousel edges) */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[var(--void)]/80 backdrop-blur-sm border border-[var(--twilight)] items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--night)] transition-colors shadow-card-sm"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[var(--void)]/80 backdrop-blur-sm border border-[var(--twilight)] items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--night)] transition-colors shadow-card-sm"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-4 scroll-smooth"
        >
          {displayedTheaters.map((theater) => (
            <TheaterCard
              key={theater.venue_id}
              theater={theater}
              portalSlug={portalSlug}
              isUserAdded={userAddedSet.has(theater.venue_slug)}
              onRemove={() => handleRemoveTheater(theater.venue_slug)}
            />
          ))}
          <AddTheaterCard
            onClick={() => setPickerOpen((v) => !v)}
            isOpen={pickerOpen}
          />
        </div>

        {/* Mobile dot indicators */}
        {totalCards > 1 && (
          <div className="flex sm:hidden justify-center gap-1.5 mt-3">
            {Array.from({ length: totalCards }).map((_, idx) => (
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
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === activeIndex
                    ? "bg-[var(--vibe)] w-4"
                    : "bg-[var(--twilight)] hover:bg-[var(--muted)]"
                }`}
                aria-label={`Go to card ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Theater picker (inline, below carousel) */}
      {pickerOpen && (
        <TheaterPicker
          chains={availableChains}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          onAdd={handleAddTheater}
          onClose={() => {
            setPickerOpen(false);
            setPickerSearch("");
          }}
        />
      )}
    </section>
  );
}

// ── TheaterCard ──────────────────────────────────────────────────────

function TheaterCard({
  theater,
  portalSlug,
  isUserAdded,
  onRemove,
}: {
  theater: TheaterItem;
  portalSlug: string;
  isUserAdded: boolean;
  onRemove: () => void;
}) {
  const films = theater.films.slice(0, MAX_FILMS_PER_CARD);
  const overflow = theater.films.length - MAX_FILMS_PER_CARD;

  // Collect up to 3 poster images
  const posters = films
    .map((f) => f.image_url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 3);

  return (
    <div
      className={`flex-shrink-0 w-72 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border-t-2 ${
        isUserAdded
          ? "border border-[var(--vibe)]/30 border-t-[var(--vibe)]"
          : "border border-[var(--twilight)]/40 border-t-[var(--vibe)]/25"
      }`}
    >
      {/* Poster strip — taller for proper movie poster crops */}
      <div className="relative h-40 flex overflow-hidden">
        {posters.length > 0 ? (
          posters.map((url, i) => (
            <div
              key={i}
              className={`flex-1 relative ${i < posters.length - 1 ? "border-r border-[var(--twilight)]/30" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))
        ) : (
          <div className="flex-1 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] flex items-center justify-center">
            <FilmSlate
              weight="thin"
              className="w-8 h-8 text-[var(--soft)]"
            />
          </div>
        )}
        {/* Vignette overlay */}
        <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.25)] pointer-events-none" />
        {/* Gradient merge into card body */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent pointer-events-none" />
        {/* Film count pill */}
        <span className="absolute bottom-2 left-2.5 z-10 text-2xs font-mono text-[var(--cream)]/70 bg-[var(--void)]/60 backdrop-blur-sm px-2 py-0.5 rounded">
          {theater.films.length} {theater.films.length === 1 ? "film" : "films"}
        </span>
        {/* "ADDED" chip for user-added theaters */}
        {isUserAdded && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider bg-[var(--vibe)]/20 text-[var(--vibe)] backdrop-blur-sm">
              Added
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="w-5 h-5 rounded-full bg-[var(--void)]/70 backdrop-blur-sm flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              aria-label={`Remove ${theater.venue_name}`}
            >
              <X weight="bold" className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Theater header */}
      <Link
        href={`/${portalSlug}?spot=${theater.venue_slug}`}
        className="group block px-3 pt-3 pb-2"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-semibold text-[var(--cream)] group-hover:text-[var(--vibe)] transition-colors truncate">
            {theater.venue_name}
          </span>
          {theater.neighborhood && (
            <span className="text-xs text-[var(--soft)] shrink-0">
              &middot; {theater.neighborhood}
            </span>
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
            className="block px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
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

  const primaryGenre = film.genres?.[0];

  const row = (
    <div className="group flex items-baseline justify-between gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--cream)]/[0.03]">
      <div className="flex items-baseline gap-1.5 min-w-0">
        {primaryGenre && (
          <span className="text-2xs font-mono uppercase tracking-wider text-[var(--vibe)]/50 shrink-0">
            {primaryGenre}
          </span>
        )}
        <span className="text-sm text-[var(--soft)] truncate group-hover:text-[var(--cream)] transition-colors">
          {film.title}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {times.map((entry) => {
          const raw = extractTime(entry);
          return (
            <span
              key={raw}
              className="px-1.5 py-0.5 rounded bg-[var(--vibe)]/10 text-xs font-mono tabular-nums text-[var(--vibe)]/80 group-hover:bg-[var(--vibe)]/15 group-hover:text-[var(--vibe)] transition-colors"
            >
              {formatTime(raw)}
            </span>
          );
        })}
        {film.times.length > MAX_TIMES_PER_FILM && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--twilight)]/50 text-xs font-mono text-[var(--muted)]">
            +{film.times.length - MAX_TIMES_PER_FILM}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{row}</Link>;
  }
  return row;
}

// ── AddTheaterCard ───────────────────────────────────────────────────

function AddTheaterCard({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-72 snap-start rounded-card border bg-gradient-to-br from-[var(--night)] to-[var(--void)] flex flex-col items-center justify-center gap-3 min-h-[280px] transition-all ${
        isOpen
          ? "border-[var(--vibe)]/40 shadow-[0_0_20px_rgba(167,139,250,0.1)]"
          : "border-[var(--twilight)]/60 hover:border-[var(--vibe)]/30"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          isOpen
            ? "bg-[var(--vibe)]/20 border border-[var(--vibe)]/40 shadow-[0_0_20px_rgba(167,139,250,0.15)]"
            : "bg-[var(--vibe)]/10 border border-[var(--vibe)]/20 hover:bg-[var(--vibe)]/15"
        }`}
      >
        <Plus weight="bold" className="w-5 h-5 text-[var(--vibe)]" />
      </div>
      <span className={`text-sm font-semibold transition-colors ${isOpen ? "text-[var(--vibe)]" : "text-[var(--soft)]"}`}>
        Add a Theater
      </span>
      <span className="text-2xs text-[var(--muted)] max-w-[180px] text-center leading-relaxed">
        Track showtimes from your favorite theaters
      </span>
    </button>
  );
}

// ── TheaterPicker ────────────────────────────────────────────────────

function TheaterPicker({
  chains,
  search,
  onSearchChange,
  onAdd,
  onClose,
}: {
  chains: TheaterItem[];
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-2 rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--cream)]">
          Add a theater
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          aria-label="Close picker"
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
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--void)] border border-[var(--twilight)] text-xs text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--vibe)] transition-colors"
        />
      </div>

      {/* Theater list */}
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {chains.length === 0 ? (
          <p className="text-xs text-[var(--muted)] py-3 text-center">
            {search ? "No theaters match your search" : "No chain theaters available"}
          </p>
        ) : (
          chains.map((theater) => (
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
                onClick={() => onAdd(theater.venue_slug)}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-[var(--vibe)]/15 text-[var(--vibe)] text-2xs font-semibold hover:bg-[var(--vibe)]/25 transition-colors"
              >
                Add
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

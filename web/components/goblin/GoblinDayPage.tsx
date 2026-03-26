"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import GoblinMovieCard, { type GoblinMovie, normalizeStreaming } from "./GoblinMovieCard";
import GoblinSessionView from "./GoblinSessionView";
import GoblinSessionHistory from "./GoblinSessionHistory";
import { GoblinAuthBar } from "./GoblinAuthBar";
import { useGoblinUser } from "@/lib/hooks/useGoblinUser";

interface Props {
  initialMovies: GoblinMovie[];
  activeSessionId: number | null;
}

type Tab = "next" | "contenders" | "upcoming" | "watched" | "mylist";
type SortKey = "date" | "critics" | "audience" | "tmdb" | "alpha";
type GenreFilter = string | null;
type SubgenreFilter = string | null;
type TheaterFilter = boolean;

// Keyword-based horror sub-genres — curated from high-frequency keywords
const SUBGENRE_KEYWORDS: { label: string; match: string[] }[] = [
  { label: "Found Footage", match: ["found footage"] },
  { label: "Slasher", match: ["slasher"] },
  { label: "Supernatural", match: ["supernatural horror", "supernatural"] },
  { label: "Body Horror", match: ["body horror"] },
  { label: "Folk Horror", match: ["folk horror"] },
  { label: "Zombie", match: ["zombie"] },
  { label: "Possession", match: ["demonic possession", "possession"] },
  { label: "Haunted House", match: ["haunted house", "haunted"] },
  { label: "Survival", match: ["survival horror", "survival"] },
  { label: "Psychological", match: ["psychological horror", "psychological thriller", "psychological"] },
  { label: "Dark Comedy", match: ["dark comedy", "comedy horror"] },
  { label: "Gore", match: ["gore"] },
  { label: "Serial Killer", match: ["serial killer"] },
  { label: "Based On", match: ["based on novel or book", "based on video game", "based on short story", "remake"] },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "critics", label: "CRITICS" },
  { key: "audience", label: "AUDIENCE" },
  { key: "tmdb", label: "TMDB" },
  { key: "date", label: "DATE" },
  { key: "alpha", label: "A-Z" },
];

function sortMovies(movies: GoblinMovie[], sortKey: SortKey): GoblinMovie[] {
  return [...movies].sort((a, b) => {
    switch (sortKey) {
      case "critics":
        return (b.rt_critics_score ?? -1) - (a.rt_critics_score ?? -1);
      case "audience":
        return (b.rt_audience_score ?? -1) - (a.rt_audience_score ?? -1);
      case "tmdb":
        return (b.tmdb_vote_average ?? -1) - (a.tmdb_vote_average ?? -1);
      case "alpha":
        return a.title.localeCompare(b.title);
      case "date":
      default:
        if (!a.release_date && !b.release_date) return 0;
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return a.release_date.localeCompare(b.release_date);
    }
  });
}

const MARQUEE_IMAGES = [
  { src: "/goblin-day/goblin-1.jpg", alt: "goblin" },
  { src: "/goblin-day/pizza-1.jpg", alt: "pizza" },
  { src: "/goblin-day/basset-1.jpg", alt: "basset hound" },
  { src: "/goblin-day/apple-1.jpg", alt: "apple" },
  { src: "/goblin-day/goblin-2.jpg", alt: "goblin" },
  { src: "/goblin-day/pizza-2.jpg", alt: "pizza" },
  { src: "/goblin-day/basset-2.jpg", alt: "basset hound" },
  { src: "/goblin-day/goblin-3.jpg", alt: "goblin" },
  { src: "/goblin-day/pizza-3.jpg", alt: "pizza" },
  { src: "/goblin-day/basset-3.jpg", alt: "basset hound" },
];

const ZALGO_TEXT = "G\u0336\u0322\u0327\u0321\u030e\u0351\u034b\u0352\u0314\u0310\u0301\u030a\u0306\u0300\u030d\u031c\u031f\u0329\u0347\u0320\u031e\u0345\u032eO\u0334\u0321\u0328\u031c\u0326\u0324\u031f\u0356\u032c\u032b\u0323\u0349\u034e\u0353\u0339\u0316\u0355\u0330\u031d\u032f\u0354\u0301\u030c\u0313\u0307\u0302\u030a\u0363\u0310\u0351\u030e\u034a\u0311\u0357\u0300\u0303\u036b\u036aB\u0337\u0321\u0329\u0326\u031e\u032c\u0339\u034d\u0345\u031f\u0320\u032a\u032e\u0348\u0316\u031c\u0353\u0332\u0347\u0354\u0301\u0303\u0304\u0312\u030c\u0307\u030d\u030f\u0302\u0315\u0308\u036f\u035b\u0352\u034a\u034c\u036d\u0305\u0363\u036eL\u0334\u0321\u031d\u031c\u031e\u0329\u032a\u0339\u034e\u0316\u0356\u0345\u032f\u031f\u032b\u034d\u0353\u0355\u033b\u0332\u030b\u030f\u0312\u030d\u0303\u0311\u0351\u0306\u0300\u036c\u034b\u034a\u0310\u0357\u0363\u0365I\u0336\u0321\u0331\u032c\u0329\u031e\u0347\u031f\u034e\u032a\u0345\u032b\u034d\u0339\u033b\u033c\u032f\u0301\u030c\u0302\u0300\u0305\u0307\u030a\u0352\u036a\u036b\u0313\u034c\u0351\u0311N\u0334\u0328\u031c\u031e\u0320\u032c\u0324\u034e\u0349\u0339\u034d\u0356\u0316\u033c\u032f\u032a\u031d\u0345\u0300\u0303\u030d\u0312\u0352\u030e\u036f\u036b\u034a\u035b\u0306\u0310\u0315\u0363 D\u0336\u0323\u034d\u0316\u032f\u032b\u031d\u034e\u0356\u032a\u031e\u031f\u0339\u031c\u0349\u0347\u032c\u0345\u0355\u033b\u0332\u0305\u0311\u0301\u030c\u0307\u0300\u030a\u034b\u034a\u036c\u0357\u0352\u0350\u0314\u0351\u0363\u036fA\u0336\u0329\u032a\u031e\u032c\u0331\u031f\u032f\u034e\u032b\u031d\u034d\u031c\u0320\u0339\u0347\u0345\u0316\u0353\u030d\u030c\u0300\u0305\u0307\u0303\u030a\u030f\u0315\u034b\u036e\u0312\u035b\u034a\u0306\u0357\u036b\u034c\u0314\u0310\u0363Y\u0337\u032a\u0339\u034e\u0349\u0316\u0323\u031e\u0356\u032b\u034d\u031d\u031c\u031f\u032f\u0347\u0345\u0354\u0332\u033c\u0301\u0300\u0303\u030d\u0312\u0305\u0311\u030c\u030f\u030a\u0306\u0352\u034a\u034b\u0363\u036e\u0357\u0310\u036b\u0351\u036f\u035b";

const VALID_TABS: Tab[] = ["next", "contenders", "upcoming", "watched", "mylist"];
const VALID_SORTS: SortKey[] = ["date", "critics", "audience", "tmdb", "alpha"];

function updateURL(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", url.toString());
}

export default function GoblinDayPage({ initialMovies, activeSessionId }: Props) {
  const searchParams = useSearchParams();
  const goblinUser = useGoblinUser();

  // Initialize state from URL params
  const initialTab = useMemo(() => {
    const t = searchParams.get("tab") as Tab | null;
    return t && VALID_TABS.includes(t) ? t : "next";
  }, [searchParams]);

  const initialSort = useMemo(() => {
    const s = searchParams.get("sort") as SortKey | null;
    return s && VALID_SORTS.includes(s) ? s : "critics";
  }, [searchParams]);

  const [movies, setMovies] = useState(initialMovies);
  const [activeTab, setActiveTabState] = useState<Tab>(initialTab);
  const [sortKey, setSortKeyState] = useState<SortKey>(initialSort);
  const [genreFilter, setGenreFilterState] = useState<GenreFilter>(searchParams.get("genre") || null);
  const [subgenreFilter, setSubgenreFilterState] = useState<SubgenreFilter>(searchParams.get("subgenre") || null);
  const [theaterFilter, setTheaterFilterState] = useState<TheaterFilter>(searchParams.get("theaters") === "1");

  // Wrapped setters that sync to URL
  const setActiveTab = useCallback((tab: Tab) => {
    setActiveTabState(tab);
    updateURL({ tab: tab === "next" ? null : tab, sort: null, genre: null, subgenre: null, theaters: null });
    // Reset filters when switching tabs
    setGenreFilterState(null);
    setSubgenreFilterState(null);
    setTheaterFilterState(false);
    setSortKeyState("critics");
  }, []);

  const setSortKey = useCallback((key: SortKey) => {
    setSortKeyState(key);
    updateURL({ sort: key === "critics" ? null : key });
  }, []);

  const setGenreFilter = useCallback((genre: GenreFilter) => {
    setGenreFilterState(genre);
    updateURL({ genre });
  }, []);

  const setSubgenreFilter = useCallback((sg: SubgenreFilter) => {
    setSubgenreFilterState(sg);
    updateURL({ subgenre: sg });
  }, []);

  const setTheaterFilter = useCallback((on: TheaterFilter) => {
    setTheaterFilterState(on);
    updateURL({ theaters: on ? "1" : null });
  }, []);

  // Session state
  const [sessionId, setSessionId] = useState<number | null>(activeSessionId);
  const [sessionData, setSessionData] = useState<any>(null);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Fetch active session detail
  const fetchSession = useCallback(async (id: number) => {
    const res = await fetch(`/api/goblinday/sessions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSessionData(data);
    }
  }, []);

  // Fetch sessions list (for history)
  const fetchSessionsList = useCallback(async () => {
    const res = await fetch("/api/goblinday/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessionsList(data);
      setSessionsLoaded(true);
    }
  }, []);

  // Load session data when tab is active
  useEffect(() => {
    if (activeTab === "next") {
      if (sessionId) fetchSession(sessionId);
      else fetchSessionsList();
    }
  }, [activeTab, sessionId, fetchSession, fetchSessionsList]);

  const handleStartSession = useCallback(async () => {
    const res = await fetch("/api/goblinday/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      setSessionId(data.id);
      fetchSession(data.id);
    }
  }, [fetchSession]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`/api/goblinday/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    setSessionId(null);
    setSessionData(null);
    // Refresh movies (some may now be marked watched)
    const moviesRes = await fetch("/api/goblinday");
    if (moviesRes.ok) setMovies(await moviesRes.json());
    fetchSessionsList();
  }, [sessionId, fetchSessionsList]);

  const handleSessionRefresh = useCallback(() => {
    if (sessionId) fetchSession(sessionId);
  }, [sessionId, fetchSession]);

  const handleDeleteSession = useCallback(async (id: number) => {
    await fetch(`/api/goblinday/sessions/${id}`, { method: "DELETE" });
    setSessionsList((prev) => prev.filter((s) => s.id !== id));
    if (sessionId === id) {
      setSessionId(null);
      setSessionData(null);
    }
  }, [sessionId]);

  const now = new Date().toISOString().slice(0, 10);
  const isReleased = (m: GoblinMovie) =>
    m.release_date ? m.release_date <= now : false;

  // Build genre list from contenders for filter chips
  const contenderMovies = movies.filter((m) => !goblinUser.watched.has(m.id) && isReleased(m));
  const genreCounts = new Map<string, number>();
  for (const m of contenderMovies) {
    for (const g of m.genres ?? []) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  // Sort genres by count descending, exclude "Horror" (everything is horror)
  const availableGenres = [...genreCounts.entries()]
    .filter(([g]) => g !== "Horror")
    .sort((a, b) => b[1] - a[1])
    .map(([g, count]) => ({ genre: g, count }));

  // Build sub-genre counts from keywords
  const movieMatchesSubgenre = (m: GoblinMovie, matchKeywords: string[]) =>
    (m.keywords ?? []).some((kw) =>
      matchKeywords.some((mk) => kw.toLowerCase().includes(mk))
    );

  const availableSubgenres = SUBGENRE_KEYWORDS
    .map(({ label, match }) => ({
      label,
      match,
      count: contenderMovies.filter((m) => movieMatchesSubgenre(m, match)).length,
    }))
    .filter(({ count }) => count > 0);

  const theatersCount = contenderMovies.filter(
    (m) => normalizeStreaming(m.streaming_info).theaters
  ).length;

  const filteredMovies = sortMovies(
    movies.filter((m) => {
      const mBookmarked = goblinUser.bookmarks.has(m.id);
      const mWatched = goblinUser.watched.has(m.id);
      switch (activeTab) {
        case "next":
          return mBookmarked && !mWatched;
        case "contenders": {
          if (mWatched || !isReleased(m)) return false;
          if (genreFilter && !(m.genres ?? []).includes(genreFilter)) return false;
          if (subgenreFilter) {
            const sg = availableSubgenres.find((s) => s.label === subgenreFilter);
            if (sg && !movieMatchesSubgenre(m, sg.match)) return false;
          }
          if (theaterFilter && !normalizeStreaming(m.streaming_info).theaters) return false;
          return true;
        }
        case "upcoming":
          return !mWatched && !isReleased(m);
        case "watched":
          return mWatched;
        case "mylist":
          return mBookmarked;
      }
    }),
    activeTab === "contenders" ? sortKey : "date"
  );

  const counts = {
    next: movies.filter((m) => goblinUser.bookmarks.has(m.id) && !goblinUser.watched.has(m.id)).length,
    contenders: movies.filter((m) => !goblinUser.watched.has(m.id) && isReleased(m)).length,
    upcoming: movies.filter((m) => !goblinUser.watched.has(m.id) && !isReleased(m)).length,
    watched: goblinUser.watched.size,
    mylist: goblinUser.bookmarks.size,
  };

  const handleToggleBookmark = useCallback(
    (id: number) => {
      goblinUser.toggleBookmark(id);
    },
    [goblinUser]
  );

  const handleToggleWatched = useCallback(
    (id: number) => {
      goblinUser.toggleWatched(id);
    },
    [goblinUser]
  );

  const marqueeStrip = MARQUEE_IMAGES.flatMap((img, i) => [
    <img
      key={`img-${i}`}
      src={img.src}
      alt={img.alt}
      className="h-24 w-32 object-cover flex-shrink-0 grayscale contrast-125 mix-blend-luminosity"
    />,
    <span
      key={`txt-${i}`}
      className="flex-shrink-0 px-8 text-3xl sm:text-4xl font-black tracking-[0.2em] text-red-600 font-mono uppercase drop-shadow-[0_0_12px_rgba(220,38,38,0.6)]"
    >
      {ZALGO_TEXT}
    </span>,
  ]);

  const TAB_CONFIG = [
    { key: "next" as const, label: "\u2666 NEXT", labelLong: "\u2666 NEXT GOBLIN DAY", active: "bg-red-900/80 text-red-300 border-red-500 shadow-[0_4px_12px_rgba(185,28,28,0.3)]" },
    { key: "contenders" as const, label: "\u2620 CONTENDERS", labelLong: "\u2620 CONTENDERS", active: "bg-zinc-900 text-white border-zinc-400 shadow-[0_4px_12px_rgba(255,255,255,0.05)]" },
    { key: "upcoming" as const, label: "\u29D6 UPCOMING", labelLong: "\u29D6 UPCOMING", active: "bg-zinc-900 text-violet-400 border-violet-500 shadow-[0_4px_12px_rgba(139,92,246,0.15)]" },
    { key: "watched" as const, label: "\u2620 WATCHED", labelLong: "\u2620 WATCHED", active: "bg-zinc-900 text-emerald-400 border-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.15)]" },
    { key: "mylist" as const, label: "\u2665 LIST", labelLong: "\u2665 MY LIST", active: "bg-zinc-900 text-red-400 border-red-700 shadow-[0_4px_12px_rgba(185,28,28,0.15)]" },
  ];

  // Matrix rain of ancient/occult symbols
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ancient/occult Unicode symbols — alchemical, runic, cuneiform, occult
    const symbols = [
      // Alchemical
      "\u{1F700}","\u{1F701}","\u{1F702}","\u{1F703}","\u{1F704}","\u{1F705}","\u{1F706}","\u{1F707}",
      "\u{1F708}","\u{1F709}","\u{1F70A}","\u{1F70B}","\u{1F70C}","\u{1F70D}","\u{1F70E}","\u{1F70F}",
      "\u{1F710}","\u{1F711}","\u{1F712}","\u{1F713}","\u{1F714}","\u{1F715}","\u{1F716}","\u{1F717}",
      "\u{1F718}","\u{1F719}","\u{1F71A}","\u{1F71B}","\u{1F71C}","\u{1F71D}","\u{1F71E}","\u{1F71F}",
      // Elder Futhark runes
      "\u16A0","\u16A1","\u16A2","\u16A3","\u16A4","\u16A5","\u16A6","\u16A7","\u16A8",
      "\u16A9","\u16AA","\u16AB","\u16AC","\u16AD","\u16AE","\u16AF","\u16B0","\u16B1",
      // Misc occult / astrological
      "\u2720","\u2721","\u2625","\u2626","\u262D","\u262E","\u262F","\u2638","\u263D","\u263E",
      "\u2640","\u2642","\u2643","\u2644","\u2645","\u2646","\u2647","\u2648","\u2649",
      "\u264A","\u264B","\u264C","\u264D","\u264E","\u264F","\u2650","\u2651","\u2652","\u2653",
      // Pentagrams / crosses
      "\u26E4","\u26E5","\u26E6","\u26E7","\u2628","\u2629",
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(0).map(() => Math.random() * -100);

    // Blood drips — slow irregular streaks from the top
    interface Drip {
      x: number;
      y: number;
      speed: number;
      width: number;
      length: number;
      opacity: number;
    }
    const drips: Drip[] = [];
    const MAX_DRIPS = 15;
    const spawnDrip = () => {
      if (drips.length < MAX_DRIPS) {
        drips.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * 200,
          speed: 0.15 + Math.random() * 0.4,
          width: 1.5 + Math.random() * 2.5,
          length: 40 + Math.random() * 120,
          opacity: 0.06 + Math.random() * 0.08,
        });
      }
    };
    // Seed a few drips
    for (let i = 0; i < 8; i++) spawnDrip();

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw blood drips
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        const gradient = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.length);
        gradient.addColorStop(0, `rgba(120, 10, 10, 0)`);
        gradient.addColorStop(0.3, `rgba(120, 10, 10, ${d.opacity})`);
        gradient.addColorStop(0.85, `rgba(80, 5, 5, ${d.opacity * 0.7})`);
        gradient.addColorStop(1, `rgba(60, 0, 0, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + d.length * 0.5, d.width * 0.5, d.length * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bulge at bottom tip
        ctx.beginPath();
        ctx.arc(d.x, d.y + d.length, d.width * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 8, 8, ${d.opacity * 0.5})`;
        ctx.fill();

        d.y += d.speed;
        if (d.y > canvas.height + d.length) {
          drips.splice(i, 1);
        }
      }
      // Occasionally spawn new drips
      if (Math.random() < 0.02) spawnDrip();

      // Draw symbol rain
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = symbols[Math.floor(Math.random() * symbols.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Dark red
        const alpha = 0.25 + Math.random() * 0.15;
        ctx.fillStyle = `rgba(153, 27, 27, ${alpha})`;
        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.985) {
          drops[i] = 0;
        }
        drops[i] += 0.3 + Math.random() * 0.2;
      }
    };

    const interval = setInterval(draw, 80);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-mono relative">
      {/* Matrix rain background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />
      {/* Auth bar */}
      <GoblinAuthBar
        user={goblinUser.user}
        loading={goblinUser.loading}
        onSignIn={goblinUser.signIn}
        onSignOut={goblinUser.signOut}
      />

      {/* Scrolling Marquee */}
      <div className="overflow-hidden bg-black/90 select-none border-b-4 border-red-800 relative z-10">
        <div className="flex items-center whitespace-nowrap animate-marquee">
          {marqueeStrip}
          {marqueeStrip}
        </div>
      </div>

      {/* Tabs — brutalist rectangles */}
      <div className="flex sm:justify-center overflow-x-auto scrollbar-hide border-b-2 border-zinc-800 relative z-10 bg-black/90">
        {TAB_CONFIG.map(({ key, label, labelLong, active }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 flex-1 sm:flex-none min-w-0 px-3 sm:px-8 py-3 text-xs sm:text-sm font-bold tracking-[0.1em] sm:tracking-[0.15em] uppercase border-b-3 transition-all duration-200 whitespace-nowrap ${
              activeTab === key
                ? active
                : "bg-black text-zinc-600 border-transparent hover:text-red-400/60 hover:bg-red-950/10 hover:border-red-900/30"
            }`}
          >
            <span className="sm:hidden">{label}</span>
            <span className="hidden sm:inline">{labelLong}</span>
            {counts[key] > 0 && (
              <span className="ml-1.5 sm:ml-2 text-xs opacity-60">[{counts[key]}]</span>
            )}
          </button>
        ))}
      </div>

      {/* Sort Bar (contenders only) */}
      {activeTab === "contenders" && (
        <>
          <div className="flex justify-center gap-0 border-b border-zinc-800 relative z-10 bg-black/90">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`px-4 py-2 text-2xs font-bold tracking-[0.2em] uppercase transition-all ${
                  sortKey === key
                    ? "bg-red-950/30 text-red-500 border-b-2 border-red-500 shadow-[0_2px_8px_rgba(185,28,28,0.2)]"
                    : "bg-black text-zinc-600 hover:text-red-400/50 hover:bg-red-950/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Filter chips — row 1: theaters + genres */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 pt-2 pb-1 relative z-10 bg-black/90">
            {/* In Theaters */}
            {theatersCount > 0 && (
              <button
                onClick={() => setTheaterFilter(!theaterFilter)}
                className={`flex-shrink-0 px-2.5 py-1 text-2xs font-bold tracking-[0.15em] uppercase transition-all border ${
                  theaterFilter
                    ? "bg-red-900/60 text-red-300 border-red-600 shadow-[0_0_8px_rgba(185,28,28,0.3)]"
                    : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-red-400/60 hover:border-red-900/40"
                }`}
              >
                IN THEATERS [{theatersCount}]
              </button>
            )}
            {/* Genre filters */}
            {availableGenres.map(({ genre, count }) => (
              <button
                key={genre}
                onClick={() => setGenreFilter(genreFilter === genre ? null : genre)}
                className={`flex-shrink-0 px-2.5 py-1 text-2xs font-bold tracking-[0.15em] uppercase transition-all border ${
                  genreFilter === genre
                    ? "bg-violet-900/50 text-violet-300 border-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.2)]"
                    : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-violet-400/60 hover:border-violet-900/40"
                }`}
              >
                {genre} [{count}]
              </button>
            ))}
          </div>
          {/* Filter chips — row 2: keyword sub-genres */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 pb-2 pt-0.5 border-b border-zinc-800/50 relative z-10 bg-black/90">
            {availableSubgenres.map(({ label, count }) => (
              <button
                key={label}
                onClick={() => setSubgenreFilter(subgenreFilter === label ? null : label)}
                className={`flex-shrink-0 px-2.5 py-1 text-2xs font-bold tracking-[0.15em] uppercase transition-all border ${
                  subgenreFilter === label
                    ? "bg-orange-900/50 text-orange-300 border-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.2)]"
                    : "bg-zinc-950 text-zinc-600 border-zinc-800/60 hover:text-orange-400/60 hover:border-orange-900/40"
                }`}
              >
                {label} [{count}]
              </button>
            ))}
            {/* Clear all filters */}
            {(genreFilter || subgenreFilter || theaterFilter) && (
              <button
                onClick={() => { setGenreFilter(null); setSubgenreFilter(null); setTheaterFilter(false); }}
                className="flex-shrink-0 px-2.5 py-1 text-2xs font-bold tracking-[0.15em] uppercase text-zinc-600 hover:text-white transition-all"
              >
                CLEAR
              </button>
            )}
          </div>
        </>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16 relative z-10">
        {activeTab === "next" ? (
          // Session view + proposed movies
          <>
            {sessionId && sessionData ? (
              <GoblinSessionView
                session={sessionData}
                proposedMovies={movies
                  .filter((m) => goblinUser.bookmarks.has(m.id) && !goblinUser.watched.has(m.id))
                  .map((m) => ({ id: m.id, title: m.title, poster_path: m.poster_path }))}
                onRefresh={handleSessionRefresh}
                onEndSession={handleEndSession}
              />
            ) : (
              <GoblinSessionHistory
                sessions={sessionsList}
                onStartSession={handleStartSession}
                onDeleteSession={handleDeleteSession}
              />
            )}

            {/* Proposed movies grid */}
            {filteredMovies.length > 0 && (
              <>
                <div className="border-t-2 border-zinc-800 mt-8 pt-6 mb-4">
                  <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-red-500">
                    SAVED FOR NEXT GOBLIN DAY [{filteredMovies.length}]
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredMovies.map((movie) => (
                    <GoblinMovieCard
                      key={movie.id}
                      movie={movie}
                      isBookmarked={goblinUser.bookmarks.has(movie.id)}
                      isWatched={goblinUser.watched.has(movie.id)}
                      onToggleBookmark={handleToggleBookmark}
                      onToggleWatched={handleToggleWatched}
                    />
                  ))}
                </div>
              </>
            )}

            {filteredMovies.length === 0 && !sessionId && (
              <p className="text-center text-zinc-600 py-10 text-sm tracking-widest uppercase">
                // NOTHING SAVED YET — GO TO CONTENDERS AND SAVE SOME
              </p>
            )}
          </>
        ) : (
          // Movie grid for contenders/upcoming/watched/mylist
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredMovies.map((movie) => (
                <GoblinMovieCard
                  key={movie.id}
                  movie={movie}
                  isBookmarked={goblinUser.bookmarks.has(movie.id)}
                  isWatched={goblinUser.watched.has(movie.id)}
                  onToggleBookmark={handleToggleBookmark}
                  onToggleWatched={handleToggleWatched}
                />
              ))}
            </div>

            {filteredMovies.length === 0 && (
              <p className="text-center text-zinc-600 py-20 text-sm tracking-widest uppercase">
                {activeTab === "watched"
                  ? "// NOTHING WATCHED — GET TO IT GOBLINS"
                  : activeTab === "upcoming"
                    ? "// NO UPCOMING — EVERYTHING IS OUT"
                    : activeTab === "mylist"
                      ? "// NO SAVED MOVIES — SAVE SOME FROM CONTENDERS"
                      : "// NO CONTENDERS — RUN THE SEED SCRIPT"}
              </p>
            )}
          </>
        )}
      </main>

      {/* Marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}

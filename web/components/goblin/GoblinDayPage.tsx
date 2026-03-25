"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import GoblinMovieCard, { type GoblinMovie } from "./GoblinMovieCard";

interface Props {
  initialMovies: GoblinMovie[];
}

type Tab = "next" | "contenders" | "upcoming" | "watched";
type SortKey = "date" | "critics" | "audience" | "alpha";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "DATE" },
  { key: "critics", label: "CRITICS" },
  { key: "audience", label: "AUDIENCE" },
  { key: "alpha", label: "A-Z" },
];

function sortMovies(movies: GoblinMovie[], sortKey: SortKey): GoblinMovie[] {
  return [...movies].sort((a, b) => {
    switch (sortKey) {
      case "critics":
        return (b.rt_critics_score ?? -1) - (a.rt_critics_score ?? -1);
      case "audience":
        return (b.rt_audience_score ?? -1) - (a.rt_audience_score ?? -1);
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

export default function GoblinDayPage({ initialMovies }: Props) {
  const [movies, setMovies] = useState(initialMovies);
  const [activeTab, setActiveTab] = useState<Tab>("next");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const now = new Date().toISOString().slice(0, 10);
  const isReleased = (m: GoblinMovie) =>
    m.release_date ? m.release_date <= now : false;

  const filteredMovies = sortMovies(
    movies.filter((m) => {
      switch (activeTab) {
        case "next":
          return m.proposed && !m.watched;
        case "contenders":
          return !m.watched && isReleased(m);
        case "upcoming":
          return !m.watched && !isReleased(m);
        case "watched":
          return m.watched;
      }
    }),
    activeTab === "contenders" ? sortKey : "date"
  );

  const counts = {
    next: movies.filter((m) => m.proposed && !m.watched).length,
    contenders: movies.filter((m) => !m.watched && isReleased(m)).length,
    upcoming: movies.filter((m) => !m.watched && !isReleased(m)).length,
    watched: movies.filter((m) => m.watched).length,
  };

  const handleToggle = useCallback(
    async (id: number, field: string, value: boolean) => {
      setMovies((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );
      try {
        const res = await fetch(`/api/goblinday/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          setMovies((prev) =>
            prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m))
          );
        }
      } catch {
        setMovies((prev) =>
          prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m))
        );
      }
    },
    []
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
    { key: "next" as const, label: "NEXT GOBLIN DAY", active: "bg-red-700 text-white border-red-500" },
    { key: "contenders" as const, label: "CONTENDERS", active: "bg-zinc-800 text-white border-zinc-500" },
    { key: "upcoming" as const, label: "UPCOMING", active: "bg-zinc-800 text-violet-400 border-violet-500" },
    { key: "watched" as const, label: "WATCHED", active: "bg-zinc-800 text-emerald-400 border-emerald-500" },
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

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      {/* Scrolling Marquee */}
      <div className="overflow-hidden bg-black/90 select-none border-b-4 border-red-800 relative z-10">
        <div className="flex items-center whitespace-nowrap animate-marquee">
          {marqueeStrip}
          {marqueeStrip}
        </div>
      </div>

      {/* Tabs — brutalist rectangles */}
      <div className="flex flex-wrap justify-center gap-0 border-b-2 border-zinc-800 relative z-10 bg-black/90">
        {TAB_CONFIG.map(({ key, label, active }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 sm:px-8 py-3 text-xs sm:text-sm font-bold tracking-[0.15em] uppercase border-b-3 transition-colors ${
              activeTab === key
                ? active
                : "bg-black text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-zinc-950"
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className="ml-2 text-xs opacity-60">[{counts[key]}]</span>
            )}
          </button>
        ))}
      </div>

      {/* Sort Bar (contenders only) */}
      {activeTab === "contenders" && (
        <div className="flex justify-center gap-0 border-b border-zinc-800 relative z-10 bg-black/90">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`px-4 py-2 text-2xs font-bold tracking-[0.2em] uppercase transition-colors ${
                sortKey === key
                  ? "bg-zinc-900 text-red-500 border-b-2 border-red-500"
                  : "bg-black text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Movie Grid */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredMovies.map((movie) => (
            <GoblinMovieCard
              key={movie.id}
              movie={movie}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {filteredMovies.length === 0 && (
          <p className="text-center text-zinc-600 py-20 text-sm tracking-widest uppercase">
            {activeTab === "next"
              ? "// NO PROPOSALS YET — GO PICK SOME CONTENDERS"
              : activeTab === "watched"
                ? "// NOTHING WATCHED — GET TO IT GOBLINS"
                : activeTab === "upcoming"
                  ? "// NO UPCOMING — EVERYTHING IS OUT"
                  : "// NO CONTENDERS — RUN THE SEED SCRIPT"}
          </p>
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

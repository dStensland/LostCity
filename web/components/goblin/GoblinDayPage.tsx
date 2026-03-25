"use client";

import { useState, useCallback } from "react";
import GoblinMovieCard, { type GoblinMovie } from "./GoblinMovieCard";

interface Props {
  initialMovies: GoblinMovie[];
}

type Tab = "next" | "contenders" | "watched";
type SortKey = "date" | "critics" | "audience" | "alpha";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Release Date" },
  { key: "critics", label: "Critics Score" },
  { key: "audience", label: "Audience Score" },
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

// Zalgo text generator — corrupts text with combining diacritical marks
function zalgoify(text: string): string {
  const above = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030A','\u030B','\u030C','\u030D','\u030E','\u030F','\u0310','\u0311','\u0312','\u0313','\u0314','\u0315','\u031A','\u033D','\u034A','\u034B','\u034C','\u0350','\u0351','\u0352','\u0357','\u035B','\u0363','\u0364','\u0365','\u0366','\u0367','\u0368','\u0369','\u036A','\u036B','\u036C','\u036D','\u036E','\u036F'];
  const below = ['\u0316','\u0317','\u0318','\u0319','\u031C','\u031D','\u031E','\u031F','\u0320','\u0321','\u0322','\u0323','\u0324','\u0325','\u0326','\u0327','\u0328','\u0329','\u032A','\u032B','\u032C','\u032D','\u032E','\u032F','\u0330','\u0331','\u0332','\u0333','\u0339','\u033A','\u033B','\u033C','\u0345','\u0347','\u0348','\u0349','\u034D','\u034E','\u0353','\u0354','\u0355','\u0356','\u0359','\u035A'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return text.split('').map(c => {
    if (c === ' ') return c;
    let out = c;
    const numAbove = 2 + Math.floor(Math.random() * 3);
    const numBelow = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numAbove; i++) out += pick(above);
    for (let i = 0; i < numBelow; i++) out += pick(below);
    return out;
  }).join('');
}

const ZALGO_TEXT = zalgoify("GOBLIN DAY");

export default function GoblinDayPage({ initialMovies }: Props) {
  const [movies, setMovies] = useState(initialMovies);
  const [activeTab, setActiveTab] = useState<Tab>("next");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const filteredMovies = sortMovies(
    movies.filter((m) => {
      switch (activeTab) {
        case "next":
          return m.proposed && !m.watched;
        case "contenders":
          return !m.watched;
        case "watched":
          return m.watched;
      }
    }),
    activeTab === "contenders" ? sortKey : "date"
  );

  const counts = {
    next: movies.filter((m) => m.proposed && !m.watched).length,
    contenders: movies.filter((m) => !m.watched).length,
    watched: movies.filter((m) => m.watched).length,
  };

  const handleToggle = useCallback(
    async (id: number, field: string, value: boolean) => {
      setMovies((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );

      try {
        const res = await fetch(`/api/goblin-day/${id}`, {
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

  const marqueeStrip = MARQUEE_IMAGES.map((img, i) => (
    <span key={i} className="inline-flex items-center gap-4 mx-2">
      <img
        src={img.src}
        alt={img.alt}
        className="h-16 w-16 rounded-lg object-cover border-2 border-red-900/60"
      />
      <span className="text-2xl sm:text-3xl font-black tracking-widest text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]">
        {ZALGO_TEXT}
      </span>
    </span>
  ));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Scrolling Marquee */}
      <div className="overflow-hidden bg-black py-4 select-none border-b border-red-900/30">
        <div className="flex items-center whitespace-nowrap animate-marquee">
          <span className="inline-flex items-center">{marqueeStrip}</span>
          <span className="inline-flex items-center">{marqueeStrip}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8 mt-6 px-4">
        {(
          [
            { key: "next", label: "Next Goblin Day" },
            { key: "contenders", label: "Contenders" },
            { key: "watched", label: "Watched" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === key
                ? key === "next"
                  ? "bg-orange-600 text-white"
                  : key === "watched"
                    ? "bg-emerald-700 text-white"
                    : "bg-zinc-700 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sort Bar (contenders only) */}
      {activeTab === "contenders" && (
        <div className="flex justify-center gap-1.5 mb-6 px-4">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                sortKey === key
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Movie Grid */}
      <main className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMovies.map((movie) => (
            <GoblinMovieCard
              key={movie.id}
              movie={movie}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {filteredMovies.length === 0 && (
          <p className="text-center text-zinc-500 py-16">
            {activeTab === "next"
              ? "No movies proposed yet. Go to Contenders and propose some!"
              : activeTab === "watched"
                ? "Haven't watched anything yet. Get to it, goblins!"
                : "No contenders. Run the seed script!"}
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
          animation: marquee 15s linear infinite;
        }
      `}</style>
    </div>
  );
}

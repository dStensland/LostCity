"use client";

import { useState, useCallback } from "react";
import GoblinMovieCard, { type GoblinMovie } from "./GoblinMovieCard";

interface Props {
  initialMovies: GoblinMovie[];
}

type Tab = "next" | "contenders" | "upcoming" | "watched";
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

  const marqueeStrip = MARQUEE_IMAGES.flatMap((img, i) => [
    <img
      key={`img-${i}`}
      src={img.src}
      alt={img.alt}
      className="h-20 w-28 object-cover flex-shrink-0"
    />,
    <span
      key={`txt-${i}`}
      className="flex-shrink-0 px-6 text-2xl sm:text-3xl font-black tracking-widest text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]"
    >
      {ZALGO_TEXT}
    </span>,
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Scrolling Marquee */}
      <div className="overflow-hidden bg-black select-none border-b border-red-900/30">
        <div className="flex items-center whitespace-nowrap animate-marquee">
          {marqueeStrip}
          {marqueeStrip}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8 mt-6 px-4">
        {(
          [
            { key: "next", label: "Next Goblin Day" },
            { key: "contenders", label: "Contenders" },
            { key: "upcoming", label: "Upcoming" },
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
                    : key === "upcoming"
                      ? "bg-violet-700 text-white"
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
                : activeTab === "upcoming"
                  ? "No upcoming movies. Everything's already out!"
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

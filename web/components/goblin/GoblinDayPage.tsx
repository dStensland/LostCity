"use client";

import { useState, useCallback } from "react";
import GoblinMovieCard, { type GoblinMovie } from "./GoblinMovieCard";

interface Props {
  initialMovies: GoblinMovie[];
}

type Tab = "next" | "contenders" | "watched";

const MARQUEE_ITEMS = [
  "\uD83D\uDC7A", // goblin
  "\uD83C\uDF55", // pizza
  "\uD83D\uDC36", // basset hound (dog face)
  "\uD83D\uDC7A",
  "\uD83C\uDF55",
  "\uD83D\uDC15", // dog
  "\uD83D\uDC7A",
  "\uD83C\uDF55",
  "\uD83D\uDC36",
  "\uD83D\uDC7A",
  "\uD83C\uDF55",
  "\uD83D\uDC15",
];

export default function GoblinDayPage({ initialMovies }: Props) {
  const [movies, setMovies] = useState(initialMovies);
  const [activeTab, setActiveTab] = useState<Tab>("next");

  const filteredMovies = movies.filter((m) => {
    switch (activeTab) {
      case "next":
        return m.proposed && !m.watched;
      case "contenders":
        return !m.watched;
      case "watched":
        return m.watched;
    }
  });

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

  const marqueeContent = MARQUEE_ITEMS.join("  GOBLIN DAY  ");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Scrolling Marquee */}
      <div className="overflow-hidden bg-orange-600 py-2 select-none">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-2xl font-black tracking-widest px-4">
            {marqueeContent}
          </span>
          <span className="text-2xl font-black tracking-widest px-4">
            {marqueeContent}
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="text-center py-8 px-4">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-orange-500">
          GOBLIN DAY
        </h1>
        <p className="text-zinc-400 mt-2 text-base">
          Horror movies. Basset hounds. Pizza. Scary vibes.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8 px-4">
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

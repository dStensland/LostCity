"use client";

import { useState, useCallback } from "react";
import GoblinMovieCard, { type GoblinMovie } from "./GoblinMovieCard";

interface Props {
  initialMovies: GoblinMovie[];
}

export default function GoblinDayPage({ initialMovies }: Props) {
  const [movies, setMovies] = useState(initialMovies);
  const [activeYear, setActiveYear] = useState<2025 | 2026>(2026);

  const filteredMovies = movies.filter((m) => m.year === activeYear);

  const handleToggle = useCallback(
    async (id: number, field: string, value: boolean) => {
      // Optimistic update
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
          // Revert on failure
          setMovies((prev) =>
            prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m))
          );
        }
      } catch {
        // Revert on error
        setMovies((prev) =>
          prev.map((m) => (m.id === id ? { ...m, [field]: !value } : m))
        );
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="text-center py-12 px-4">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          🎃 Goblin Day 🎃
        </h1>
        <p className="text-zinc-400 mt-2 text-lg">
          Horror movies. Scary vibes. Daniel & Ashley.
        </p>
      </header>

      {/* Year Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {([2025, 2026] as const).map((year) => (
          <button
            key={year}
            onClick={() => setActiveYear(year)}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              activeYear === year
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
          >
            {year}
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
            No movies yet for {activeYear}. Run the seed script!
          </p>
        )}
      </main>
    </div>
  );
}

"use client";

import { memo } from "react";
import FilterChip from "@/components/filters/FilterChip";
import { GENRE_BUCKETS } from "@/lib/genre-map";

interface GenreFilterStripProps {
  activeGenre: string | null;
  onGenreChange: (genre: string | null) => void;
}

export const GenreFilterStrip = memo(function GenreFilterStrip({
  activeGenre,
  onGenreChange,
}: GenreFilterStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-3">
      <FilterChip
        label="All"
        variant="genre"
        active={activeGenre === null}
        onClick={() => onGenreChange(null)}
        size="sm"
      />
      {GENRE_BUCKETS.map((genre) => (
        <FilterChip
          key={genre}
          label={genre}
          variant="genre"
          active={activeGenre === genre}
          onClick={() => onGenreChange(genre)}
          size="sm"
        />
      ))}
    </div>
  );
});

export type { GenreFilterStripProps };

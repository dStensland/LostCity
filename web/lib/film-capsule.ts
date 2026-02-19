/**
 * Build a short capsule review line from existing series metadata.
 * No AI generation or external API calls — purely computed from OMDB-backfilled data.
 *
 * Examples:
 *   "Indie horror by Robert Eggers (2024)"
 *   "Documentary (2023)"
 *   "Drama by Greta Gerwig (2023)"
 */
export function buildFilmCapsule(series: {
  genres?: string[] | null;
  director?: string | null;
  year?: number | null;
}): string | null {
  const parts: string[] = [];

  // Genre label
  if (series.genres && series.genres.length > 0) {
    const formatted = series.genres
      .slice(0, 2)
      .map((g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase())
      .join(" ");
    parts.push(formatted);
  }

  // Director
  if (series.director) {
    parts.push(`by ${series.director}`);
  }

  // Year
  if (series.year) {
    parts.push(`(${series.year})`);
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}

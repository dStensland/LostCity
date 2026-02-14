/**
 * Client-safe utilities for series display
 * These functions can be used in both client and server components
 */

// Helper to get series type label
export function getSeriesTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    film: "Film",
    recurring_show: "Recurring Show",
    class_series: "Class Series",
    festival_program: "Program",
    tour: "Tour",
    exhibition: "Exhibition",
    other: "Series",
  };
  return labels[type] || "Series";
}

// Helper to get series type color
export function getSeriesTypeColor(type: string): string {
  const colors: Record<string, string> = {
    film: "#A5B4FC", // indigo
    recurring_show: "#F9A8D4", // pink
    class_series: "#6EE7B7", // green
    festival_program: "#FBBF24", // amber
    tour: "#C4B5FD", // purple
    exhibition: "#F59E0B", // amber
    other: "#94A3B8", // slate
  };
  return colors[type] || "#94A3B8";
}

// Helper to format genre for display
export function formatGenre(genre: string): string {
  // Handle special cases
  const special: Record<string, string> = {
    "sci-fi": "Sci-Fi",
    "r&b": "R&B",
    "hip-hop": "Hip-Hop",
    "edm": "EDM",
    "mma": "MMA",
  };
  if (special[genre]) return special[genre];

  // Capitalize first letter of each word
  return genre
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
}

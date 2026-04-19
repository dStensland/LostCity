/**
 * Extract a short "teaser" sentence from a longer description.
 * Returns null if no meaningful teaser can be produced.
 */
export function extractTeaser(input: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (s.length < 30) return null;
  if (s.includes("```")) return null;
  if (/^https?:\/\/\S+$/.test(s)) return null;

  const match = s.match(/^(.{30,180}?[.!?])(\s|$)/);
  if (match) return match[1];

  const hardCap = 160;
  if (s.length <= hardCap) return s;
  const slice = s.slice(0, hardCap);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 100 ? slice.slice(0, lastSpace + 1) : slice;
  return cut + "…";
}

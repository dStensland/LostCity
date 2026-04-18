/**
 * Normalize an artist name for display.
 *
 * Some sources (Ticketmaster) ingest artist names in all caps. We don't want
 * to mutate the canonical data — just present it title-cased when it would
 * otherwise SHOUT. Detection threshold: ≥80% of letter chars are uppercase
 * AND at least 4 letters total. Acronyms ("DJ", "MC", "YACHT", "AJR") that
 * are short stay uppercase.
 */
export function formatArtistName(name: string): string {
  if (!name) return name;
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 4) return name;
  const uppers = letters.replace(/[^A-Z]/g, "").length;
  if (uppers / letters.length < 0.8) return name; // already mixed-case → leave alone
  // Title-case while preserving common all-caps tokens.
  const PRESERVE = new Set(["DJ", "MC", "II", "III", "IV", "VI", "VII", "VIII", "IX"]);
  return name.toLowerCase().split(/(\s+|-|·)/).map((tok) => {
    const upper = tok.toUpperCase();
    if (PRESERVE.has(upper)) return upper;
    // Capitalize at word starts AND at letter-after-digit boundaries (e.g. "1d" → "1D").
    return tok.replace(/(?:^|[\s\-·\d])([a-z])/g, (m, ch) => m.slice(0, -1) + ch.toUpperCase());
  }).join("");
}

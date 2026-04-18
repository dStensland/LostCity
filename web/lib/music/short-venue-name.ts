/**
 * shortVenueName — Collapse a music venue name to a tight display token
 * for the playbill row's 110px column.
 *
 * Mirrors cinema's `shortTheaterName()` (web/components/feed/sections/now-showing/PlaybillRow.tsx):
 * strip leading "The ", "Atlanta ", and common room/suffix words so the name
 * fits the column without truncation in the typical case.
 *
 * Examples:
 *   "The EARL"                       → "EARL"
 *   "The Tabernacle"                 → "Tabernacle"
 *   "Atlanta Symphony Hall"          → "Symphony Hall"
 *   "Smith's Olde Bar (Music Room)"  → "Smith's Olde Bar"
 *   "Eddie's Attic — Listening Room" → "Eddie's Attic"
 */
export function shortVenueName(name: string): string {
  if (!name) return name;
  return name
    .replace(/^(The|Atlanta)\s+/i, "")
    // Strip parenthetical room suffixes: "Smith's Olde Bar (Music Room)" → "Smith's Olde Bar"
    .replace(/\s*\([^)]*\)\s*$/i, "")
    // Strip dash-separated room suffixes: "Eddie's Attic — Listening Room"
    .replace(/\s*[—–-]\s*(Listening Room|Music Room|Main Stage|Side Stage|Atrium|Lounge|Hall|Theater|Theatre)\s*$/i, "")
    .trim();
}

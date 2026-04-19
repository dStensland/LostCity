import type { BigStuffType, RawBigStuffItem } from "./types";

const SPORTS_RE = /\b(marathon|5k|10k|race|cup|match|nascar|peachtree)\b/i;
const COMMUNITY_RE = /\b(parade|streets alive|juneteenth|pride)\b/i;
const CONVENTION_RE = /\b\w*Con\b/;
const FESTIVAL_IN_TITLE_RE = /\bfestival\b/i;

export function getBigStuffType(item: RawBigStuffItem): BigStuffType {
  if (item.kind === "festival") {
    const ft = (item.festivalType ?? "").toLowerCase();
    if (ft === "festival") return "festival";
    if (ft === "convention" || ft === "conference") return "convention";
    if (ft === "community") return "community";
    return "festival";
  }

  const title = item.title ?? "";
  const cat = (item.category ?? "").toLowerCase();

  if (cat === "sports" || cat === "race" || cat === "running" || SPORTS_RE.test(title)) {
    return "sports";
  }
  if (COMMUNITY_RE.test(title)) return "community";
  if (CONVENTION_RE.test(title)) return "convention";
  if (FESTIVAL_IN_TITLE_RE.test(title)) return "festival";
  return "other";
}

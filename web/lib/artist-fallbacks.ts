const TAG_GENRE_MAP: Record<string, string> = {
  "hip-hop": "hip-hop",
  "hip hop": "hip-hop",
  rap: "hip-hop",
  "r-and-b": "r&b",
  "r b": "r&b",
  "r&b": "r&b",
  soul: "soul",
  funk: "funk",
  pop: "pop",
  "indie-pop": "indie pop",
  "indie-rock": "indie rock",
  "alt-rock": "alternative rock",
  "alternative-rock": "alternative rock",
  rock: "rock",
  punk: "punk",
  "post-punk": "post-punk",
  emo: "emo",
  metal: "metal",
  hardcore: "hardcore",
  shoegaze: "shoegaze",
  folk: "folk",
  americana: "americana",
  country: "country",
  bluegrass: "bluegrass",
  jazz: "jazz",
  blues: "blues",
  gospel: "gospel",
  electronic: "electronic",
  edm: "electronic",
  house: "house",
  techno: "techno",
  drumandbass: "drum & bass",
  "drum-and-bass": "drum & bass",
  dubstep: "dubstep",
  afrobeats: "afrobeats",
  reggaeton: "reggaeton",
  latin: "latin",
  ambient: "ambient",
  experimental: "experimental",
};

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
}

function titleCase(label: string): string {
  return label
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (part.includes("&")) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function inferLineupGenreFallback(
  eventGenres: string[] | null | undefined,
  eventTags: string[] | null | undefined,
  category: string | null | undefined
): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();

  const addGenre = (value: string | null | undefined) => {
    const normalized = normalizeTag(value || "");
    if (!normalized) return;
    const mapped = TAG_GENRE_MAP[normalized];
    if (!mapped || seen.has(mapped)) return;
    seen.add(mapped);
    collected.push(titleCase(mapped));
  };

  // Event genres are already artistic genres — map them through
  for (const genre of eventGenres || []) {
    addGenre(genre);
  }
  // Only pull tags that match known artistic genres (skip event-descriptor
  // tags like "live-music", "ticketed", "21+", "touring", etc.)
  for (const tag of eventTags || []) {
    addGenre(tag);
  }

  if (collected.length === 0 && (category || "").toLowerCase() === "music") {
    collected.push("Live Music");
  }

  return collected.slice(0, 3);
}

export const GENRE_BUCKETS = [
  "Rock",
  "Hip-Hop / R&B",
  "Electronic / DJ",
  "Jazz / Blues",
  "Country",
  "Latin",
  "Pop / Singer-Songwriter",
] as const;

export type GenreBucket = (typeof GENRE_BUCKETS)[number];

const TAG_TO_BUCKET: Record<string, GenreBucket> = {
  rock: "Rock",
  "indie-rock": "Rock",
  "alt-rock": "Rock",
  alternative: "Rock",
  "post-punk": "Rock",
  punk: "Rock",
  metal: "Rock",
  grunge: "Rock",
  shoegaze: "Rock",
  "garage-rock": "Rock",
  "hip-hop": "Hip-Hop / R&B",
  rap: "Hip-Hop / R&B",
  "r-and-b": "Hip-Hop / R&B",
  rnb: "Hip-Hop / R&B",
  soul: "Hip-Hop / R&B",
  "neo-soul": "Hip-Hop / R&B",
  trap: "Hip-Hop / R&B",
  electronic: "Electronic / DJ",
  edm: "Electronic / DJ",
  house: "Electronic / DJ",
  techno: "Electronic / DJ",
  dj: "Electronic / DJ",
  ambient: "Electronic / DJ",
  synthwave: "Electronic / DJ",
  jazz: "Jazz / Blues",
  blues: "Jazz / Blues",
  swing: "Jazz / Blues",
  country: "Country",
  bluegrass: "Country",
  americana: "Country",
  latin: "Latin",
  reggaeton: "Latin",
  salsa: "Latin",
  bachata: "Latin",
  cumbia: "Latin",
  pop: "Pop / Singer-Songwriter",
  "singer-songwriter": "Pop / Singer-Songwriter",
  folk: "Pop / Singer-Songwriter",
  "indie-pop": "Pop / Singer-Songwriter",
  acoustic: "Pop / Singer-Songwriter",
};

/** Map an array of event tags to their broad genre buckets (deduplicated). */
export function getGenreBuckets(tags: string[] | null): GenreBucket[] {
  if (!tags || tags.length === 0) return [];
  const buckets = new Set<GenreBucket>();
  for (const tag of tags) {
    const bucket = TAG_TO_BUCKET[tag];
    if (bucket) buckets.add(bucket);
  }
  return [...buckets];
}

/** Format a raw hyphenated tag into a human-readable label. */
export function formatSubgenreLabel(tag: string): string {
  return tag
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Get displayable subgenre labels from tags (only genre-mapped ones). */
export function getSubgenreLabels(tags: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];
  return tags.filter((tag) => tag in TAG_TO_BUCKET).map(formatSubgenreLabel);
}

export const MUSIC_GENRE_BUCKETS = [
  "Rock",
  "Hip-Hop/R&B",
  "Electronic",
  "Jazz/Blues",
  "Country",
  "Latin",
  "Pop/Singer-Songwriter",
] as const;

export type MusicGenreBucket = (typeof MUSIC_GENRE_BUCKETS)[number];

const TAG_TO_BUCKET: Record<string, MusicGenreBucket> = {
  "rock": "Rock",
  "indie": "Rock",
  "indie-rock": "Rock",
  "alt-rock": "Rock",
  "alternative": "Rock",
  "post-punk": "Rock",
  "punk": "Rock",
  "metal": "Rock",
  "hard-rock": "Rock",
  "shoegaze": "Rock",
  "garage-rock": "Rock",
  "psychedelic": "Rock",
  "psych-rock": "Rock",
  "emo": "Rock",

  "hip-hop": "Hip-Hop/R&B",
  "rap": "Hip-Hop/R&B",
  "r-and-b": "Hip-Hop/R&B",
  "rnb": "Hip-Hop/R&B",
  "soul": "Hip-Hop/R&B",
  "trap": "Hip-Hop/R&B",
  "neo-soul": "Hip-Hop/R&B",

  "electronic": "Electronic",
  "edm": "Electronic",
  "house": "Electronic",
  "techno": "Electronic",
  "dj": "Electronic",
  "drum-and-bass": "Electronic",
  "dnb": "Electronic",
  "dubstep": "Electronic",
  "trance": "Electronic",
  "ambient": "Electronic",

  "jazz": "Jazz/Blues",
  "blues": "Jazz/Blues",
  "funk": "Jazz/Blues",
  "fusion": "Jazz/Blues",

  "country": "Country",
  "bluegrass": "Country",
  "americana": "Country",
  "folk": "Country",
  "alt-country": "Country",

  "latin": "Latin",
  "reggaeton": "Latin",
  "salsa": "Latin",
  "bachata": "Latin",
  "latin-pop": "Latin",

  "pop": "Pop/Singer-Songwriter",
  "singer-songwriter": "Pop/Singer-Songwriter",
  "indie-pop": "Pop/Singer-Songwriter",
  "acoustic": "Pop/Singer-Songwriter",
};

function normalize(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, "-").replace(/_/g, "-");
}

export function tagToBucket(tag: string): MusicGenreBucket | null {
  if (!tag) return null;
  return TAG_TO_BUCKET[normalize(tag)] ?? null;
}

export function mapTagsToBuckets(tags: readonly string[]): MusicGenreBucket[] {
  const found = new Set<MusicGenreBucket>();
  for (const tag of tags) {
    const bucket = tagToBucket(tag);
    if (bucket) found.add(bucket);
  }
  return MUSIC_GENRE_BUCKETS.filter((b) => found.has(b));
}

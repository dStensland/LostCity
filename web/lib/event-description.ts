import type { EventArtist } from "@/lib/artists-utils";
import { inferLineupGenreFallback } from "@/lib/artist-fallbacks";

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinWithCommas(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function dedupeArtists(artists: EventArtist[]): EventArtist[] {
  const seen = new Set<string>();
  const unique: EventArtist[] = [];

  const sorted = [...artists].sort((a, b) => {
    const aHead = a.is_headliner || a.billing_order === 1 ? 0 : 1;
    const bHead = b.is_headliner || b.billing_order === 1 ? 0 : 1;
    if (aHead !== bHead) return aHead - bHead;

    const aOrder = a.billing_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.billing_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return (a.artist?.name || a.name).localeCompare(b.artist?.name || b.name);
  });

  for (const artist of sorted) {
    const key = artist.artist?.id
      ? `id:${artist.artist.id}`
      : artist.artist?.slug
        ? `slug:${artist.artist.slug}`
        : `name:${normalizeText(artist.artist?.name || artist.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(artist);
  }

  return unique;
}

function buildArtistDescriptor(artist: EventArtist, fallbackGenres: string[]): string {
  const name = artist.artist?.name || artist.name;
  const artistGenres = (artist.artist?.genres || []).filter(Boolean);
  const genres = (artistGenres.length > 0 ? artistGenres : fallbackGenres).slice(0, 2);
  if (genres.length === 0) return name;
  return `${name} (${genres.join(", ")})`;
}

type DescriptionContext = {
  eventGenres?: string[] | null;
  eventTags?: string[] | null;
  eventCategory?: string | null;
};

export function buildLineupDescription(
  artists: EventArtist[],
  context: DescriptionContext = {}
): string | null {
  const dedupedArtists = dedupeArtists(artists);
  if (dedupedArtists.length === 0) return null;
  const fallbackGenres = inferLineupGenreFallback(
    context.eventGenres,
    context.eventTags,
    context.eventCategory
  );

  const descriptors = dedupedArtists.map((artist) => buildArtistDescriptor(artist, fallbackGenres));
  return `Lineup: ${joinWithCommas(descriptors)}.`;
}

function missingArtistNamesFromDescription(
  description: string,
  artists: EventArtist[]
): boolean {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return true;

  return dedupeArtists(artists).some((artist) => {
    const artistName = normalizeText(artist.artist?.name || artist.name);
    if (!artistName) return false;
    return !normalizedDescription.includes(artistName);
  });
}

export function buildDisplayDescription(
  baseDescription: string | null | undefined,
  artists: EventArtist[],
  context: DescriptionContext = {}
): string | null {
  const lineupDescription = buildLineupDescription(artists, context);
  const trimmedBase = baseDescription?.trim() || "";

  if (!lineupDescription) {
    return trimmedBase || null;
  }

  if (!trimmedBase) {
    return lineupDescription;
  }

  if (!missingArtistNamesFromDescription(trimmedBase, artists)) {
    return trimmedBase;
  }

  return `${lineupDescription}\n\n${trimmedBase}`;
}

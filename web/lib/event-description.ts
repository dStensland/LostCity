import type { EventArtist } from "@/lib/artists-utils";
import { getDisplayParticipants, getLineupLabels } from "@/lib/artists-utils";
import { inferLineupGenreFallback } from "@/lib/artist-fallbacks";

/**
 * Patterns that indicate an AI/crawler-generated metadata string rather than
 * a real event description. These are produced by `enrich_generic_event()` in
 * the crawler pipeline and should never be shown to users.
 */
const METADATA_DESCRIPTION_PATTERNS = [
  /^Category:\s/i,
  /\bScheduled on \d{4}-\d{2}-\d{2}\b/i,
  /\bUse the ticket link for (current|latest) availability\b/i,
  /\bUse the official ticket link for current passes\b/i,
  /\bCheck the official listing for current details\b/i,
  /^Location:\s.*\d{5}/im, // "Location: X, City, ST ZIP"
];

/** Returns true if the description looks like machine-generated metadata. */
export function isMetadataDescription(description: string | null | undefined): boolean {
  if (!description) return false;
  return METADATA_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description));
}

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

function buildArtistDescriptor(artist: EventArtist, fallbackGenres: string[]): string {
  const name = artist.artist?.name || artist.name;
  const artistGenres = (artist.artist?.genres || []).filter(Boolean);
  const genres = (artistGenres.length > 0 ? artistGenres : fallbackGenres).slice(0, 2);
  if (genres.length === 0) return name;
  return `${name} (${genres.join(", ")})`;
}

type DescriptionContext = {
  eventTitle?: string | null;
  eventGenres?: string[] | null;
  eventTags?: string[] | null;
  eventCategory?: string | null;
};

export function buildLineupDescription(
  artists: EventArtist[],
  context: DescriptionContext = {}
): string | null {
  const displayArtists = getDisplayParticipants(artists, {
    eventTitle: context.eventTitle,
    eventCategory: context.eventCategory,
  });

  if (displayArtists.length === 0) return null;

  const labels = getLineupLabels(displayArtists, {
    eventCategory: context.eventCategory,
  });

  const fallbackGenres = inferLineupGenreFallback(
    context.eventGenres,
    context.eventTags,
    context.eventCategory
  );

  const descriptors = displayArtists.map((artist) => buildArtistDescriptor(artist, fallbackGenres));
  return `${labels.descriptionLead}: ${joinWithCommas(descriptors)}.`;
}

function missingArtistNamesFromDescription(
  description: string,
  artists: EventArtist[]
): boolean {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return true;

  return artists.some((artist) => {
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
  const displayArtists = getDisplayParticipants(artists, {
    eventTitle: context.eventTitle,
    eventCategory: context.eventCategory,
  });

  const lineupDescription = buildLineupDescription(displayArtists, context);
  // Suppress machine-generated metadata strings — they expose internal
  // crawler artifacts to users and must not render as event descriptions.
  const trimmedBase = isMetadataDescription(baseDescription) ? "" : (baseDescription?.trim() || "");

  if (!lineupDescription) {
    return trimmedBase || null;
  }

  if (!trimmedBase) {
    return lineupDescription;
  }

  if (!missingArtistNamesFromDescription(trimmedBase, displayArtists)) {
    return trimmedBase;
  }

  return `${lineupDescription}\n\n${trimmedBase}`;
}

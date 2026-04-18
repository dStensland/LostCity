// web/lib/film/editorial-subtitle.ts
// Pure derivation of the editorial subtitle on /explore/film.
import type { FilmScreening, HeroReason } from './types';

const MAX_FRAGMENTS = 3;

function hasFormat(h: FilmScreening, fmt: string): boolean {
  return h.times.some((t) => t.format_labels.includes(fmt as never));
}

function fragment(h: FilmScreening & { hero_reason: HeroReason }): string {
  const venueName = h.venue.name;
  if (h.hero_reason === 'special_format') {
    if (hasFormat(h, 'true_imax')) return `${h.title} lights up the true IMAX at ${venueName}`;
    if (hasFormat(h, '70mm')) return `${h.title} on 70mm at ${venueName}`;
    if (hasFormat(h, '35mm')) return `${h.title} on 35mm at ${venueName}`;
    if (hasFormat(h, 'dolby_cinema')) return `${h.title} in Dolby Cinema at ${venueName}`;
    return `${h.title} in a premium format at ${venueName}`;
  }
  if (h.hero_reason === 'opens_this_week') return `${h.title} opens at ${venueName}`;
  if (h.hero_reason === 'closes_this_week') return `${h.title} closes at ${venueName}`;
  if (h.hero_reason === 'festival') {
    return h.festival_name
      ? `${h.title} at ${h.festival_name}`
      : `${h.title} (festival) at ${venueName}`;
  }
  return `${h.title} at ${venueName}`;
}

export function buildEditorialSubtitle(
  heroes: Array<FilmScreening & { hero_reason: HeroReason }>,
): string | null {
  if (heroes.length === 0) return null;
  const fragments = heroes.slice(0, MAX_FRAGMENTS).map(fragment);
  return `This week — ${fragments.join(', ')}.`;
}

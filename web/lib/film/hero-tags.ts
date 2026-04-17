// web/lib/film/hero-tags.ts
// Pure derivation of the gold editorial tag pill shown on each hero tile.
// Deterministic function of the screening + assigned hero_reason.

import type { FilmScreening, HeroReason, FormatToken } from './types';

export type HeroTag = {
  label: string;
  tone: 'gold';
};

const WEEKDAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

function firstTimeDate(screening: FilmScreening): Date | null {
  const first = screening.times[0];
  if (!first) return null;
  return new Date(first.start_date + 'T00:00:00Z');
}

function weekdayOf(screening: FilmScreening): string | null {
  const d = firstTimeDate(screening);
  if (!d) return null;
  return WEEKDAY_NAMES[d.getUTCDay()];
}

function hasFormat(screening: FilmScreening, fmt: FormatToken): boolean {
  return screening.times.some((t) => t.format_labels.includes(fmt));
}

function premiereLabel(screening: FilmScreening): string {
  if (screening.venue.programming_style === 'drive_in') return 'DRIVE-IN PREMIERE';
  switch (screening.premiere_scope) {
    case 'world':
      return 'WORLD PREMIERE';
    case 'us':
      return 'US PREMIERE';
    case 'atl':
    default:
      return 'ATL PREMIERE';
  }
}

export function buildHeroTag(
  screening: FilmScreening,
  reason: HeroReason,
): HeroTag {
  const weekday = weekdayOf(screening);

  if (reason === 'special_format') {
    if (hasFormat(screening, 'true_imax')) {
      return { label: 'TRUE IMAX EXCLUSIVE', tone: 'gold' };
    }
    if (hasFormat(screening, '70mm')) {
      return {
        label: weekday ? `70MM · ${weekday} ONLY` : '70MM',
        tone: 'gold',
      };
    }
    if (hasFormat(screening, '35mm')) {
      return {
        label: weekday ? `35MM · ${weekday} ONLY` : '35MM',
        tone: 'gold',
      };
    }
    if (hasFormat(screening, 'dolby_cinema')) {
      return { label: 'DOLBY CINEMA', tone: 'gold' };
    }
    return { label: 'SPECIAL FORMAT', tone: 'gold' };
  }

  if (reason === 'festival') {
    const name = screening.festival_name?.toUpperCase() ?? 'FESTIVAL';
    return {
      label: screening.festival_name ? `FESTIVAL · ${name}` : 'FESTIVAL',
      tone: 'gold',
    };
  }

  if (reason === 'opens_this_week') {
    if (screening.is_premiere) {
      const prem = premiereLabel(screening);
      if (prem === 'DRIVE-IN PREMIERE') return { label: prem, tone: 'gold' };
      return {
        label: weekday ? `${prem} · OPENS ${weekday}` : prem,
        tone: 'gold',
      };
    }
    return {
      label: weekday ? `OPENS ${weekday}` : 'OPENS THIS WEEK',
      tone: 'gold',
    };
  }

  if (reason === 'closes_this_week') {
    return {
      label: weekday ? `LAST CHANCE · CLOSES ${weekday}` : 'LAST CHANCE',
      tone: 'gold',
    };
  }

  // reason === 'curator_pick'
  return { label: 'CURATOR PICK', tone: 'gold' };
}

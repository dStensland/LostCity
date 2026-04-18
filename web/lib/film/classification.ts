import type {
  VenueClassification,
  ProgrammingStyle,
  FormatToken,
  HeroReason,
} from './types';

export function classifyVenue(input: {
  programming_style: ProgrammingStyle | null;
  venue_formats: FormatToken[] | readonly FormatToken[];
}): VenueClassification {
  if (input.programming_style !== null) return 'editorial_program';
  if (input.venue_formats.length > 0) return 'premium_format';
  return 'additional';
}

export type HeroCandidate = {
  id: string;
  is_curator_pick: boolean;
  festival_id: string | null;
  format_labels: FormatToken[];
  first_date_in_week: boolean;
  last_date_in_week: boolean;
  one_night_only: boolean;
};

const SPECIAL_FORMATS: ReadonlySet<FormatToken> = new Set([
  'true_imax',
  '70mm',
  '4dx',
]);

function heroReasonFor(c: HeroCandidate): HeroReason {
  if (c.is_curator_pick) return 'curator_pick';
  if (c.first_date_in_week) return 'opens_this_week';
  if (c.festival_id) return 'festival';
  if (c.one_night_only && c.format_labels.some((f) => SPECIAL_FORMATS.has(f))) {
    return 'special_format';
  }
  return 'closes_this_week';
}

function heroPriority(c: HeroCandidate): number {
  if (c.is_curator_pick) return 0;
  if (c.first_date_in_week) return 1;
  if (c.festival_id) return 2;
  if (c.one_night_only && c.format_labels.some((f) => SPECIAL_FORMATS.has(f))) {
    return 3;
  }
  if (c.last_date_in_week) return 4;
  return 99;
}

export function rankHeroCandidates<T extends HeroCandidate>(
  candidates: T[],
): Array<T & { hero_reason: HeroReason }> {
  return candidates
    .filter((c) => heroPriority(c) < 99)
    .sort((a, b) => heroPriority(a) - heroPriority(b))
    .slice(0, 3)
    .map((c) => ({ ...c, hero_reason: heroReasonFor(c) }));
}

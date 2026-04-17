import { describe, it, expect } from 'vitest';
import {
  classifyVenue,
  rankHeroCandidates,
  type HeroCandidate,
} from './classification';

describe('classifyVenue', () => {
  it('returns editorial_program when programming_style is set', () => {
    expect(
      classifyVenue({ programming_style: 'repertory', venue_formats: [] }),
    ).toBe('editorial_program');
    expect(
      classifyVenue({ programming_style: 'drive_in', venue_formats: [] }),
    ).toBe('editorial_program');
  });

  it('returns premium_format when style is null but formats present', () => {
    expect(
      classifyVenue({ programming_style: null, venue_formats: ['true_imax'] }),
    ).toBe('premium_format');
    expect(
      classifyVenue({
        programming_style: null,
        venue_formats: ['imax', '4dx'],
      }),
    ).toBe('premium_format');
  });

  it('returns additional when neither style nor formats set', () => {
    expect(
      classifyVenue({ programming_style: null, venue_formats: [] }),
    ).toBe('additional');
  });

  it('prefers editorial_program even if venue also has formats', () => {
    expect(
      classifyVenue({
        programming_style: 'repertory',
        venue_formats: ['70mm'],
      }),
    ).toBe('editorial_program');
  });
});

describe('rankHeroCandidates', () => {
  const base = {
    is_curator_pick: false,
    festival_id: null,
    format_labels: [],
    first_date_in_week: false,
    last_date_in_week: false,
    one_night_only: false,
  };

  it('prioritizes curator picks over all else', () => {
    const picks = [
      { ...base, id: 'a', is_curator_pick: true },
      { ...base, id: 'b', first_date_in_week: true },
      { ...base, id: 'c', festival_id: 'atl-film-fest' },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked[0].id).toBe('a');
  });

  it('ranks opens-this-week above festival above closes-this-week', () => {
    const picks = [
      { ...base, id: 'close', last_date_in_week: true },
      { ...base, id: 'fest', festival_id: 'atl-film-fest' },
      { ...base, id: 'open', first_date_in_week: true },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked.map((p) => p.id)).toEqual(['open', 'fest', 'close']);
  });

  it('prefers special-format one-night-only over closes-this-week', () => {
    const picks = [
      { ...base, id: 'close', last_date_in_week: true },
      {
        ...base,
        id: 'special',
        one_night_only: true,
        format_labels: ['70mm'],
      },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked[0].id).toBe('special');
  });

  it('caps the result at three items', () => {
    const picks = Array.from({ length: 8 }, (_, i) => ({
      ...base,
      id: `p${i}`,
      is_curator_pick: true,
    })) as HeroCandidate[];
    expect(rankHeroCandidates(picks)).toHaveLength(3);
  });

  it('assigns the most specific hero_reason per candidate', () => {
    const picks = [
      {
        ...base,
        id: 'a',
        is_curator_pick: true,
        first_date_in_week: true,
      },
      { ...base, id: 'b', festival_id: 'atl-film-fest' },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked[0]).toMatchObject({ id: 'a', hero_reason: 'curator_pick' });
    expect(ranked[1]).toMatchObject({ id: 'b', hero_reason: 'festival' });
  });
});

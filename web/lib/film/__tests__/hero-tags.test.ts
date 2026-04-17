import { describe, expect, it } from 'vitest';
import { buildHeroTag } from '../hero-tags';
import type { FilmScreening } from '../types';

function makeScreening(overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: 'run-1',
    screening_title_id: 'title-1',
    title: 'Bunnylovr',
    slug: 'bunnylovr',
    director: null,
    year: 2024,
    runtime_minutes: null,
    rating: null,
    image_url: null,
    editorial_blurb: null,
    film_press_quote: null,
    film_press_source: null,
    is_premiere: false,
    premiere_scope: null,
    is_curator_pick: false,
    festival_id: null,
    festival_name: null,
    venue: {
      id: 1,
      slug: 'plaza-theatre',
      name: 'Plaza Theatre',
      neighborhood: 'Poncey-Highland',
      classification: 'editorial_program',
      programming_style: 'repertory',
      venue_formats: [],
      founding_year: 1939,
      google_rating: null,
    },
    times: [],
    ...overrides,
  };
}

describe('buildHeroTag', () => {
  it('returns ATL PREMIERE · OPENS {WEEKDAY} for ATL premiere opening this week', () => {
    const s = makeScreening({
      is_premiere: true,
      premiere_scope: 'atl',
      times: [{ id: 't1', start_date: '2026-04-23', start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'opens_this_week')).toEqual({
      label: 'ATL PREMIERE · OPENS THURSDAY',
      tone: 'gold',
    });
  });

  it('returns US PREMIERE · OPENS {WEEKDAY} for US scope', () => {
    const s = makeScreening({
      is_premiere: true,
      premiere_scope: 'us',
      times: [{ id: 't1', start_date: '2026-04-24', start_time: '19:00', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'opens_this_week').label).toBe('US PREMIERE · OPENS FRIDAY');
  });

  it('returns TRUE IMAX EXCLUSIVE for special_format with true_imax', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-22', start_time: '20:00', end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'special_format')).toEqual({
      label: 'TRUE IMAX EXCLUSIVE',
      tone: 'gold',
    });
  });

  it('returns 70MM · {WEEKDAY} ONLY for 70mm one-night special format', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-26', start_time: '20:00', end_time: null, format_labels: ['70mm'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'special_format').label).toBe('70MM · SUNDAY ONLY');
  });

  it('returns 35MM · {WEEKDAY} ONLY for 35mm repertory', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-25', start_time: '15:00', end_time: null, format_labels: ['35mm'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'special_format').label).toBe('35MM · SATURDAY ONLY');
  });

  it('returns DRIVE-IN PREMIERE for drive-in programmer opening week', () => {
    const s = makeScreening({
      venue: {
        ...makeScreening().venue,
        slug: 'starlight-drive-in',
        programming_style: 'drive_in',
      },
      is_premiere: true,
      times: [{ id: 't1', start_date: '2026-04-22', start_time: '20:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'opens_this_week').label).toBe('DRIVE-IN PREMIERE');
  });

  it('returns FESTIVAL · {name} when hero_reason is festival', () => {
    const s = makeScreening({ festival_id: 'f1', festival_name: 'Atlanta Film Fest' });
    expect(buildHeroTag(s, 'festival').label).toBe('FESTIVAL · ATLANTA FILM FEST');
  });

  it('returns CURATOR PICK for curator_pick with no other signal', () => {
    const s = makeScreening({ is_curator_pick: true });
    expect(buildHeroTag(s, 'curator_pick').label).toBe('CURATOR PICK');
  });

  it('returns LAST CHANCE · CLOSES {WEEKDAY} for closes_this_week', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-27', start_time: '19:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'closes_this_week').label).toBe('LAST CHANCE · CLOSES MONDAY');
  });

  it('falls back to a safe default if no times present', () => {
    const s = makeScreening({ times: [] });
    expect(buildHeroTag(s, 'opens_this_week').label).toBe('OPENS THIS WEEK');
  });
});

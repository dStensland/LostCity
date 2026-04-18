import { describe, expect, it } from 'vitest';
import { buildEditorialSubtitle } from '../editorial-subtitle';
import type { FilmScreening, HeroReason } from '../types';

function hero(title: string, venue: string, reason: HeroReason, overrides: Partial<FilmScreening> = {}): FilmScreening & { hero_reason: HeroReason } {
  return {
    run_id: `r-${title}`,
    screening_title_id: `st-${title}`,
    title,
    slug: title.toLowerCase().replace(/\s/g, '-'),
    director: null,
    year: null,
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
      slug: venue.toLowerCase().replace(/\s/g, '-'),
      name: venue,
      neighborhood: null,
      classification: 'editorial_program',
      programming_style: null,
      venue_formats: [],
      founding_year: null,
      google_rating: null,
    },
    times: [],
    hero_reason: reason,
    ...overrides,
  };
}

describe('buildEditorialSubtitle', () => {
  it('returns null for empty heroes', () => {
    expect(buildEditorialSubtitle([])).toBeNull();
  });

  it('uses "opens at" for opens_this_week heroes', () => {
    const subtitle = buildEditorialSubtitle([
      hero('Bunnylovr', 'Plaza', 'opens_this_week'),
    ]);
    expect(subtitle).toContain('Bunnylovr opens at Plaza');
  });

  it('uses "lights up the true IMAX at" for special_format with true_imax', () => {
    const h = hero('Dune Part Three', 'Mall of Georgia', 'special_format', {
      times: [{ id: 't', start_date: '2026-04-20', start_time: null, end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    const subtitle = buildEditorialSubtitle([h]);
    expect(subtitle).toContain('Dune Part Three lights up the true IMAX at Mall of Georgia');
  });

  it('uses "on 35mm at" for special_format with 35mm', () => {
    const h = hero('Faces', 'Tara', 'special_format', {
      times: [{ id: 't', start_date: '2026-04-20', start_time: null, end_time: null, format_labels: ['35mm'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildEditorialSubtitle([h])).toContain('Faces on 35mm at Tara');
  });

  it('joins multiple fragments with comma and starts with "This week —"', () => {
    const result = buildEditorialSubtitle([
      hero('A', 'Plaza', 'opens_this_week'),
      hero('B', 'Tara', 'curator_pick'),
    ]);
    expect(result).toMatch(/^This week —/);
    expect(result).toContain(',');
  });

  it('ends with a period', () => {
    const r = buildEditorialSubtitle([hero('A', 'Plaza', 'opens_this_week')]);
    expect(r?.endsWith('.')).toBe(true);
  });

  it('caps at 3 fragments for readability', () => {
    const heroes = [
      hero('A', 'Plaza', 'opens_this_week'),
      hero('B', 'Tara', 'curator_pick'),
      hero('C', 'Starlight', 'opens_this_week'),
      hero('D', 'Landmark', 'curator_pick'),
    ];
    const r = buildEditorialSubtitle(heroes);
    expect(r).toContain('A opens at Plaza');
    expect(r).not.toContain('Landmark');
  });
});

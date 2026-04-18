import { describe, expect, it } from 'vitest';
import { classifyEditorialGroup, transposeToFilms } from '../by-film-loader';
import type { EditorialGroup, FormatToken } from '../types';

describe('classifyEditorialGroup', () => {
  const weekStart = '2026-04-20';
  const weekEnd = '2026-04-26';

  it('returns "opens" when run.start_date falls within the week', () => {
    const result = classifyEditorialGroup('2026-04-22', '2026-05-08', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('opens');
  });

  it('returns "closes" when run.end_date falls within the week (and start is before)', () => {
    const result = classifyEditorialGroup('2026-04-10', '2026-04-24', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('closes');
  });

  it('returns "now" when run spans both boundaries', () => {
    const result = classifyEditorialGroup('2026-04-01', '2026-05-15', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('now');
  });

  it('returns "opens" when a single-day run falls inside the week', () => {
    const result = classifyEditorialGroup('2026-04-23', '2026-04-23', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('opens');
  });

  it('prefers "opens" over "closes" when both dates are inside the week', () => {
    const result = classifyEditorialGroup('2026-04-22', '2026-04-24', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('opens');
  });
});

describe('transposeToFilms', () => {
  const base = {
    portalSlug: 'atlanta',
    date: '2026-04-23',
    weekStart: '2026-04-20',
    weekEnd: '2026-04-26',
  };

  const venueA = {
    id: 1, slug: 'plaza', name: 'Plaza',
    neighborhood: 'Poncey-Highland', classification: 'editorial_program' as const,
    programming_style: 'repertory' as const, venue_formats: [] as FormatToken[],
    founding_year: 1939, google_rating: null,
  };

  const venueB = {
    id: 2, slug: 'tara', name: 'Tara',
    neighborhood: 'Cheshire Bridge', classification: 'editorial_program' as const,
    programming_style: 'repertory' as const, venue_formats: [] as FormatToken[],
    founding_year: 1968, google_rating: null,
  };

  const titleX = {
    id: 'tx', canonical_title: 'Bunnylovr', slug: 'bunnylovr',
    poster_image_url: null, synopsis: null, genres: ['drama'],
    editorial_blurb: 'A bruised debut.', film_press_quote: null, film_press_source: null,
    is_premiere: true, premiere_scope: 'atl' as const,
    director: 'Katarina Zhu', year: 2024, runtime_minutes: 101, rating: 'NR',
  };

  it('groups multiple runs of the same screening_title into one film entry', () => {
    const rows = [
      { time: { id: 't1', start_date: base.date, start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-04-29' }, venue: venueA, title: titleX },
      { time: { id: 't2', start_date: base.date, start_time: '21:30', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-04-29' }, venue: venueB, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.films).toHaveLength(1);
    expect(payload.films[0].venues).toHaveLength(2);
    expect(payload.total_screenings).toBe(2);
  });

  it('assigns editorial_group "opens" when the film opens this week', () => {
    const rows = [
      { time: { id: 't1', start_date: base.date, start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-05-02' }, venue: venueA, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.films[0].editorial_group).toBe<EditorialGroup>('opens');
  });

  it('sorts films by group order (opens → now → closes) then by title asc', () => {
    const titleY = { ...titleX, id: 'ty', canonical_title: 'Apollo', slug: 'apollo' };
    const titleZ = { ...titleX, id: 'tz', canonical_title: 'Zinc', slug: 'zinc' };
    const rows = [
      { time: { id: 'tz1', start_date: base.date, start_time: '20:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-10', end_date: '2026-04-24' }, venue: venueA, title: titleZ },
      { time: { id: 'ty1', start_date: base.date, start_time: '20:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-05-02' }, venue: venueA, title: titleY },
      { time: { id: 'tx1', start_date: base.date, start_time: '20:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-01', end_date: '2026-05-10' }, venue: venueA, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.films.map((f) => f.film.title)).toEqual(['Apollo', 'Bunnylovr', 'Zinc']);
    expect(payload.films.map((f) => f.editorial_group)).toEqual(['opens', 'now', 'closes']);
  });

  it('exposes iso_week range in the payload', () => {
    const rows = [
      { time: { id: 't', start_date: base.date, start_time: '19:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-04-29' }, venue: venueA, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.iso_week_start).toBe(base.weekStart);
    expect(payload.iso_week_end).toBe(base.weekEnd);
  });
});

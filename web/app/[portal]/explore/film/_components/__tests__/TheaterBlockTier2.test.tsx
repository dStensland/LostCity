import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TheaterBlockTier2 from '../TheaterBlockTier2';
import type { FilmVenue, FilmScreening, FormatToken } from '@/lib/film/types';

function venue(overrides: Partial<FilmVenue> = {}): FilmVenue {
  return {
    id: 2, slug: 'amc-mog', name: 'AMC Mall of Georgia',
    neighborhood: 'Buford', classification: 'premium_format',
    programming_style: null, venue_formats: ['true_imax', '70mm'],
    founding_year: null, google_rating: null, ...overrides,
  };
}

function screening(title: string, time: string, formats: FormatToken[] = []): FilmScreening {
  return {
    run_id: `r-${title}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase().replace(/\s/g, '-'),
    director: null, year: null, runtime_minutes: 140, rating: 'PG-13',
    image_url: null, editorial_blurb: null,
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: formats, status: 'scheduled', ticket_url: null, event_id: null }],
  };
}

describe('TheaterBlockTier2', () => {
  it('renders venue name + format capability badges', () => {
    render(<TheaterBlockTier2 venue={venue()} screenings={[screening('Dune', '19:30', ['true_imax'])]} portalSlug="atlanta" />);
    expect(screen.getByText('AMC Mall of Georgia')).toBeInTheDocument();
    expect(screen.getAllByText(/TRUE IMAX/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders per-showing format tag on the chip', () => {
    render(<TheaterBlockTier2 venue={venue()} screenings={[screening('Dune', '19:30', ['true_imax'])]} portalSlug="atlanta" />);
    expect(screen.getAllByText(/TRUE IMAX/).length).toBeGreaterThanOrEqual(2);
  });

  it('omits editorial blurb even if present (Tier 2 suppresses editorial)', () => {
    const s = screening('X', '20:00');
    const sBlurb: FilmScreening = { ...s, editorial_blurb: 'Should not render in Tier 2.' };
    render(<TheaterBlockTier2 venue={venue()} screenings={[sBlurb]} portalSlug="atlanta" />);
    expect(screen.queryByText(/Should not render/)).not.toBeInTheDocument();
  });
});

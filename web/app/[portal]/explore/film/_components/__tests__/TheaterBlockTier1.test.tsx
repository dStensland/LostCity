import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TheaterBlockTier1 from '../TheaterBlockTier1';
import type { FilmVenue, FilmScreening } from '@/lib/film/types';

function venue(): FilmVenue {
  return {
    id: 1, slug: 'plaza-theatre', name: 'Plaza Theatre',
    neighborhood: 'Poncey-Highland', classification: 'editorial_program',
    programming_style: 'repertory', venue_formats: ['70mm', '35mm'],
    founding_year: 1939, google_rating: 4.7,
  };
}

function screening(title: string, time: string, overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `r-${title}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase().replace(/\s/g, '-'),
    director: 'Jane Doe', year: 2025, runtime_minutes: 101, rating: 'R',
    image_url: null, editorial_blurb: 'A bruising debut.',
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

describe('TheaterBlockTier1', () => {
  it('renders the venue name and founding year', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText('Plaza Theatre')).toBeInTheDocument();
    expect(screen.getByText(/EST\. 1939/)).toBeInTheDocument();
  });

  it('renders film title, director, year, runtime, rating', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
    expect(screen.getByText(/1h 41m/)).toBeInTheDocument();
  });

  it('renders editorial_blurb when present', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText(/A bruising debut\./)).toBeInTheDocument();
  });

  it('renders showtime chip with time', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText(/7:45/)).toBeInTheDocument();
  });

  it('renders a +N more footer when more than 5 films', () => {
    const s = Array.from({ length: 7 }, (_, i) => screening(`Film ${i}`, '20:00'));
    render(<TheaterBlockTier1 venue={venue()} screenings={s} portalSlug="atlanta" />);
    expect(screen.getByText(/\+2 more films/i)).toBeInTheDocument();
  });
});

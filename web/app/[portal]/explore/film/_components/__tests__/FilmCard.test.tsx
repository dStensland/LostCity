import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FilmCard from '../FilmCard';
import type { FilmByFilmEntry, FilmVenue, FormatToken } from '@/lib/film/types';

function venue(id: number, name: string, classification: 'editorial_program' | 'premium_format', formats: FormatToken[] = []): FilmVenue {
  return {
    id, slug: name.toLowerCase().replace(/\s/g, '-'), name,
    neighborhood: null, classification,
    programming_style: classification === 'editorial_program' ? 'repertory' : null,
    venue_formats: formats, founding_year: null, google_rating: null,
  };
}

function time(id: string, hh: string, formats: FormatToken[] = []): FilmByFilmEntry['venues'][number]['times'][number] {
  return {
    id, start_date: '2026-04-23', start_time: hh,
    format_labels: formats, status: 'scheduled',
  };
}

function entry(overrides: Partial<FilmByFilmEntry> = {}): FilmByFilmEntry {
  return {
    film: {
      screening_title_id: 'tx',
      slug: 'bunnylovr',
      title: 'Bunnylovr',
      director: 'Katarina Zhu',
      year: 2024,
      runtime_minutes: 101,
      rating: 'NR',
      image_url: null,
      editorial_blurb: 'A bruised, brilliant debut.',
      film_press_quote: 'Stays with you.',
      film_press_source: 'Little White Lies',
      is_premiere: true,
      premiere_scope: 'atl',
      genres: null,
    },
    editorial_group: 'opens',
    run_first_date: '2026-04-22',
    run_last_date: '2026-05-05',
    venues: [
      { venue: venue(1, 'Plaza Theatre', 'editorial_program'), times: [time('t1', '19:45')] },
    ],
    ...overrides,
  };
}

describe('FilmCard', () => {
  it('renders film title + director + year + runtime + rating', () => {
    render(<FilmCard entry={entry()} portalSlug="atlanta" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText(/Dir\. Katarina Zhu/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/1h 41m/)).toBeInTheDocument();
    expect(screen.getByText(/NR/)).toBeInTheDocument();
  });

  it('renders editorial blurb and press quote with source attribution', () => {
    render(<FilmCard entry={entry()} portalSlug="atlanta" />);
    expect(screen.getByText(/A bruised, brilliant debut\./)).toBeInTheDocument();
    expect(screen.getByText(/Stays with you\./)).toBeInTheDocument();
    expect(screen.getByText(/Little White Lies/)).toBeInTheDocument();
  });

  it('renders each theater row with showtime chip and format suffix where present', () => {
    const e = entry({
      venues: [
        {
          venue: venue(2, 'AMC Mall of Georgia', 'premium_format', ['true_imax']),
          times: [time('t2', '19:30', ['true_imax'])],
        },
      ],
    });
    render(<FilmCard entry={e} portalSlug="atlanta" />);
    expect(screen.getByText('AMC Mall of Georgia')).toBeInTheDocument();
    expect(screen.getByText(/7:30/)).toBeInTheDocument();
    expect(screen.getByText(/TRUE IMAX/)).toBeInTheDocument();
  });

  it('collapses standard (no format_labels) chain showings into a single link', () => {
    const e = entry({
      venues: [
        {
          venue: venue(3, 'AMC Phipps', 'premium_format', ['imax']),
          times: [
            time('t1', '14:00'),
            time('t2', '17:00'),
            time('t3', '20:00'),
          ],
        },
      ],
    });
    render(<FilmCard entry={e} portalSlug="atlanta" />);
    expect(screen.getByText(/standard showings/i)).toBeInTheDocument();
    expect(screen.queryByText(/2:00/)).not.toBeInTheDocument();
  });

  it('does NOT collapse tier-1 (editorial_program) screenings even without format labels', () => {
    const e = entry({
      venues: [
        {
          venue: venue(1, 'Plaza Theatre', 'editorial_program'),
          times: [time('t1', '19:45'), time('t2', '21:30')],
        },
      ],
    });
    render(<FilmCard entry={e} portalSlug="atlanta" />);
    expect(screen.getByText(/7:45/)).toBeInTheDocument();
    expect(screen.getByText(/9:30/)).toBeInTheDocument();
    expect(screen.queryByText(/standard showings/i)).not.toBeInTheDocument();
  });

  it('shows the gold editorial badge for premiered films', () => {
    render(<FilmCard entry={entry()} portalSlug="atlanta" />);
    expect(screen.getByText(/ATL PREMIERE/)).toBeInTheDocument();
  });
});

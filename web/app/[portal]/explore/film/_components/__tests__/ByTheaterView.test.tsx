import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ByTheaterView from '../ByTheaterView';
import { DEFAULT_FILTERS } from '../FilmFilterChips';
import type { TodayPlaybillPayload, FilmVenue, FilmScreening, VenueClassification, FormatToken } from '@/lib/film/types';

function venue(id: number, classification: VenueClassification, name: string, venueFormats: FormatToken[] = []): FilmVenue {
  return {
    id, slug: name.toLowerCase().replace(/\s/g, '-'), name,
    neighborhood: null, classification,
    programming_style: classification === 'editorial_program' ? 'repertory' : null,
    venue_formats: venueFormats, founding_year: null, google_rating: null,
  };
}

function screening(title: string, fmt: FormatToken[] = [], overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `r-${title}-${Math.random()}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase(),
    director: null, year: null, runtime_minutes: null, rating: null,
    image_url: null, editorial_blurb: null,
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(0, 'editorial_program', 'Placeholder'),
    times: [{ id: 't', start_date: '2026-04-23', start_time: '19:45', end_time: null, format_labels: fmt, status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

function payload(): TodayPlaybillPayload {
  return {
    portal_slug: 'atlanta', date: '2026-04-23',
    total_screenings: 4,
    venues: [
      { venue: venue(1, 'editorial_program', 'Plaza'), screenings: [screening('A')] },
      { venue: venue(2, 'editorial_program', 'Tara'), screenings: [screening('B')] },
      { venue: venue(3, 'premium_format', 'AMC MoG', ['true_imax']), screenings: [screening('C', ['true_imax'])] },
      { venue: venue(4, 'premium_format', 'Regal AS', ['imax', '4dx']), screenings: [screening('D', ['4dx'])] },
    ],
  };
}

describe('ByTheaterView', () => {
  it('groups Tier 1 first, then PREMIUM FORMATS divider, then Tier 2', () => {
    render(<ByTheaterView playbill={payload()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText('Plaza')).toBeInTheDocument();
    expect(screen.getByText('Tara')).toBeInTheDocument();
    expect(screen.getByText(/PREMIUM FORMATS/i)).toBeInTheDocument();
    expect(screen.getByText('AMC MoG')).toBeInTheDocument();
    expect(screen.getByText('Regal AS')).toBeInTheDocument();
  });

  it('filters by format (true_imax) — drops Regal AS (no true_imax screening)', () => {
    render(
      <ByTheaterView
        playbill={payload()}
        filters={{ ...DEFAULT_FILTERS, formats: ['true_imax'] }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.queryByText('Regal AS')).not.toBeInTheDocument();
    expect(screen.getByText('AMC MoG')).toBeInTheDocument();
  });

  it('filters premieres only — drops all if none flagged', () => {
    render(
      <ByTheaterView
        playbill={payload()}
        filters={{ ...DEFAULT_FILTERS, premieresOnly: true }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.queryByText('Plaza')).not.toBeInTheDocument();
    expect(screen.getByText(/No screenings match/i)).toBeInTheDocument();
  });

  it('shows empty state message when venues is empty', () => {
    render(
      <ByTheaterView
        playbill={{ ...payload(), venues: [], total_screenings: 0 }}
        filters={DEFAULT_FILTERS}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });
});

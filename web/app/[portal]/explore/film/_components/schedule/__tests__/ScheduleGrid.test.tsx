import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleGrid from '../ScheduleGrid';
import { DEFAULT_FILTERS } from '../../FilmFilterChips';
import type { TodayPlaybillPayload, FilmVenue, FilmScreening, VenueClassification, FormatToken } from '@/lib/film/types';

function venue(id: number, name: string, classification: VenueClassification, formats: FormatToken[] = [], programming: 'repertory' | 'drive_in' | null = classification === 'editorial_program' ? 'repertory' : null): FilmVenue {
  return {
    id, slug: name.toLowerCase().replace(/\s/g, '-'), name,
    neighborhood: null, classification, programming_style: programming,
    venue_formats: formats, founding_year: null, google_rating: null,
  };
}

function screening(title: string, time: string, overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `r-${title}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase(),
    director: null, year: null, runtime_minutes: 120, rating: 'R',
    image_url: null, editorial_blurb: null, film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(0, 'x', 'editorial_program'),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

function playbill(): TodayPlaybillPayload {
  return {
    portal_slug: 'atlanta', date: '2026-04-23', total_screenings: 3,
    venues: [
      { venue: venue(1, 'Plaza', 'editorial_program'), screenings: [screening('Bunnylovr', '19:30')] },
      { venue: venue(2, 'Starlight', 'editorial_program', [], 'drive_in'), screenings: [screening('Normal', '20:30')] },
      { venue: venue(3, 'AMC Mall of Georgia', 'premium_format', ['true_imax']), screenings: [screening('Dune', '20:00', { times: [{ id: 'td', start_date: '2026-04-23', start_time: '20:00', end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }] })] },
    ],
  };
}

describe('ScheduleGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T14:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a row label for each venue', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText('Plaza')).toBeInTheDocument();
    expect(screen.getByText('Starlight')).toBeInTheDocument();
    expect(screen.getByText('AMC Mall of Georgia')).toBeInTheDocument();
  });

  it('renders a PREMIUM FORMATS divider before tier 2 rows', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/PREMIUM FORMATS/)).toBeInTheDocument();
  });

  it('renders a cell per screening with the film title', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();
  });

  it('renders a NOW time marker when date === today', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/NOW 14:00/)).toBeInTheDocument();
  });

  it('does NOT render NOW when the selected date is not today', () => {
    render(<ScheduleGrid playbill={{ ...playbill(), date: '2026-04-25' }} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.queryByText(/^NOW/)).not.toBeInTheDocument();
  });

  it('renders a sunset marker only on drive-in rows', () => {
    const { container } = render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    const markers = container.querySelectorAll('[data-sunset-marker]');
    expect(markers.length).toBe(1);
  });

  it('dims cells that do not match the True IMAX filter', () => {
    const { container } = render(
      <ScheduleGrid
        playbill={playbill()}
        filters={{ ...DEFAULT_FILTERS, formats: ['true_imax'] }}
        portalSlug="atlanta"
      />,
    );
    const dimmed = container.querySelectorAll('.opacity-20');
    expect(dimmed.length).toBeGreaterThanOrEqual(2);
  });

  it('shows an empty state when there are no venues', () => {
    render(<ScheduleGrid playbill={{ ...playbill(), venues: [], total_screenings: 0 }} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });
});

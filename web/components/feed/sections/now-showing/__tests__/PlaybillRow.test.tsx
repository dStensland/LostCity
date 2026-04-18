import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlaybillRow from '../PlaybillRow';
import type { FilmScreening, FilmVenue } from '@/lib/film/types';

function venue(overrides: Partial<FilmVenue> = {}): FilmVenue {
  return {
    id: 1,
    slug: 'plaza-theatre',
    name: 'Plaza Theatre',
    neighborhood: 'Poncey-Highland',
    classification: 'editorial_program',
    programming_style: 'repertory',
    venue_formats: [],
    founding_year: 1939,
    google_rating: null,
    ...overrides,
  };
}

function screening(title: string, time: string, overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `run-${title}`,
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
    venue: venue(),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

describe('PlaybillRow', () => {
  it('renders venue short-name in the theater column', () => {
    render(
      <PlaybillRow
        venue={venue()}
        screenings={[screening('Bunnylovr', '19:45')]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/PLAZA/i)).toBeInTheDocument();
  });

  it('renders each film title and formatted time', () => {
    render(
      <PlaybillRow
        venue={venue()}
        screenings={[
          screening('Bunnylovr', '19:45'),
          screening('Exit 8', '17:15'),
        ]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText('Exit 8')).toBeInTheDocument();
    expect(screen.getByText(/7:45/)).toBeInTheDocument();
    expect(screen.getByText(/5:15/)).toBeInTheDocument();
  });

  it('collapses the 5th+ film into a +N more label', () => {
    render(
      <PlaybillRow
        venue={venue()}
        screenings={[
          screening('A', '17:00'),
          screening('B', '18:00'),
          screening('C', '19:00'),
          screening('D', '20:00'),
          screening('E', '21:00'),
          screening('F', '22:00'),
        ]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    expect(screen.queryByText('E')).not.toBeInTheDocument();
    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });

  it('renders drive-in note when venue programming_style is drive_in', () => {
    render(
      <PlaybillRow
        venue={venue({ slug: 'starlight-six-drive-in', name: 'Starlight Six Drive-In', programming_style: 'drive_in' })}
        screenings={[screening('Normal', '20:30')]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/drive-in/i)).toBeInTheDocument();
  });

  it('links the row arrow to the shows lane film tab for that venue', () => {
    const { container } = render(
      <PlaybillRow
        venue={venue()}
        screenings={[screening('Bunnylovr', '19:45')]}
        portalSlug="atlanta"
      />,
    );
    const link = container.querySelector('a[aria-label*="Plaza"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toContain('/atlanta/explore?lane=shows&tab=film');
    expect(link?.getAttribute('href')).toContain('venue=plaza-theatre');
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ByFilmView from '../ByFilmView';
import { DEFAULT_FILTERS } from '../FilmFilterChips';
import type { ByFilmPayload, FilmByFilmEntry, EditorialGroup } from '@/lib/film/types';

function entry(title: string, group: EditorialGroup, isPremiere = false): FilmByFilmEntry {
  return {
    film: {
      screening_title_id: `st-${title}`,
      slug: title.toLowerCase(),
      title,
      director: null, year: null, runtime_minutes: null, rating: null,
      image_url: null, editorial_blurb: null,
      film_press_quote: null, film_press_source: null,
      is_premiere: isPremiere, premiere_scope: isPremiere ? 'atl' : null,
      genres: null,
    },
    editorial_group: group,
    run_first_date: '2026-04-22',
    run_last_date: '2026-05-05',
    venues: [
      {
        venue: { id: 1, slug: 'plaza', name: 'Plaza', neighborhood: null, classification: 'editorial_program', programming_style: 'repertory', venue_formats: [], founding_year: null, google_rating: null },
        times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: '19:45', format_labels: [], status: 'scheduled' }],
      },
    ],
  };
}

function payload(entries: FilmByFilmEntry[]): ByFilmPayload {
  return {
    portal_slug: 'atlanta', date: '2026-04-23',
    iso_week_start: '2026-04-20', iso_week_end: '2026-04-26',
    films: entries,
    total_screenings: entries.length,
  };
}

describe('ByFilmView', () => {
  it('renders the three group headers in the expected order', () => {
    render(
      <ByFilmView
        payload={payload([
          entry('A', 'opens'), entry('B', 'now'), entry('C', 'closes'),
        ])}
        filters={DEFAULT_FILTERS}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/OPENS THIS WEEK/)).toBeInTheDocument();
    expect(screen.getByText(/NOW PLAYING/)).toBeInTheDocument();
    expect(screen.getByText(/CLOSES THIS WEEK/)).toBeInTheDocument();
  });

  it('collapses an empty group (no closes)', () => {
    render(
      <ByFilmView
        payload={payload([entry('A', 'opens'), entry('B', 'now')])}
        filters={DEFAULT_FILTERS}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/OPENS THIS WEEK/)).toBeInTheDocument();
    expect(screen.getByText(/NOW PLAYING/)).toBeInTheDocument();
    expect(screen.queryByText(/CLOSES THIS WEEK/)).not.toBeInTheDocument();
  });

  it('filters out films that do not match premieresOnly', () => {
    render(
      <ByFilmView
        payload={payload([entry('Regular', 'now'), entry('Premiered', 'opens', true)])}
        filters={{ ...DEFAULT_FILTERS, premieresOnly: true }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.queryByText('Regular')).not.toBeInTheDocument();
    expect(screen.getByText('Premiered')).toBeInTheDocument();
  });

  it('shows "No screenings on this date" when films is empty', () => {
    render(<ByFilmView payload={payload([])} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });

  it('shows "No films match your filters" when all filtered out', () => {
    render(
      <ByFilmView
        payload={payload([entry('A', 'now')])}
        filters={{ ...DEFAULT_FILTERS, premieresOnly: true }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/No films match/i)).toBeInTheDocument();
  });
});

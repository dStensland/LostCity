import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleCell from '../ScheduleCell';
import type { FilmScreening } from '@/lib/film/types';

function screening(overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: 'r1', screening_title_id: 'st1', title: 'Oppenheimer', slug: 'oppenheimer',
    director: null, year: 2023, runtime_minutes: 180, rating: 'R',
    image_url: null, editorial_blurb: null,
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: { id: 1, slug: 'plaza', name: 'Plaza', neighborhood: null, classification: 'editorial_program', programming_style: 'repertory', venue_formats: [], founding_year: 1939, google_rating: null },
    times: [{ id: 't1', start_date: '2026-04-23', start_time: '19:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

describe('ScheduleCell', () => {
  it('renders title + meta', () => {
    render(<ScheduleCell screening={screening()} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />);
    expect(screen.getByText('Oppenheimer')).toBeInTheDocument();
    expect(screen.getByText(/180m · R/)).toBeInTheDocument();
  });

  it('positions the cell by cellLeft + cellWidth', () => {
    const { container } = render(
      <ScheduleCell screening={screening()} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.style.left).toBe('1530px');
    expect(cell.style.width).toBe('540px');
  });

  it('uses gold border for premiered screenings', () => {
    const { container } = render(
      <ScheduleCell screening={screening({ is_premiere: true })} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('border-[var(--gold)]');
  });

  it('uses coral border when closesToday=true', () => {
    const { container } = render(
      <ScheduleCell
        screening={screening()}
        startTime="19:30"
        matchesFilter={true}
        portalSlug="atlanta"
        closesToday={true}
      />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('border-[var(--coral)]');
  });

  it('dims cell when matchesFilter=false', () => {
    const { container } = render(
      <ScheduleCell screening={screening()} startTime="19:30" matchesFilter={false} portalSlug="atlanta" />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('opacity-20');
  });

  it('links to the showtimes page', () => {
    const { container } = render(
      <ScheduleCell screening={screening()} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toContain('/atlanta/showtimes/oppenheimer');
  });

  it('appends the primary format to the meta line', () => {
    render(
      <ScheduleCell
        screening={screening({
          times: [{ id: 't1', start_date: '2026-04-23', start_time: '19:30', end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }],
        })}
        startTime="19:30"
        matchesFilter={true}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/TRUE IMAX/)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThisWeekZone from '../ThisWeekZone';
import type { ThisWeekPayload } from '@/lib/film/types';

function payload(heroCount: number): ThisWeekPayload {
  const heroes = Array.from({ length: heroCount }, (_, i) => ({
    run_id: `r-${i}`,
    screening_title_id: `st-${i}`,
    title: `Film ${i}`,
    slug: `film-${i}`,
    director: null, year: null, runtime_minutes: null, rating: null,
    image_url: null, editorial_blurb: null, film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: true,
    festival_id: null, festival_name: null,
    venue: { id: 1, slug: 'plaza', name: 'Plaza', neighborhood: null, classification: 'editorial_program' as const, programming_style: null, venue_formats: [], founding_year: null, google_rating: null },
    times: [],
    hero_reason: 'curator_pick' as const,
  }));
  return { portal_slug: 'atlanta', iso_week_start: '2026-04-13', iso_week_end: '2026-04-19', heroes };
}

describe('ThisWeekZone', () => {
  it('returns null when heroes is empty', () => {
    const { container } = render(<ThisWeekZone thisWeek={payload(0)} portalSlug="atlanta" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 1 tile when heroes has 1', () => {
    render(<ThisWeekZone thisWeek={payload(1)} portalSlug="atlanta" />);
    expect(screen.getByText('Film 0')).toBeInTheDocument();
  });

  it('renders 3 tiles when heroes has 3', () => {
    render(<ThisWeekZone thisWeek={payload(3)} portalSlug="atlanta" />);
    expect(screen.getByText('Film 0')).toBeInTheDocument();
    expect(screen.getByText('Film 2')).toBeInTheDocument();
  });

  it('shows the kicker label "THIS WEEK · n"', () => {
    render(<ThisWeekZone thisWeek={payload(2)} portalSlug="atlanta" />);
    expect(screen.getByText(/THIS WEEK · 2/i)).toBeInTheDocument();
  });
});

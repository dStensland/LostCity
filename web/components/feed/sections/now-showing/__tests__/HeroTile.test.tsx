import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroTile from '../HeroTile';
import type { FilmScreening, HeroReason } from '@/lib/film/types';

function makeHero(overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: 'run-1',
    screening_title_id: 'title-1',
    title: 'Bunnylovr',
    slug: 'bunnylovr',
    director: 'Katarina Zhu',
    year: 2024,
    runtime_minutes: 101,
    rating: 'NR',
    image_url: 'https://example.com/bunnylovr.jpg',
    editorial_blurb: null,
    film_press_quote: 'A bruised, brilliant debut.',
    film_press_source: 'Little White Lies',
    is_premiere: true,
    premiere_scope: 'atl',
    is_curator_pick: true,
    festival_id: null,
    festival_name: null,
    venue: {
      id: 1,
      slug: 'plaza-theatre',
      name: 'Plaza Theatre',
      neighborhood: 'Poncey-Highland',
      classification: 'editorial_program',
      programming_style: 'repertory',
      venue_formats: ['70mm', '35mm'],
      founding_year: 1939,
      google_rating: null,
    },
    times: [
      { id: 't1', start_date: '2026-04-23', start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null },
      { id: 't2', start_date: '2026-04-24', start_time: '19:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null },
    ],
    ...overrides,
  };
}

describe('HeroTile', () => {
  it('renders the film title', () => {
    const hero = { ...makeHero(), hero_reason: 'opens_this_week' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
  });

  it('renders the gold tag derived from hero_reason', () => {
    const hero = { ...makeHero(), hero_reason: 'opens_this_week' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText(/ATL PREMIERE · OPENS THURSDAY/)).toBeInTheDocument();
  });

  it('renders the press quote when present', () => {
    const hero = { ...makeHero(), hero_reason: 'curator_pick' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText(/A bruised, brilliant debut\./)).toBeInTheDocument();
  });

  it('omits the press quote when absent', () => {
    const hero = {
      ...makeHero({ film_press_quote: null, film_press_source: null }),
      hero_reason: 'curator_pick' as HeroReason,
    };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.queryByText(/A bruised, brilliant debut\./)).not.toBeInTheDocument();
  });

  it('renders a venue meta line with the first showtime', () => {
    const hero = { ...makeHero(), hero_reason: 'opens_this_week' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText(/Plaza Theatre/)).toBeInTheDocument();
  });

  it('links to the film detail page via series slug', () => {
    const hero = { ...makeHero(), hero_reason: 'curator_pick' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="full" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/atlanta/'));
    expect(link).toHaveAttribute('href', expect.stringContaining('bunnylovr'));
  });

  it('renders larger title for hero-large-full density', () => {
    const hero = { ...makeHero(), hero_reason: 'curator_pick' as HeroReason };
    const { container } = render(<HeroTile hero={hero} portalSlug="atlanta" density="hero-large-full" />);
    expect(container.querySelector('h3')?.className).toContain('text-4xl');
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleView from '../ScheduleView';
import { DEFAULT_FILTERS } from '../FilmFilterChips';
import type { TodayPlaybillPayload } from '@/lib/film/types';

function playbill(): TodayPlaybillPayload {
  return { portal_slug: 'atlanta', date: '2026-04-23', total_screenings: 0, venues: [] };
}

describe('ScheduleView', () => {
  it('renders the zone header', () => {
    render(<ScheduleView playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/SCHEDULE ·/i)).toBeInTheDocument();
  });

  it('shows the empty-state copy when there are no venues', () => {
    render(<ScheduleView playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });
});

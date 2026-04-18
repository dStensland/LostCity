import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateStrip from '../DateStrip';

const counts = Array.from({ length: 14 }, (_, i) => {
  const d = new Date('2026-04-17T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return { date: d.toISOString().slice(0, 10), count: i === 0 ? 14 : i === 3 ? 0 : 6, hasPremiere: i === 5 };
});

describe('DateStrip', () => {
  it('renders 14 pills', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    const pills = screen.getAllByRole('button');
    expect(pills).toHaveLength(14);
  });

  it('marks today with TODAY label in gold', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });

  it('renders star premiere marker when hasPremiere is true', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    expect(screen.getAllByText(/★ premiere/i).length).toBeGreaterThan(0);
  });

  it('renders film count when no premiere', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    expect(screen.getByText('14 films')).toBeInTheDocument();
  });

  it('calls onSelect with ISO date when pill clicked', () => {
    const onSelect = vi.fn();
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={onSelect} />);
    const pills = screen.getAllByRole('button');
    fireEvent.click(pills[2]);
    expect(onSelect).toHaveBeenCalledWith(counts[2].date);
  });

  it('marks the selected pill with aria-pressed', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-18" today="2026-04-17" onSelect={() => {}} />);
    const pills = screen.getAllByRole('button');
    expect(pills[1].getAttribute('aria-pressed')).toBe('true');
    expect(pills[0].getAttribute('aria-pressed')).toBe('false');
  });
});

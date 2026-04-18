import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleTimeAxis from '../ScheduleTimeAxis';

describe('ScheduleTimeAxis', () => {
  it('renders all 15 hour labels from 11 AM to 1 AM', () => {
    render(<ScheduleTimeAxis />);
    expect(screen.getByText('11 AM')).toBeInTheDocument();
    expect(screen.getByText('12 PM')).toBeInTheDocument();
    expect(screen.getByText('11 PM')).toBeInTheDocument();
    expect(screen.getByText('12 AM')).toBeInTheDocument();
    expect(screen.getByText('1 AM')).toBeInTheDocument();
  });

  it('positions hour labels via inline style left', () => {
    const { container } = render(<ScheduleTimeAxis />);
    const labels = container.querySelectorAll('[data-hour-label]');
    expect(labels.length).toBe(15);
    const twelve = Array.from(labels).find((el) => el.textContent === '12 PM') as HTMLElement;
    expect(twelve.style.left).toBe('180px');
  });
});

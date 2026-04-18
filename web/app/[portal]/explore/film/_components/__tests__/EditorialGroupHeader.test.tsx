import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialGroupHeader from '../EditorialGroupHeader';

describe('EditorialGroupHeader', () => {
  it('renders the opens label in gold', () => {
    const { container } = render(<EditorialGroupHeader group="opens" count={3} />);
    const label = screen.getByText(/OPENS THIS WEEK/i);
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('text-[var(--gold)]');
    expect(container.textContent).toContain('3');
  });

  it('renders the now-playing label in vibe', () => {
    render(<EditorialGroupHeader group="now" count={7} />);
    const label = screen.getByText(/NOW PLAYING/i);
    expect(label.className).toContain('text-[var(--vibe)]');
  });

  it('renders the closes label in coral', () => {
    render(<EditorialGroupHeader group="closes" count={1} />);
    const label = screen.getByText(/CLOSES THIS WEEK/i);
    expect(label.className).toContain('text-[var(--coral)]');
  });

  it('singular count renders "1 film" (no "s")', () => {
    render(<EditorialGroupHeader group="opens" count={1} />);
    expect(screen.getByText(/1 film/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 films/i)).not.toBeInTheDocument();
  });
});

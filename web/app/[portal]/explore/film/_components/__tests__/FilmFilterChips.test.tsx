import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilmFilterChips, { DEFAULT_FILTERS } from '../FilmFilterChips';

describe('FilmFilterChips', () => {
  it('renders all format + attribute chips', () => {
    render(<FilmFilterChips value={DEFAULT_FILTERS} onChange={() => {}} />);
    expect(screen.getByText(/35mm/i)).toBeInTheDocument();
    expect(screen.getByText(/True IMAX/i)).toBeInTheDocument();
    expect(screen.getByText(/premieres only/i)).toBeInTheDocument();
  });

  it('toggles a format chip on click', () => {
    const onChange = vi.fn();
    render(<FilmFilterChips value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /35mm/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ formats: ['35mm'] }));
  });

  it('toggles an attribute chip on click', () => {
    const onChange = vi.fn();
    render(<FilmFilterChips value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /premieres only/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ premieresOnly: true }));
  });

  it('turns a format off on second click', () => {
    const onChange = vi.fn();
    render(
      <FilmFilterChips
        value={{ ...DEFAULT_FILTERS, formats: ['35mm'] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /35mm/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ formats: [] }));
  });
});

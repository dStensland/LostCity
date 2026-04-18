import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggle from '../ViewToggle';

describe('ViewToggle', () => {
  it('renders all three view labels', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Theater/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /By Film/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule/i })).toBeInTheDocument();
  });

  it('marks the active view with aria-pressed', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Theater/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('disables By Film and Schedule (v1)', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Film/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Schedule/i }).hasAttribute('disabled')).toBe(true);
  });

  it('fires onChange("by-theater") when that button is clicked', () => {
    const onChange = vi.fn();
    render(<ViewToggle view="by-theater" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /By Theater/i }));
    expect(onChange).toHaveBeenCalledWith('by-theater');
  });
});

import { describe, expect, it } from 'vitest';
import { summarizeDateCounts } from '../date-counts-loader';

describe('summarizeDateCounts', () => {
  it('returns zero-count entries for every date in the window', () => {
    const result = summarizeDateCounts([], '2026-04-17', '2026-04-19');
    expect(result).toEqual([
      { date: '2026-04-17', count: 0, hasPremiere: false },
      { date: '2026-04-18', count: 0, hasPremiere: false },
      { date: '2026-04-19', count: 0, hasPremiere: false },
    ]);
  });

  it('counts screenings per date', () => {
    const rows = [
      { start_date: '2026-04-17', is_premiere: false },
      { start_date: '2026-04-17', is_premiere: false },
      { start_date: '2026-04-18', is_premiere: false },
    ];
    const result = summarizeDateCounts(rows, '2026-04-17', '2026-04-18');
    expect(result[0]).toEqual({ date: '2026-04-17', count: 2, hasPremiere: false });
    expect(result[1]).toEqual({ date: '2026-04-18', count: 1, hasPremiere: false });
  });

  it('flags hasPremiere when any screening on that date is a premiere', () => {
    const rows = [
      { start_date: '2026-04-17', is_premiere: false },
      { start_date: '2026-04-17', is_premiere: true },
    ];
    const result = summarizeDateCounts(rows, '2026-04-17', '2026-04-17');
    expect(result[0].hasPremiere).toBe(true);
  });

  it('ignores dates outside the window', () => {
    const rows = [
      { start_date: '2026-04-10', is_premiere: false },
      { start_date: '2026-04-20', is_premiere: false },
    ];
    const result = summarizeDateCounts(rows, '2026-04-17', '2026-04-18');
    expect(result.every((r) => r.count === 0)).toBe(true);
  });
});

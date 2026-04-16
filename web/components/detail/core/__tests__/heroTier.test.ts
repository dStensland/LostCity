import { describe, it, expect } from 'vitest';
import { computeHeroTier } from '@/lib/mappers/event-detail-mapper';

describe('computeHeroTier', () => {
  it('returns "expanded" for landscape image >= 1200px wide with aspect >= 1.3', () => {
    expect(computeHeroTier('https://img.jpg', 1600, 900, [])).toBe('expanded');
  });

  it('returns "expanded" for image at exact threshold (1200x923)', () => {
    expect(computeHeroTier('https://img.jpg', 1200, 923, [])).toBe('expanded');
  });

  it('returns "compact" for portrait image', () => {
    expect(computeHeroTier('https://img.jpg', 800, 1200, [])).toBe('compact');
  });

  it('returns "compact" for small landscape image (< 1200px)', () => {
    expect(computeHeroTier('https://img.jpg', 900, 600, [])).toBe('compact');
  });

  it('returns "compact" for square image', () => {
    expect(computeHeroTier('https://img.jpg', 1000, 1000, [])).toBe('compact');
  });

  it('returns "compact" for image with null dimensions', () => {
    expect(computeHeroTier('https://img.jpg', null, null, [])).toBe('compact');
  });

  it('returns "typographic" when no image URL', () => {
    expect(computeHeroTier(null, null, null, [])).toBe('typographic');
  });

  it('returns "expanded" when gallery has 2+ images regardless of primary dimensions', () => {
    expect(computeHeroTier('https://small.jpg', 400, 400, [
      'https://a.jpg', 'https://b.jpg',
    ])).toBe('expanded');
  });

  it('returns "typographic" when no image even with empty gallery', () => {
    expect(computeHeroTier(null, null, null, [])).toBe('typographic');
  });
});

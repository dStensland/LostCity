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

  // URL pattern fallback — when DB columns are NULL (pre-backfill)
  it('parses dims from "_{w}x{h}.ext" filename pattern as fallback', () => {
    expect(
      computeHeroTier(
        'https://www.atlantajcc.org/app/uploads/SDC26_RegisterNow_1442x580.jpg',
        null,
        null,
        [],
      ),
    ).toBe('expanded');
  });

  it('parses dims from "-{w}x{h}.ext" WordPress pattern as fallback', () => {
    expect(
      computeHeroTier('https://example.com/image-1600x900.png', null, null, []),
    ).toBe('expanded');
  });

  it('URL fallback respects expanded thresholds (portrait → compact)', () => {
    expect(
      computeHeroTier('https://example.com/poster_800x1200.jpg', null, null, []),
    ).toBe('compact');
  });

  it('URL fallback respects expanded thresholds (small landscape → compact)', () => {
    expect(
      computeHeroTier('https://example.com/img_900x600.jpg', null, null, []),
    ).toBe('compact');
  });

  it('URL fallback ignored when DB dims are present', () => {
    // DB says portrait, URL says landscape — DB wins
    expect(
      computeHeroTier('https://example.com/img_1600x900.jpg', 800, 1200, []),
    ).toBe('compact');
  });
});

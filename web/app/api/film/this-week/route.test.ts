import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  loadThisWeek: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { read: { limit: 200, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock('@/lib/film/this-week-loader', () => ({
  loadThisWeek: mocks.loadThisWeek,
}));

describe('GET /api/film/this-week', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue('test-client');
  });

  it('returns 400 when portal param is missing', async () => {
    const { GET } = await import('@/app/api/film/this-week/route');
    const request = new NextRequest(
      'http://localhost:3000/api/film/this-week',
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/portal/i);
  });

  it('delegates to loadThisWeek and returns payload', async () => {
    mocks.loadThisWeek.mockResolvedValue({
      portal_slug: 'atlanta',
      iso_week_start: '2026-04-13',
      iso_week_end: '2026-04-19',
      heroes: [],
    });

    const { GET } = await import('@/app/api/film/this-week/route');
    const request = new NextRequest(
      'http://localhost:3000/api/film/this-week?portal=atlanta',
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mocks.loadThisWeek).toHaveBeenCalledWith({ portalSlug: 'atlanta' });
    const body = await response.json();
    expect(body.portal_slug).toBe('atlanta');
  });

  it('returns 500 when loader throws', async () => {
    mocks.loadThisWeek.mockRejectedValue(new Error('db down'));
    const { GET } = await import('@/app/api/film/this-week/route');
    const request = new NextRequest(
      'http://localhost:3000/api/film/this-week?portal=atlanta',
    );
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

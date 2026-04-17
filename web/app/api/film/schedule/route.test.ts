import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  loadSchedule: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { read: { limit: 200, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock('@/lib/film/schedule-loader', () => ({
  loadSchedule: mocks.loadSchedule,
}));

describe('GET /api/film/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue('test-client');
  });

  it('returns 400 on missing portal', async () => {
    const { GET } = await import('@/app/api/film/schedule/route');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/film/schedule'),
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 on invalid date', async () => {
    const { GET } = await import('@/app/api/film/schedule/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/schedule?portal=atlanta&date=bad',
      ),
    );
    expect(response.status).toBe(400);
  });

  it('delegates to loadSchedule and returns payload', async () => {
    mocks.loadSchedule.mockResolvedValue({
      portal_slug: 'atlanta',
      date: '2026-04-17',
      sunrise: null,
      sunset: null,
      venues: [],
    });
    const { GET } = await import('@/app/api/film/schedule/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/schedule?portal=atlanta&date=2026-04-17',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.loadSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ portalSlug: 'atlanta', date: '2026-04-17' }),
    );
  });
});

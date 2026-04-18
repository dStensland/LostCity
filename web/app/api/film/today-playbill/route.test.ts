import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  loadTodayPlaybill: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { read: { limit: 200, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock('@/lib/film/today-playbill-loader', () => ({
  loadTodayPlaybill: mocks.loadTodayPlaybill,
}));

describe('GET /api/film/today-playbill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue('test-client');
  });

  it('returns 400 when portal is missing', async () => {
    const { GET } = await import('@/app/api/film/today-playbill/route');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/film/today-playbill'),
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when date is invalid', async () => {
    const { GET } = await import('@/app/api/film/today-playbill/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/today-playbill?portal=atlanta&date=oops',
      ),
    );
    expect(response.status).toBe(400);
  });

  it('defaults date to today when omitted', async () => {
    mocks.loadTodayPlaybill.mockResolvedValue({
      portal_slug: 'atlanta',
      date: '2026-04-17',
      venues: [],
      total_screenings: 0,
    });
    const { GET } = await import('@/app/api/film/today-playbill/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/today-playbill?portal=atlanta',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.loadTodayPlaybill).toHaveBeenCalled();
    const callArgs = mocks.loadTodayPlaybill.mock.calls[0][0];
    expect(callArgs.portalSlug).toBe('atlanta');
    expect(callArgs.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

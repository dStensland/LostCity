import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  RATE_LIMITS: { read: { limit: 120, windowSec: 60 } },
  getClientIdentifier: vi.fn().mockReturnValue('test-client'),
}));

vi.mock('@/lib/film/date-counts-loader', () => ({
  loadDateCounts: vi.fn().mockResolvedValue([
    { date: '2026-04-17', count: 3, hasPremiere: false },
    { date: '2026-04-18', count: 1, hasPremiere: true },
  ]),
}));

describe('GET /api/film/date-counts', () => {
  it('400s when portal missing', async () => {
    const req = new NextRequest('http://x/api/film/date-counts?from=2026-04-17&to=2026-04-18');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('400s on bad date format', async () => {
    const req = new NextRequest('http://x/api/film/date-counts?portal=atlanta&from=4-17&to=2026-04-18');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('200s with counts', async () => {
    const req = new NextRequest('http://x/api/film/date-counts?portal=atlanta&from=2026-04-17&to=2026-04-18');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.counts).toHaveLength(2);
  });
});

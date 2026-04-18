import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/film/by-film-loader', () => ({
  loadByFilm: vi.fn().mockResolvedValue({
    portal_slug: 'atlanta',
    date: '2026-04-23',
    iso_week_start: '2026-04-20',
    iso_week_end: '2026-04-26',
    films: [],
    total_screenings: 0,
  }),
}));

describe('GET /api/film/by-film', () => {
  it('400s when portal missing', async () => {
    const req = new NextRequest('http://x/api/film/by-film?date=2026-04-23');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('400s on bad date format', async () => {
    const req = new NextRequest('http://x/api/film/by-film?portal=atlanta&date=nope');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('200s with the by-film payload', async () => {
    const req = new NextRequest('http://x/api/film/by-film?portal=atlanta&date=2026-04-23');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ portal_slug: 'atlanta', films: [], total_screenings: 0 });
  });
});

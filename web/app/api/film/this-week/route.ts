import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadThisWeek } from '@/lib/film/this-week-loader';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const portal = new URL(request.url).searchParams.get('portal');
  if (!portal) {
    return NextResponse.json(
      { error: 'Missing required query param: portal' },
      { status: 400 },
    );
  }

  try {
    const payload = await loadThisWeek({ portalSlug: portal });
    const res = NextResponse.json(payload);
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load this-week',
      },
      { status: 500 },
    );
  }
}

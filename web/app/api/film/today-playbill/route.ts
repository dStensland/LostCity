import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadTodayPlaybill } from '@/lib/film/today-playbill-loader';

export const revalidate = 300;

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portal = searchParams.get('portal');
  if (!portal) {
    return NextResponse.json(
      { error: 'Missing required query param: portal' },
      { status: 400 },
    );
  }

  const date = searchParams.get('date') ?? todayYyyymmdd();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const payload = await loadTodayPlaybill({
      portalSlug: portal,
      date,
    });
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
          error instanceof Error
            ? error.message
            : 'Failed to load today playbill',
      },
      { status: 500 },
    );
  }
}

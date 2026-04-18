import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadDateCounts } from '@/lib/film/date-counts-loader';

export const revalidate = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portal = searchParams.get('portal');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!portal || !from || !to) {
    return NextResponse.json(
      { error: 'Missing required query params: portal, from, to' },
      { status: 400 },
    );
  }
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const counts = await loadDateCounts({ portalSlug: portal, from, to });
    const res = NextResponse.json({ portal_slug: portal, from, to, counts });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load date counts',
      },
      { status: 500 },
    );
  }
}

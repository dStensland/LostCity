import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const GET = withAuth(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });
  }

  const url = `${TMDB_BASE}/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(q)}&language=en-US&page=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: "TMDB search failed" }, { status: 502 });
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (data.results || []).slice(0, 10).map((p: any) => ({
      id: p.id,
      name: p.name,
      known_for_department: p.known_for_department || null,
      profile_path: p.profile_path || null,
    }));

    return NextResponse.json({ results });
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json({ error: "TMDB request timed out" }, { status: 504 });
  }
});

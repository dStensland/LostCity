import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

export const GET = withAuthAndParams<{ id: string }>(
  async (_request, { params }) => {
    const personId = parseInt(params.id);
    if (isNaN(personId)) {
      return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
    }

    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });
    }

    const url = `${TMDB_BASE}/person/${personId}/movie_credits?api_key=${tmdbKey}&language=en-US`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // Fetch credits and person name in parallel
      const personUrl = `${TMDB_BASE}/person/${personId}?api_key=${tmdbKey}&language=en-US`;
      const [res, personRes] = await Promise.all([
        fetch(url, { signal: controller.signal }),
        fetch(personUrl, { signal: controller.signal }),
      ]);
      clearTimeout(timeoutId);

      if (!res.ok) {
        return NextResponse.json({ error: "TMDB request failed" }, { status: 502 });
      }

      const data = await res.json();
      const personData = personRes.ok ? await personRes.json() : null;

      // Combine crew (directed) and cast, deduplicate, prefer directing credits
      const directedIds = new Set<number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const movies: any[] = [];

      // Directing credits first
      for (const m of data.crew || []) {
        if (m.job === "Director" && !directedIds.has(m.id)) {
          directedIds.add(m.id);
          movies.push(m);
        }
      }

      // Acting credits (skip duplicates from directing)
      for (const m of data.cast || []) {
        if (!directedIds.has(m.id)) {
          directedIds.add(m.id);
          movies.push(m);
        }
      }

      // Sort by release date descending
      movies.sort((a, b) => {
        const da = a.release_date || "";
        const db = b.release_date || "";
        return db.localeCompare(da);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = movies.slice(0, 50).map((m: any) => ({
        tmdb_id: m.id,
        title: m.title,
        poster_path: m.poster_path || null,
        release_date: m.release_date || null,
        year: m.release_date ? parseInt(m.release_date.split("-")[0]) : null,
        overview: m.overview || null,
      }));

      return NextResponse.json({
        person: { name: personData?.name || "Unknown" },
        movies: result,
      });
    } catch {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: "TMDB request timed out" }, { status: 504 });
    }
  }
);

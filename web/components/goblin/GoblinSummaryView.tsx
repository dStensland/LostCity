"use client";

import { useEffect, useRef } from "react";

interface SummaryMovie {
  id: number;
  title: string;
  poster_path: string | null;
  watch_order: number;
  dnf?: boolean;
}

interface SummaryTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: Array<{ movie_id: number }>;
}

interface SummaryTimelineEntry {
  id: number;
  event_type: string;
  movie_id: number | null;
  theme_id: number | null;
  user_name: string | null;
  created_at: string;
}

interface SummaryMember {
  display_name: string | null;
  avatar_url: string | null;
}

interface GoblinSummaryProps {
  name: string | null;
  date: string | null;
  members: SummaryMember[];
  guestNames: string[];
  movies: SummaryMovie[];
  themes: SummaryTheme[];
  timeline: SummaryTimelineEntry[];
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Domain Warping — smoke-like flowing noise background               */
/* ------------------------------------------------------------------ */

function createNoise2D() {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 3;
    return h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y;
  };

  return (x: number, y: number) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v,
    );
  };
}

function initDomainWarp(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const noise = createNoise2D();
  let animId = 0;
  let t = 0;

  // Render at 1/4 resolution for performance
  const SCALE = 4;

  // 2-octave FBM
  const fbm = (x: number, y: number) =>
    noise(x, y) * 0.65 + noise(x * 2.1, y * 2.1) * 0.35;

  const draw = () => {
    const W = canvas.width;
    const H = canvas.height;
    const w = Math.ceil(W / SCALE);
    const h = Math.ceil(H / SCALE);
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const time = t * 0.004;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x = (px / w) * 4;
        const y = (py / h) * 4;

        // First warp layer
        const q0 = fbm(x + time * 0.7, y + time * 0.3);
        const q1 = fbm(x + 5.2, y + 1.3 + time * 0.2);

        // Second warp layer (feeds q into the input)
        const r0 = fbm(x + 4.0 * q0 + 1.7 + time * 0.15, y + 4.0 * q1 + 9.2);
        const r1 = fbm(x + 4.0 * q0 + 8.3, y + 4.0 * q1 + 2.8 + time * 0.12);

        // Final warped value
        const v = fbm(x + 4.0 * r0, y + 4.0 * r1);

        // Map to dark red/crimson/black palette
        // v ranges roughly -1 to 1, normalize to 0-1
        const n = v * 0.5 + 0.5;

        // Color ramp: black → deep crimson → dark red → faint ember
        const i = (py * w + px) * 4;
        data[i]     = Math.floor(n * n * 120);              // R: quadratic for darker feel
        data[i + 1] = Math.floor(n * n * n * 15);           // G: very subtle
        data[i + 2] = Math.floor(n * n * 8 + n * n * n * 20); // B: slight purple in highlights
        data[i + 3] = 255;
      }
    }

    // Draw at reduced size then scale up
    const offscreen = new OffscreenCanvas(w, h);
    const offCtx = offscreen.getContext("2d")!;
    offCtx.putImageData(img, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(offscreen, 0, 0, W, H);

    t++;
    animId = requestAnimationFrame(draw);
  };
  draw();
  return () => cancelAnimationFrame(animId);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GoblinSummaryView({
  name,
  date,
  members,
  guestNames,
  movies,
  themes,
  timeline,
}: GoblinSummaryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const cleanup = initDomainWarp(canvas);
    return () => {
      cleanup();
      window.removeEventListener("resize", resize);
    };
  }, []);

  const sortedMovies = [...movies].sort((a, b) => a.watch_order - b.watch_order);
  const watchedMovies = sortedMovies.filter((m) => !m.dnf);
  const dnfMovies = sortedMovies.filter((m) => m.dnf);
  const activeThemes = themes.filter((t) => t.status === "active");
  const canceledThemes = themes.filter((t) => t.status === "canceled");

  // Compute completed themes (tagged on every watched movie)
  const watchedIds = new Set(watchedMovies.map((m) => m.id));
  const completedThemes = activeThemes.filter(
    (t) =>
      watchedIds.size > 0 &&
      watchedMovies.every((m) =>
        t.goblin_theme_movies.some((tm) => tm.movie_id === m.id)
      )
  );
  const completedIds = new Set(completedThemes.map((t) => t.id));
  const incompleteThemes = activeThemes.filter((t) => !completedIds.has(t.id));

  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const themeMap = new Map(themes.map((t) => [t.id, t]));

  const attendeeNames = [
    ...members.map((m) => m.display_name ?? "Goblin"),
    ...guestNames,
  ];

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-mono relative overflow-hidden">
      {/* Animated background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6 relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-red-900 text-2xs tracking-[0.3em] uppercase">
            A RECAP OF
          </p>
          <h1 className="text-red-500 text-2xl font-black tracking-[0.2em] uppercase drop-shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            {name || "GOBLIN DAY"}
          </h1>
          {date && (
            <p className="text-zinc-600 text-xs tracking-[0.2em] uppercase">
              {formatDate(date)}
            </p>
          )}
        </div>

        {/* Attendees */}
        {attendeeNames.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              GOBLINS [{attendeeNames.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {attendeeNames.map((attendeeName, i) => (
                <span
                  key={i}
                  className="text-2xs px-2 py-0.5 border border-zinc-800 bg-black/60 text-zinc-400 tracking-wider uppercase"
                >
                  {attendeeName}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Movies watched */}
        {watchedMovies.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              WATCH ORDER [{watchedMovies.length}]
            </h2>
            <div className="space-y-1.5">
              {watchedMovies.map((movie, i) => (
                <div key={movie.id} className="flex items-center gap-2.5 bg-black/40 px-2 py-1 border border-zinc-900/60">
                  <span className="text-red-700 font-black text-xs tabular-nums w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  {movie.poster_path && (
                    <div className="w-6 h-9 flex-shrink-0 bg-zinc-900 overflow-hidden">
                      <img
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-zinc-300 text-xs uppercase tracking-wide font-bold">
                    {movie.title}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DNF movies */}
        {dnfMovies.length > 0 && (
          <section>
            <h2 className="text-zinc-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              DID NOT FINISH [{dnfMovies.length}]
            </h2>
            <div className="space-y-1.5">
              {dnfMovies.map((movie) => (
                <div key={movie.id} className="flex items-center gap-2.5 opacity-50">
                  <span className="text-zinc-700 font-black text-xs tabular-nums w-5 text-right shrink-0 line-through">
                    {movie.watch_order}.
                  </span>
                  {movie.poster_path && (
                    <div className="w-6 h-9 flex-shrink-0 bg-zinc-900 overflow-hidden grayscale">
                      <img
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-zinc-500 text-xs uppercase tracking-wide line-through">
                    {movie.title}
                  </span>
                  <span className="text-zinc-700 text-2xs font-bold tracking-wider">
                    DNF
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed themes */}
        {completedThemes.length > 0 && (
          <section>
            <h2 className="text-amber-500 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              COMPLETED THEMES [{completedThemes.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {completedThemes.map((t) => (
                <span
                  key={t.id}
                  className="text-2xs px-2.5 py-1 border-2 border-amber-700/60 bg-amber-950/30 text-amber-400 font-bold tracking-wider uppercase shadow-[0_0_10px_rgba(180,130,0,0.15)]"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Incomplete themes */}
        {incompleteThemes.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              ACTIVE THEMES [{incompleteThemes.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {incompleteThemes.map((t) => (
                <span
                  key={t.id}
                  className="text-2xs px-2 py-0.5 border border-red-700 text-red-400 font-bold tracking-wider uppercase"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Canceled themes */}
        {canceledThemes.length > 0 && (
          <section>
            <h2 className="text-zinc-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              CANCELED THEMES [{canceledThemes.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {canceledThemes.map((t) => (
                <span
                  key={t.id}
                  className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-600 font-bold tracking-wider uppercase line-through"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Timeline */}
        {sortedTimeline.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              TIMELINE
            </h2>
            <div className="space-y-0.5 bg-black/40 border border-zinc-900/60 p-3">
              {sortedTimeline.map((entry) => {
                const movie = entry.movie_id ? movieMap.get(entry.movie_id) : null;
                const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
                return (
                  <div key={entry.id} className="flex items-baseline gap-2 text-2xs">
                    <span className="text-zinc-600 tabular-nums shrink-0">
                      {formatTimestamp(entry.created_at)}
                    </span>
                    <span className="text-zinc-500 uppercase tracking-wider">
                      {entry.user_name && (
                        <span className="text-zinc-400 font-bold mr-1">
                          {entry.user_name.toUpperCase()}
                        </span>
                      )}
                      {entry.event_type.replace(/_/g, " ")}
                      {movie && <span className="text-zinc-400"> — {movie.title}</span>}
                      {theme && <span className="text-zinc-400"> — {theme.label}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {sortedMovies.length === 0 && themes.length === 0 && timeline.length === 0 && (
          <p className="text-zinc-700 text-xs tracking-widest uppercase text-center py-8">
            // NO DATA RECORDED
          </p>
        )}
      </div>
    </div>
  );
}

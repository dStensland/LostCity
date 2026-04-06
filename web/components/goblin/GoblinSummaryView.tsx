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
/*  Domain Warping — IQ's "Warping procedural 2" ported to Canvas      */
/*  Original: Inigo Quilez (CC BY-NC-SA 3.0)                           */
/* ------------------------------------------------------------------ */

// Rotation matrix between FBM octaves (same as shader: mat2(0.8, 0.6, -0.6, 0.8))
function rot(x: number, y: number): [number, number] {
  return [0.8 * x + 0.6 * y, -0.6 * x + 0.8 * y];
}

function noise(x: number, y: number): number {
  return Math.sin(x) * Math.sin(y);
}

function fbm4(px: number, py: number): number {
  let f = 0;
  let x = px, y = py;
  f += 0.5000 * noise(x, y); [x, y] = rot(x * 2.02, y * 2.02);
  f += 0.2500 * noise(x, y); [x, y] = rot(x * 2.03, y * 2.03);
  f += 0.1250 * noise(x, y); [x, y] = rot(x * 2.01, y * 2.01);
  f += 0.0625 * noise(x, y);
  return f / 0.9375;
}

function fbm6(px: number, py: number): number {
  let f = 0;
  let x = px, y = py;
  f += 0.500000 * (0.5 + 0.5 * noise(x, y)); [x, y] = rot(x * 2.02, y * 2.02);
  f += 0.250000 * (0.5 + 0.5 * noise(x, y)); [x, y] = rot(x * 2.03, y * 2.03);
  f += 0.125000 * (0.5 + 0.5 * noise(x, y)); [x, y] = rot(x * 2.01, y * 2.01);
  f += 0.062500 * (0.5 + 0.5 * noise(x, y)); [x, y] = rot(x * 2.04, y * 2.04);
  f += 0.031250 * (0.5 + 0.5 * noise(x, y)); [x, y] = rot(x * 2.01, y * 2.01);
  f += 0.015625 * (0.5 + 0.5 * noise(x, y));
  return f / 0.96875;
}

function warpFunc(
  px: number, py: number, time: number
): { f: number; ox: number; oy: number; nx: number; ny: number } {
  // Slight time-driven sway on input
  const qx = px + 0.03 * Math.sin(0.27 * time + Math.hypot(px, py) * 4.1);
  const qy = py + 0.03 * Math.sin(0.23 * time + Math.hypot(px, py) * 4.3);

  // First warp: fbm4 x2
  let ox = fbm4(0.9 * qx, 0.9 * qy);
  let oy = fbm4(0.9 * qx + 7.8, 0.9 * qy + 7.8);
  const len1 = Math.hypot(ox, oy);
  ox += 0.04 * Math.sin(0.12 * time + len1);
  oy += 0.04 * Math.sin(0.14 * time + len1);

  // Second warp: fbm6 x2
  const nx = fbm6(3.0 * ox + 16.8, 3.0 * oy + 16.8);
  const ny = fbm6(3.0 * ox + 11.5, 3.0 * oy + 11.5);

  // Final value
  let f = 0.5 + 0.5 * fbm4(1.8 * qx + 6.0 * nx, 1.8 * qy + 6.0 * ny);
  f = f * (1 - f * Math.abs(nx)) + f * f * f * 3.5 * (f * Math.abs(nx));

  return { f, ox, oy, nx, ny };
}

/* ------------------------------------------------------------------ */
/*  Ghostly skull overlay — drawn via canvas paths                     */
/* ------------------------------------------------------------------ */

function drawSkull(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);
  ctx.globalAlpha = alpha;

  // Cranium
  ctx.beginPath();
  ctx.ellipse(0, -10, 42, 48, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(60,5,5,0.3)";
  ctx.fill();

  // Cranium inner glow
  const cranGlow = ctx.createRadialGradient(0, -10, 0, 0, -10, 44);
  cranGlow.addColorStop(0, "rgba(100,10,10,0.15)");
  cranGlow.addColorStop(0.6, "rgba(40,2,2,0.08)");
  cranGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cranGlow;
  ctx.fill();

  // Left eye socket
  ctx.beginPath();
  ctx.ellipse(-16, -14, 10, 12, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  // Eye glow
  const eyeL = ctx.createRadialGradient(-16, -14, 0, -16, -14, 10);
  eyeL.addColorStop(0, "rgba(120,10,0,0.2)");
  eyeL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = eyeL;
  ctx.fill();

  // Right eye socket
  ctx.beginPath();
  ctx.ellipse(16, -14, 10, 12, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  const eyeR = ctx.createRadialGradient(16, -14, 0, 16, -14, 10);
  eyeR.addColorStop(0, "rgba(120,10,0,0.2)");
  eyeR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = eyeR;
  ctx.fill();

  // Nasal cavity
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-7, 10);
  ctx.quadraticCurveTo(0, 8, 7, 10);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fill();

  // Cheekbones — subtle ridges
  ctx.beginPath();
  ctx.ellipse(-28, 2, 8, 14, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(50,4,4,0.15)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(28, 2, 8, 14, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(50,4,4,0.15)";
  ctx.fill();

  // Upper jaw
  ctx.beginPath();
  ctx.moveTo(-30, 20);
  ctx.quadraticCurveTo(-20, 35, 0, 38);
  ctx.quadraticCurveTo(20, 35, 30, 20);
  ctx.quadraticCurveTo(20, 28, 0, 30);
  ctx.quadraticCurveTo(-20, 28, -30, 20);
  ctx.fillStyle = "rgba(45,4,4,0.2)";
  ctx.fill();

  // Teeth — vertical lines across jaw
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1.2;
  for (let tx = -20; tx <= 20; tx += 6) {
    const jawY = 22 + 4 * (1 - (tx * tx) / 500);
    ctx.beginPath();
    ctx.moveTo(tx, jawY);
    ctx.lineTo(tx, jawY + 10);
    ctx.stroke();
  }

  // Temple shadows
  const tempL = ctx.createRadialGradient(-38, -20, 0, -38, -20, 20);
  tempL.addColorStop(0, "rgba(0,0,0,0.15)");
  tempL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tempL;
  ctx.fillRect(-58, -40, 40, 40);

  const tempR = ctx.createRadialGradient(38, -20, 0, 38, -20, 20);
  tempR.addColorStop(0, "rgba(0,0,0,0.15)");
  tempR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tempR;
  ctx.fillRect(18, -40, 40, 40);

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Init: domain warp + skull composite                                */
/* ------------------------------------------------------------------ */

function initDomainWarp(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  let animId = 0;
  let t = 0;
  const SCALE = 4;

  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const smooth = (lo: number, hi: number, v: number) => {
    const x = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return x * x * (3 - 2 * x);
  };

  const draw = () => {
    const W = canvas.width;
    const H = canvas.height;
    const w = Math.ceil(W / SCALE);
    const h = Math.ceil(H / SCALE);
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const time = t * 0.016;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const sx = (2 * (px * SCALE) - W) / H;
        const sy = (2 * (py * SCALE) - H) / H;

        const { f, oy, nx, ny } = warpFunc(sx, sy, time);

        // Direct color mixing — no inversion
        const nzw = nx * nx + ny * ny;
        const warmth = 0.2 + 0.5 * oy * oy;
        const edge = smooth(1.2, 1.3, Math.abs(nx) + Math.abs(ny));

        // Base: black → deep crimson
        let cr = mix(0.02, 0.18, f * f);
        let cg = mix(0.0, 0.01, f * f);
        let cb = mix(0.01, 0.03, f * f);

        // Warp intensity → ember highlights
        cr = mix(cr, 0.35, nzw * 0.6);
        cg = mix(cg, 0.03, nzw * 0.3);
        cb = mix(cb, 0.02, nzw * 0.2);

        // Midtone warmth
        cr = mix(cr, 0.15, warmth * 0.4);
        cg = mix(cg, 0.02, warmth * 0.2);
        cb = mix(cb, 0.04, warmth * 0.3);

        // Edge darkening
        cr = mix(cr, 0.0, edge * 0.6);
        cg = mix(cg, 0.0, edge * 0.6);
        cb = mix(cb, 0.01, edge * 0.4);

        // Boost contrast
        cr = clamp(cr * f * 2.5);
        cg = clamp(cg * f * 2.5);
        cb = clamp(cb * f * 2.5);

        // Gamma for richer darks
        cr = Math.pow(cr, 0.85);
        cg = Math.pow(cg, 0.85);
        cb = Math.pow(cb, 0.85);

        const i = (py * w + px) * 4;
        data[i]     = Math.floor(clamp(cr) * 255);
        data[i + 1] = Math.floor(clamp(cg) * 255);
        data[i + 2] = Math.floor(clamp(cb) * 255);
        data[i + 3] = 255;
      }
    }

    // Render warp at reduced resolution, scale up
    const offscreen = new OffscreenCanvas(w, h);
    const offCtx = offscreen.getContext("2d")!;
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(offscreen, 0, 0, W, H);

    // Composite skull — large, centered, faint
    const skullSize = Math.min(W, H) * 0.7;
    const skullAlpha = 0.12 + 0.02 * Math.sin(time * 0.3);
    drawSkull(ctx, W * 0.5, H * 0.35, skullSize, skullAlpha);

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

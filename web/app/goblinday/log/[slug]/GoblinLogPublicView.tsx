"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import GoblinLogEntryCard from "@/components/goblin/GoblinLogEntryCard";
import SmartImage from "@/components/SmartImage";
import type { LogEntry, GoblinTag } from "@/lib/goblin-log-utils";

interface Props {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  entries: LogEntry[];
  tags: GoblinTag[];
  year: number;
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 2024 + 1 },
  (_, i) => new Date().getFullYear() - i
);

export default function GoblinLogPublicView({ user, entries, tags, year }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeDirector, setActiveDirector] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Directors with 2+ movies
  const directors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const d = e.movie.director;
      if (d) counts.set(d, (counts.get(d) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (activeTag) result = result.filter((e) => e.tags.some((t) => t.name === activeTag));
    if (activeDirector) result = result.filter((e) => e.movie.director === activeDirector);
    return result;
  }, [entries, activeTag, activeDirector]);

  // Retro animation — radiates from header area
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;
    let sY = 0;

    // === Simplex-like noise (fast 2D hash-based) ===
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

    const fade = (n: number) => n * n * n * (n * (n * 6 - 15) + 10);
    const lerp = (a: number, b: number, n: number) => a + n * (b - a);
    const grad2 = (hash: number, x: number, y: number) => {
      const h = hash & 3;
      return (h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y);
    };
    const noise2d = (x: number, y: number) => {
      const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
      const ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
      return lerp(lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u),
                  lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u), v);
    };

    // Ring parameters
    const NUM_RINGS = 65;
    const CHAOS = 1.5;
    const ox = Math.random() * 100;
    const oy_init = Math.random() * 100;
    let oy_offset = 0;

    const onScroll = () => { sY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;

      // Full clear each frame (no trails — cleaner)
      ctx.clearRect(0, 0, W, H);

      // Center point — behind the username, fixed position (no parallax)
      const cx = W * 0.38;
      const cy = H * 0.3;

      oy_offset -= 0.015;

      // Draw trunk rings — concentric, noise-distorted
      for (let ring = 0; ring < NUM_RINGS; ring++) {
        const baseR = ring * 7 + 20;
        const noiseScale = 0.02;

        ctx.beginPath();
        for (let angle = 0; angle <= 360; angle += 2) {
          const rad = (angle * Math.PI) / 180;
          const nx = Math.cos(rad) * noiseScale * ring + ox;
          const ny = Math.sin(rad) * noiseScale * ring + oy_init + oy_offset;
          const n = noise2d(nx, ny);
          const r = baseR + CHAOS * n * 25;

          const x = cx + Math.cos(rad) * r;
          const y = cy + Math.sin(rad) * r;

          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Color: inner rings are fuchsia, outer rings fade to cyan
        const ringT = ring / NUM_RINGS;
        const cr = Math.floor(lerp(180, 0, ringT));
        const cg = Math.floor(lerp(0, 200, ringT));
        const cb = Math.floor(lerp(120, 255, ringT));
        const alpha = 0.4 - ringT * 0.25;

        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.max(alpha, 0.05)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // === Glow rings radiating from trunk center — rippling pond ===
      const numGlowRings = 5;
      const maxGlowR = Math.max(W, H) * 0.8;
      for (let i = 0; i < numGlowRings; i++) {
        const baseR = ((t * 0.8 + i * (maxGlowR / numGlowRings)) % maxGlowR);
        const ringAlpha = 0.07 * (1 - baseR / maxGlowR);
        if (ringAlpha <= 0.005) continue;

        const isCyan = i % 2 === 0;
        const color = isCyan ? "0, 240, 255" : "220, 0, 140";

        // Soft glow ring — thick line with radial fade
        const grad = ctx.createRadialGradient(cx, cy, Math.max(baseR - 30, 0), cx, cy, baseR + 30);
        grad.addColorStop(0, `rgba(${color}, 0)`);
        grad.addColorStop(0.4, `rgba(${color}, ${ringAlpha})`);
        grad.addColorStop(0.6, `rgba(${color}, ${ringAlpha})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      t += 1;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white font-mono relative overflow-hidden">
      {/* Animated retro grid background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Vignette — between canvas and content for readability */}
      <div className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          background: "radial-gradient(ellipse 65% 55% at 38% 30%, transparent 0%, transparent 40%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.5) 100%)",
        }} />

      {/* Top laser line */}
      <div className="h-px w-full relative z-10"
        style={{
          background: "linear-gradient(to right, transparent 5%, rgba(0,240,255,0.8) 35%, rgba(220,0,140,0.8) 65%, transparent 95%)",
          boxShadow: "0 0 8px rgba(0,240,255,0.4), 0 0 16px rgba(0,240,255,0.15)",
        }} />

      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20 relative z-10">
        {/* Header — glassmorphic panel */}
        <div className="mb-10 pb-6 px-6 pt-6 rounded-lg
          bg-white/[0.04] backdrop-blur-xl
          border border-white/[0.12]
          shadow-[0_0_0_1px_rgba(0,240,255,0.06),0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-end gap-4">
            {user.avatarUrl && (
              <div className="relative">
                <SmartImage src={user.avatarUrl} alt="" width={56} height={56}
                  className="border border-cyan-800/40" />
                <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-cyan-500/60" />
                <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-cyan-500/60" />
                <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-cyan-500/60" />
                <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-cyan-500/60" />
              </div>
            )}
            <div>
              <p className="text-2xs text-cyan-700/80 tracking-[0.5em] uppercase mb-1.5 font-mono"
                style={{ textShadow: "0 0 6px rgba(0,240,255,0.2)" }}>
                Film Log
              </p>
              <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-[0.15em] leading-none"
                style={{ textShadow: "0 0 2px rgba(0,240,255,0.6), 0 0 20px rgba(0,240,255,0.35), 0 0 60px rgba(0,240,255,0.12)" }}>
                {user.displayName || user.username}
              </h1>
            </div>
          </div>

          {/* Year pills + count */}
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {YEARS.map((y) => (
                <button key={y}
                  onClick={() => {
                    router.push(`${pathname}?year=${y}`);
                    setActiveTag(null);
                    setActiveDirector(null);
                  }}
                  className={`flex-shrink-0 px-3 py-1 font-mono text-2xs font-bold tracking-wider uppercase
                    border transition-all duration-200 ${
                      y === year
                        ? "border-cyan-600 text-cyan-300 bg-cyan-950/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                        : "border-zinc-800 text-zinc-600 hover:text-cyan-400/60 hover:border-cyan-800/40"
                    }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <span className="text-2xs text-zinc-600 tracking-[0.3em] uppercase flex-shrink-0 ml-4 tabular-nums">
              {filteredEntries.length} film{filteredEntries.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Tag + Director filters */}
          {(tags.length > 0 || directors.length > 0) && (
            <div className="flex items-center gap-4 mt-4 overflow-x-auto scrollbar-hide">
              {tags.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {tags.map((tag) => (
                    <button key={tag.id}
                      onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
                      className="flex-shrink-0 px-2 py-0.5 font-mono text-2xs font-medium
                        border transition-all duration-200"
                      style={{
                        backgroundColor: activeTag === tag.name ? `${tag.color}15` : "transparent",
                        borderColor: activeTag === tag.name ? `${tag.color}40` : "rgba(63,63,70,1)",
                        color: activeTag === tag.name ? tag.color || "#a1a1aa" : "rgb(82,82,91)",
                        textShadow: activeTag === tag.name ? `0 0 8px ${tag.color}40` : "none",
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
              {tags.length > 0 && directors.length > 0 && (
                <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />
              )}
              {directors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {directors.map(({ name, count }) => (
                    <button key={name}
                      onClick={() => setActiveDirector(activeDirector === name ? null : name)}
                      className={`flex-shrink-0 px-2 py-0.5 font-mono text-2xs font-medium
                        border transition-all duration-200 ${
                          activeDirector === name
                            ? "border-fuchsia-600 text-fuchsia-300 bg-fuchsia-950/30 shadow-[0_0_8px_rgba(255,0,170,0.1)]"
                            : "border-zinc-800 text-zinc-600 hover:text-fuchsia-400/60 hover:border-fuchsia-800/40"
                        }`}
                    >
                      {name} [{count}]
                    </button>
                  ))}
                </div>
              )}
              {(activeTag || activeDirector) && (
                <button
                  onClick={() => { setActiveTag(null); setActiveDirector(null); }}
                  className="flex-shrink-0 text-2xs text-zinc-700 hover:text-white font-mono
                    tracking-wider uppercase transition-colors">
                  CLEAR
                </button>
              )}
            </div>
          )}
        </div>

        {/* List with tier groups */}
        {filteredEntries.length > 0 ? (
          <div>
            {(() => {
              const groups: { tierName: string | null; tierColor: string | null; entries: { entry: LogEntry; idx: number }[] }[] = [];
              let cur: typeof groups[0] | null = null;
              filteredEntries.forEach((entry, i) => {
                if (entry.tier_name || !cur) {
                  cur = { tierName: entry.tier_name || null, tierColor: entry.tier_color || null, entries: [] };
                  groups.push(cur);
                }
                cur.entries.push({ entry, idx: i });
              });
              return groups.map((g, gi) => (
                <div key={gi} className="flex mb-3">
                  {g.tierName ? (
                    <div className="flex-shrink-0 w-6 sm:w-8 flex items-center justify-center"
                      style={{ borderLeft: `2px solid ${g.tierColor || "#00f0ff"}` }}>
                      <span className="font-mono text-2xs font-black uppercase tracking-[0.3em] whitespace-nowrap
                        [writing-mode:vertical-lr] rotate-180"
                        style={{ color: g.tierColor || "#00f0ff", textShadow: `0 0 8px ${g.tierColor || "#00f0ff"}40` }}>
                        {g.tierName}
                      </span>
                    </div>
                  ) : <div className="w-0" />}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {g.entries.map(({ entry, idx }) => (
                      <GoblinLogEntryCard key={entry.id} entry={entry} rank={idx + 1}
                        tierColor={g.tierColor} onEdit={() => {}} readOnly />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-zinc-600 font-mono text-sm tracking-widest uppercase">
              {activeTag || activeDirector
                ? "// No films match filters"
                : `// No films logged in ${year}`}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 pt-6 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(0,240,255,0.15)", boxShadow: "0 -1px 0 0 rgba(0,240,255,0.04)" }}>
          <a href="/goblinday"
            className="text-2xs text-cyan-700 font-mono tracking-[0.2em] uppercase
              hover:text-cyan-400 transition-colors">
            Goblin Day
          </a>
          <span className="text-2xs text-zinc-600 font-mono tracking-[0.15em]">
            Lost City
          </span>
        </div>
      </div>
    </main>
  );
}

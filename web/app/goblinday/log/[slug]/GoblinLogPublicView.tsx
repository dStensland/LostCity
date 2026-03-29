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

  // Retro grid animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const horizon = canvas.height * 0.55;
      const vanishX = canvas.width * 0.5;
      const gridSpacing = 50;
      const numLines = 24;

      // Neon sun at horizon
      const sunRadius = 80;
      const sunGrad = ctx.createRadialGradient(vanishX, horizon, 0, vanishX, horizon, sunRadius * 2.5);
      sunGrad.addColorStop(0, "rgba(255, 0, 170, 0.25)");
      sunGrad.addColorStop(0.3, "rgba(255, 0, 100, 0.12)");
      sunGrad.addColorStop(0.6, "rgba(0, 240, 255, 0.05)");
      sunGrad.addColorStop(1, "transparent");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, horizon - sunRadius * 2, canvas.width, sunRadius * 4);

      // Sun disc with horizontal slices cut out
      ctx.save();
      ctx.beginPath();
      ctx.arc(vanishX, horizon, sunRadius, Math.PI, 0); // top half only
      ctx.fillStyle = "rgba(255, 0, 120, 0.15)";
      ctx.fill();

      // Slice lines through the sun
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 1; i < 8; i++) {
        const sliceY = horizon - sunRadius + i * (sunRadius / 4);
        const sliceH = 2 + i * 0.5;
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fillRect(vanishX - sunRadius, sliceY, sunRadius * 2, sliceH);
      }
      ctx.restore();

      // Horizontal grid lines (scrolling toward viewer)
      for (let i = 0; i < numLines; i++) {
        const t = ((i * gridSpacing + offset) % (numLines * gridSpacing)) / (numLines * gridSpacing);
        const y = horizon + (canvas.height - horizon) * (t * t);
        const alpha = t * 0.5;
        const lineWidth = 0.5 + t * 1.5;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      // Vertical lines converging to vanishing point
      const numVLines = 24;
      for (let i = -numVLines / 2; i <= numVLines / 2; i++) {
        const bottomX = vanishX + i * 100;
        const dist = Math.abs(i) / (numVLines / 2);
        const alpha = 0.3 * (1 - dist * 0.7);

        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bottomX, canvas.height);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.lineWidth = 0.5 + (1 - dist) * 0.5;
        ctx.stroke();
      }

      // Horizon laser line
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(canvas.width, horizon);
      const horizonGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      horizonGrad.addColorStop(0, "transparent");
      horizonGrad.addColorStop(0.3, "rgba(0, 240, 255, 0.4)");
      horizonGrad.addColorStop(0.5, "rgba(255, 0, 170, 0.6)");
      horizonGrad.addColorStop(0.7, "rgba(0, 240, 255, 0.4)");
      horizonGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = horizonGrad;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glow below horizon line
      ctx.shadowColor = "rgba(255, 0, 170, 0.3)";
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      offset += 0.6;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white font-mono relative overflow-hidden">
      {/* Animated retro grid background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Top laser line */}
      <div className="h-px w-full relative z-10"
        style={{ background: "linear-gradient(to right, transparent, rgba(0,240,255,0.6), rgba(255,0,170,0.6), transparent)" }} />

      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-20 relative z-10">
        {/* Header */}
        <div className="mb-10 pb-6"
          style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}>
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
              <p className="text-2xs text-cyan-700 tracking-[0.4em] uppercase mb-1.5"
                style={{ textShadow: "0 0 10px rgba(0,240,255,0.2)" }}>
                Film Log
              </p>
              <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-[0.15em] leading-none"
                style={{ textShadow: "0 0 40px rgba(0,240,255,0.15), 0 0 80px rgba(0,240,255,0.05)" }}>
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

        {/* List */}
        {filteredEntries.length > 0 ? (
          <div className="space-y-2">
            {filteredEntries.map((entry, i) => (
              <GoblinLogEntryCard
                key={entry.id}
                entry={entry}
                rank={i + 1}
                onEdit={() => {}}
                readOnly
              />
            ))}
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
          style={{ borderTop: "1px solid rgba(0,240,255,0.1)" }}>
          <a href="/goblinday"
            className="text-2xs text-zinc-700 font-mono tracking-[0.2em] uppercase
              hover:text-cyan-500 transition-colors">
            Goblin Day
          </a>
          <span className="text-2xs text-zinc-800 font-mono tracking-[0.15em]">
            Lost City
          </span>
        </div>
      </div>
    </main>
  );
}

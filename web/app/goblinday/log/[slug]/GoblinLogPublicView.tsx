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
    let time = 0;

    // Star field
    const stars: { x: number; y: number; speed: number; size: number; hue: number }[] = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.0002 + Math.random() * 0.0008,
        size: 0.3 + Math.random() * 1.2,
        hue: Math.random() > 0.5 ? 185 : 320, // cyan or fuchsia
      });
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Focal point: upper-left area where the title sits
      const cx = W * 0.28;
      const cy = H * 0.15;
      const maxR = Math.max(W, H) * 1.2;

      // === Ambient glow behind the header ===
      const ambient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 350);
      ambient.addColorStop(0, "rgba(0, 240, 255, 0.06)");
      ambient.addColorStop(0.4, "rgba(255, 0, 170, 0.03)");
      ambient.addColorStop(1, "transparent");
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, W, H);

      // === Concentric rings pulsing outward from header ===
      const numRings = 6;
      for (let i = 0; i < numRings; i++) {
        const baseR = ((time * 0.4 + i * (maxR / numRings)) % maxR);
        const alpha = 0.12 * (1 - baseR / maxR);
        if (alpha <= 0) continue;

        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0
          ? `rgba(0, 240, 255, ${alpha})`
          : `rgba(255, 0, 170, ${alpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // === Radial laser lines from focal point ===
      const numRays = 36;
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2 + time * 0.001;
        const length = maxR;
        const endX = cx + Math.cos(angle) * length;
        const endY = cy + Math.sin(angle) * length;

        const isMajor = i % 6 === 0;
        const alpha = isMajor ? 0.04 : 0.012;

        // Fade out rays with a gradient so they're strongest near center
        const grad = ctx.createLinearGradient(cx, cy, endX, endY);
        grad.addColorStop(0, i % 3 === 0
          ? `rgba(255, 0, 170, ${alpha * 2})`
          : `rgba(0, 240, 255, ${alpha * 2})`);
        grad.addColorStop(0.3, i % 3 === 0
          ? `rgba(255, 0, 170, ${alpha})`
          : `rgba(0, 240, 255, ${alpha})`);
        grad.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = isMajor ? 0.6 : 0.3;
        ctx.stroke();
      }

      // === Perspective grid (lower portion — below content) ===
      const horizon = H * 0.7;
      const gridVanish = W * 0.5;
      const gridOffset = time * 0.6;
      const gridLines = 20;
      const gridSpacing = 50;

      for (let i = 0; i < gridLines; i++) {
        const t = ((i * gridSpacing + gridOffset) % (gridLines * gridSpacing)) / (gridLines * gridSpacing);
        const y = horizon + (H - horizon) * (t * t);
        const alpha = t * 0.35;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.lineWidth = 0.5 + t * 1.5;
        ctx.stroke();
      }

      // Vertical converging lines
      for (let i = -12; i <= 12; i++) {
        const bottomX = gridVanish + i * 100;
        const dist = Math.abs(i) / 12;
        const alpha = 0.2 * (1 - dist * 0.6);

        ctx.beginPath();
        ctx.moveTo(gridVanish, horizon);
        ctx.lineTo(bottomX, H);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Horizon glow line
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(W, horizon);
      const hGrad = ctx.createLinearGradient(0, 0, W, 0);
      hGrad.addColorStop(0, "transparent");
      hGrad.addColorStop(0.3, "rgba(0, 240, 255, 0.25)");
      hGrad.addColorStop(0.5, "rgba(255, 0, 170, 0.4)");
      hGrad.addColorStop(0.7, "rgba(0, 240, 255, 0.25)");
      hGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = hGrad;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(255, 0, 170, 0.25)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // === Drifting stars ===
      for (const star of stars) {
        // Move outward from focal point
        star.x += (star.x - cx / W) * star.speed;
        star.y += (star.y - cy / H) * star.speed;

        // Wrap
        if (star.x < -0.1 || star.x > 1.1 || star.y < -0.1 || star.y > 1.1) {
          star.x = cx / W + (Math.random() - 0.5) * 0.1;
          star.y = cy / H + (Math.random() - 0.5) * 0.1;
        }

        const sx = star.x * W;
        const sy = star.y * H;
        const dist = Math.hypot(sx - cx, sy - cy) / maxR;
        const alpha = 0.15 + dist * 0.4;

        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fillStyle = star.hue === 185
          ? `rgba(0, 240, 255, ${alpha})`
          : `rgba(255, 0, 170, ${alpha})`;
        ctx.fill();
      }

      time += 1;
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

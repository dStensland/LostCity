"use client";

import { useRouter, usePathname } from "next/navigation";
import GoblinLogEntryCard from "@/components/goblin/GoblinLogEntryCard";
import SmartImage from "@/components/SmartImage";
import type { LogEntry } from "@/lib/goblin-log-utils";

interface Props {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  entries: LogEntry[];
  year: number;
}

const YEARS = Array.from(
  { length: new Date().getFullYear() - 2024 + 1 },
  (_, i) => new Date().getFullYear() - i
);

export default function GoblinLogPublicView({ user, entries, year }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-black text-white font-mono relative overflow-hidden">
      {/* Laser grid background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,240,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,240,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Horizon glow */}
      <div className="fixed bottom-0 left-0 right-0 h-64 pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse at 50% 100%, rgba(0,240,255,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top laser line */}
      <div className="h-px w-full"
        style={{ background: "linear-gradient(to right, transparent, rgba(0,240,255,0.5), rgba(255,0,170,0.5), transparent)" }} />

      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-20 relative z-10">
        {/* Header */}
        <div className="mb-12 pb-6"
          style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}>
          <div className="flex items-end gap-4">
            {user.avatarUrl && (
              <div className="relative">
                <SmartImage
                  src={user.avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="border border-cyan-800/40"
                />
                {/* Neon corner accents */}
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
                <button
                  key={y}
                  onClick={() => router.push(`${pathname}?year=${y}`)}
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
              {entries.length} film{entries.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* List */}
        {entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry, i) => (
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
              // No films logged in {year}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 pt-6 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(0,240,255,0.1)" }}>
          <a href="/goblinday"
            className="text-2xs text-zinc-700 font-mono tracking-[0.2em] uppercase
              hover:text-cyan-500 transition-colors"
            style={{ textShadow: "0 0 10px rgba(0,240,255,0)" }}>
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

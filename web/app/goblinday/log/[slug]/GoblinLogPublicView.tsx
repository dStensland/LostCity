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
    <main className="min-h-screen bg-black text-white font-mono relative">
      {/* Film grain overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] z-50"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-transparent via-red-700 to-transparent" />

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16 relative z-10">
        {/* Header */}
        <div className="mb-10 pb-6 border-b-2 border-red-900/40">
          <div className="flex items-end gap-4">
            {user.avatarUrl && (
              <SmartImage
                src={user.avatarUrl}
                alt=""
                width={48}
                height={48}
                className="rounded-none border-2 border-zinc-700 grayscale"
              />
            )}
            <div>
              <p className="text-2xs text-zinc-600 tracking-[0.4em] uppercase mb-1">
                The Film Log of
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-[0.2em] leading-none">
                {user.displayName || user.username}
              </h1>
            </div>
          </div>

          {/* Year pills + count */}
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => router.push(`${pathname}?year=${y}`)}
                  className={`flex-shrink-0 px-3 py-1 font-mono text-2xs font-bold tracking-wider uppercase
                    border-2 transition-all duration-200 ${
                      y === year
                        ? "bg-red-700 border-red-600 text-white"
                        : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                    }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <span className="text-2xs text-zinc-600 tracking-[0.3em] uppercase flex-shrink-0 ml-4">
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
        <div className="mt-16 pt-6 border-t-2 border-zinc-900 flex items-center justify-between">
          <a
            href="/goblinday"
            className="text-2xs text-zinc-700 font-mono tracking-[0.2em] uppercase
              hover:text-red-500 transition-colors"
          >
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

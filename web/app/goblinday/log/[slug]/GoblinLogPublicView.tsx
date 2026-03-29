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
    <main className="min-h-screen bg-[var(--void)]">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {user.avatarUrl && (
            <SmartImage
              src={user.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              {user.displayName || user.username}
            </h1>
            <p className="text-xs text-[var(--muted)] font-mono">Movie Log</p>
          </div>
        </div>

        {/* Year pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => router.push(`${pathname}?year=${y}`)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs font-medium
                border transition-all duration-200 ${
                  y === year
                    ? "bg-[var(--coral)]/15 border-[var(--coral)]/40 text-[var(--coral)]"
                    : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
                }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Count */}
        <p className="text-xs text-[var(--muted)] font-mono mb-6">
          {entries.length} movie{entries.length !== 1 ? "s" : ""} in {year}
        </p>

        {/* List */}
        {entries.length > 0 ? (
          <div className="space-y-1">
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
          <div className="flex items-center justify-center py-20">
            <p className="text-[var(--muted)] font-mono text-sm">
              No movies logged in {year}
            </p>
          </div>
        )}

        {/* Footer link */}
        <div className="mt-12 text-center">
          <a
            href="/goblinday"
            className="text-xs text-[var(--muted)] font-mono hover:text-[var(--coral)] transition-colors"
          >
            Goblin Day on Lost City
          </a>
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { Clock, X } from "@phosphor-icons/react";
import { getPresearchConfig } from "@/lib/search/presearch-config";

interface PresearchBodyProps {
  portalSlug: string;
  mode: "inline" | "overlay";
  recentSearches: string[];
  onSelectRecent: (term: string) => void;
  onClearRecent: () => void;
  onRemoveRecent: (term: string) => void;
}

export function PresearchBody({
  portalSlug,
  mode,
  recentSearches,
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
}: PresearchBodyProps) {
  const config = getPresearchConfig(portalSlug);
  const recentsMax = mode === "overlay" ? 5 : 3;
  const visibleRecents = recentSearches.slice(0, recentsMax);

  return (
    <div className="space-y-5">
      {visibleRecents.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">Recent</p>
            {mode === "overlay" && (
              <button
                type="button"
                onClick={onClearRecent}
                className="text-2xs font-mono text-[var(--muted)] hover:text-[var(--coral)]"
              >
                Clear all
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {visibleRecents.map((term) => (
              <li
                key={term}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--twilight)]/40 group"
              >
                <Clock weight="duotone" className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => onSelectRecent(term)}
                  className="flex-1 text-left text-sm text-[var(--cream)] truncate"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(term)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--coral)]"
                  aria-label={`Remove "${term}"`}
                >
                  <X weight="bold" className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {config.quickIntents.length > 0 && (
        <section className="space-y-2">
          {mode === "overlay" && (
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Quick Intents
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {config.quickIntents.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="px-3 py-1.5 rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/60 text-sm text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--twilight)] transition-colors"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {mode === "overlay" && config.categories.length > 0 && (
        <section className="space-y-2">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Browse by Category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {config.categories.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="px-3 py-1.5 rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/60 text-sm text-[var(--soft)] hover:text-[var(--cream)]"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {mode === "overlay" && config.neighborhoods.length > 0 && (
        <section className="space-y-2">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Browse by Neighborhood
          </p>
          <div className="flex flex-wrap gap-1.5">
            {config.neighborhoods.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="px-3 py-1.5 rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/60 text-sm text-[var(--soft)] hover:text-[var(--cream)]"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

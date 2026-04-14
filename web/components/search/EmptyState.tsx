"use client";

import Link from "next/link";
import { MagnifyingGlass, WifiSlash, Warning } from "@phosphor-icons/react";

export type EmptyStateKind =
  | "zero"
  | "loading"
  | "error"
  | "network"
  | "rate-limited"
  | "offline";

interface EmptyStateProps {
  kind: EmptyStateKind;
  query: string;
  portalSlug: string;
  message?: string;
  onRetry?: () => void;
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 p-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse h-[84px]">
      <div className="w-16 h-16 rounded-md bg-[var(--twilight)]/50 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 bg-[var(--twilight)]/50 rounded" />
        <div className="h-4 w-full bg-[var(--twilight)]/50 rounded" />
        <div className="h-3 w-1/2 bg-[var(--twilight)]/40 rounded" />
      </div>
    </div>
  );
}

export function EmptyState({ kind, query, portalSlug, message, onRetry }: EmptyStateProps) {
  if (kind === "loading") {
    return (
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (kind === "zero") {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <MagnifyingGlass weight="duotone" className="w-12 h-12 text-[var(--twilight)]" />
        <p className="mt-4 text-sm text-[var(--soft)]">
          Nothing matched <span className="font-semibold text-[var(--cream)]">&ldquo;{query}&rdquo;</span>. Try a category below or adjust your search.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {["music", "comedy", "food_drink", "nightlife"].map((cat) => (
            <Link
              key={cat}
              href={`/${portalSlug}/explore?lane=events&categories=${cat}`}
              className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
            >
              {cat.replace("_", " ")}
            </Link>
          ))}
        </div>
        <Link href={`/${portalSlug}/explore`} className="mt-4 text-xs font-mono text-[var(--coral)] hover:opacity-80">
          Browse everything →
        </Link>
      </div>
    );
  }

  if (kind === "offline") {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <WifiSlash weight="duotone" className="w-10 h-10 text-[var(--muted)]" />
        <p className="mt-4 text-sm text-[var(--soft)]">You&apos;re offline. Connect to search.</p>
      </div>
    );
  }

  if (kind === "rate-limited") {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <Warning weight="duotone" className="w-10 h-10 text-[var(--gold)]" />
        <p className="mt-4 text-sm text-[var(--soft)]">Too many searches — give it a second.</p>
      </div>
    );
  }

  // error / network fallback
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <Warning weight="duotone" className="w-10 h-10 text-[var(--coral)]" />
      <p className="mt-4 text-sm text-[var(--soft)]">
        Search is having a moment. {message ? <span className="text-[var(--muted)]">({message})</span> : null}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 px-4 py-1.5 rounded-lg border border-[var(--coral)] text-[var(--coral)] text-xs font-mono hover:bg-[var(--coral)]/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}

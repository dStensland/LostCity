"use client";

export default function BestOfLeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <p className="text-sm text-[var(--muted)] mb-4">
          Something went wrong loading this leaderboard.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-mono font-medium bg-white/10 text-[var(--cream)] hover:bg-white/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

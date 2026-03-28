"use client";

interface EventCardBadgesProps {
  isLive: boolean;
  hasFestivalId: boolean;
  isTentpole: boolean;
  /** Cost tier from taxonomy v2 — renders $ / $$ / $$$ badge (not "free", which is already in metadata) */
  costTier?: string | null;
  /** "mobile" = smaller dot/text sizes; "desktop" = slightly larger */
  size?: "mobile" | "desktop";
}

export function EventCardBadges({
  isLive,
  hasFestivalId,
  isTentpole,
  costTier,
  size = "desktop",
}: EventCardBadgesProps) {
  const dotSize = size === "mobile" ? "h-1.5 w-1.5" : "h-2 w-2";
  const iconSize = "w-2.5 h-2.5";
  const shrinkClass = size === "desktop" ? "flex-shrink-0" : "";

  return (
    <>
      {isLive && (
        <span
          className={`${shrinkClass} inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--neon-red)]/15 border-[var(--neon-red)]/30`}
        >
          <span className={`relative flex ${dotSize}`}>
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40`}
            />
            <span
              className={`relative inline-flex rounded-full ${dotSize} bg-[var(--neon-red)]`}
            />
          </span>
          <span className="font-mono text-2xs font-medium text-[var(--neon-red)] uppercase tracking-wide">
            Live
          </span>
        </span>
      )}
      {hasFestivalId && (
        <span
          className={`${shrinkClass} inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--neon-cyan)]/15 border-[var(--neon-cyan)]/30`}
        >
          <svg
            className={`${iconSize} text-[var(--neon-cyan)]`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 4v16m0-12h9l-1.5 3L14 14H5"
            />
          </svg>
          <span className="font-mono text-2xs font-medium text-[var(--neon-cyan)] uppercase tracking-wide">
            Festival
          </span>
        </span>
      )}
      {isTentpole && (
        <span
          className={`${shrinkClass} inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--gold)]/15 border-[var(--gold)]/30`}
        >
          <svg
            className={`${iconSize} text-[var(--gold)]`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="font-mono text-2xs font-medium text-[var(--gold)] uppercase tracking-wide">
            Big Stuff
          </span>
        </span>
      )}
      {costTier && costTier !== "free" && (
        <span
          className={`${shrinkClass} inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--gold)]/10 border-[var(--gold)]/25`}
        >
          <span className="font-mono text-2xs font-medium text-[var(--gold)] uppercase tracking-wide">
            {costTier}
          </span>
        </span>
      )}
    </>
  );
}

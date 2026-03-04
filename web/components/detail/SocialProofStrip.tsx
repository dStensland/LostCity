import type { ReactNode } from "react";

export interface SocialProofStripProps {
  goingCount: number;
  interestedCount: number;
  /** Slot for client-side FriendsGoing component (avatar stack). */
  children?: ReactNode;
}

/*
 * Inline SVGs matching EventCard's social proof pills.
 * Kept local to avoid icon library import in a server component that
 * only needs two fixed shapes.
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
      />
    </svg>
  );
}

/**
 * SocialProofStrip — Attendance indicators for detail pages.
 *
 * Renders a card with two rows:
 *   1. FriendsGoing avatars (passed as children, client component)
 *   2. Aggregate count pills matching EventCard's visual language
 *      — coral checkmark pill for "going", gold star pill for "interested"
 *
 * Returns null when both counts are zero and no children are provided.
 *
 * Usage:
 *   <SocialProofStrip goingCount={42} interestedCount={18}>
 *     <FriendsGoing eventId={event.id} />
 *   </SocialProofStrip>
 */
export function SocialProofStrip({
  goingCount,
  interestedCount,
  children,
}: SocialProofStripProps) {
  const hasCounts = goingCount > 0 || interestedCount > 0;
  if (!hasCounts && !children) return null;

  return (
    <div className="flex flex-col gap-3 px-4 py-3 rounded-lg border border-[var(--twilight)]/60 bg-[var(--night)] shadow-card-sm">
      {/* Row 1: Friend avatars (client-rendered, may be empty) */}
      {children}

      {/* Row 2: Aggregate count pills — matches EventCard pill language */}
      {hasCounts && (
        <div className="flex items-center gap-2 flex-wrap">
          {goingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
              <CheckIcon className="w-3.5 h-3.5" />
              {goingCount} going
            </span>
          )}
          {interestedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
              <StarIcon className="w-3.5 h-3.5" />
              {interestedCount} interested
            </span>
          )}
        </div>
      )}
    </div>
  );
}

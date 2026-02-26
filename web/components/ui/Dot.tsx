/**
 * Dot — Inline metadata separator.
 *
 * Replaces the ~74 instances of `<span className="opacity-40">·</span>`
 * scattered across the codebase. Renders a middot (·) with standardized
 * opacity, sized to match surrounding text.
 *
 * Usage:
 *   <span>Venue Name</span>
 *   <Dot />
 *   <span>Neighborhood</span>
 */

export default function Dot({ className }: { className?: string }) {
  return (
    <span className={className || "opacity-40"} aria-hidden="true">
      ·
    </span>
  );
}

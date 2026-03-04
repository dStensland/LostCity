import { Quotes } from "@phosphor-icons/react/dist/ssr";

export interface DescriptionTeaserProps {
  /** Raw event/entity description (NOT the machine-generated displayDescription). */
  description: string | null | undefined;
  /** CSS color value for the accent border + icon. Defaults to --coral. */
  accentColor?: string;
}

/** Extract first sentence as a teaser (30–180 chars). Returns null if not meaningful. */
function extractTeaser(description: string | null | undefined): string | null {
  if (!description || description.length < 50) return null;

  // Find first sentence boundary: period/exclamation/question followed by space or end
  const match = description.match(/^(.+?[.!?])(?:\s|$)/);
  if (match) {
    const sentence = match[1].trim();
    // If the sentence IS the entire description, skip — it will appear in About
    const remainder = description.slice(match[0].length).trim();
    if (!remainder) return null;
    if (sentence.length >= 30 && sentence.length <= 180) {
      return sentence;
    }
    // Sentence too long — truncate at word boundary
    if (sentence.length > 180) {
      const truncated = sentence.slice(0, 180).replace(/\s+\S*$/, "");
      return truncated ? truncated + "\u2026" : null;
    }
    // Sentence too short — skip
    return null;
  }

  // No sentence boundary found — truncate at word boundary
  if (description.length > 180) {
    const truncated = description.slice(0, 180).replace(/\s+\S*$/, "");
    return truncated ? truncated + "\u2026" : null;
  }

  return null;
}

/**
 * DescriptionTeaser — Pull-quote teaser for detail pages.
 *
 * Extracts the first meaningful sentence from a description and renders it
 * as a blockquote with a Phosphor Quotes icon and accent-colored left border.
 * Returns null when the description is too short or has no meaningful first sentence.
 *
 * Usage:
 *   <DescriptionTeaser description={event.description} accentColor={categoryColor} />
 */
export function DescriptionTeaser({
  description,
  accentColor = "var(--coral)",
}: DescriptionTeaserProps) {
  const teaser = extractTeaser(description);
  if (!teaser) return null;

  return (
    <blockquote
      className="flex gap-3 pl-4 border-l-2 py-1"
      style={{ borderColor: accentColor }}
    >
      <Quotes
        size={20}
        weight="light"
        className="flex-shrink-0 mt-0.5 opacity-70"
        style={{ color: accentColor }}
      />
      <p className="text-sm italic text-[var(--soft)] leading-relaxed">
        {teaser}
      </p>
    </blockquote>
  );
}

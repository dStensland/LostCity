"use client";

type Props = {
  tag: string;
  size?: "sm" | "md";
  onRemove?: () => void;
};

// Tag color mapping
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  // Error tags - red
  timeout: { bg: "bg-red-500/20", text: "text-red-400" },
  "dns-error": { bg: "bg-red-500/20", text: "text-red-400" },
  "ssl-error": { bg: "bg-red-500/20", text: "text-red-400" },
  // Warning tags - orange/yellow
  "parse-error": { bg: "bg-orange-500/20", text: "text-orange-400" },
  "no-events": { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  // Social tags - purple
  "instagram-only": { bg: "bg-purple-500/20", text: "text-purple-400" },
  "facebook-events": { bg: "bg-purple-500/20", text: "text-purple-400" },
  // Special tags - blue
  seasonal: { bg: "bg-blue-500/20", text: "text-blue-400" },
};

// Tag display names
const TAG_LABELS: Record<string, string> = {
  timeout: "Timeout",
  "dns-error": "DNS Error",
  "ssl-error": "SSL Error",
  "parse-error": "Parse Error",
  "no-events": "No Events",
  "instagram-only": "Instagram Only",
  "facebook-events": "FB Events",
  seasonal: "Seasonal",
};

export function getTagColor(tag: string): { bg: string; text: string } {
  return TAG_COLORS[tag] || { bg: "bg-[var(--twilight)]", text: "text-[var(--muted)]" };
}

export function getTagLabel(tag: string): string {
  return TAG_LABELS[tag] || tag;
}

export default function HealthTagBadge({ tag, size = "md", onRemove }: Props) {
  const colors = getTagColor(tag);
  const label = getTagLabel(tag);

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[0.6rem]",
    md: "px-2 py-0.5 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} ${colors.bg} ${colors.text} rounded font-mono`}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70"
          aria-label={`Remove ${label}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

// Export all valid tags for filters
export const ALL_HEALTH_TAGS = Object.keys(TAG_COLORS);

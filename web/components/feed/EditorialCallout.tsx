"use client";

interface EditorialCalloutProps {
  highlightText: string;
  remainderText: string;
  accentColor?: string;
}

export function EditorialCallout({
  highlightText,
  remainderText,
  accentColor,
}: EditorialCalloutProps) {
  const borderColor = accentColor ?? "var(--gold)";
  const bgColor = accentColor ?? "var(--gold)";

  return (
    <div
      className="rounded-r-lg px-4 py-3 bg-[var(--gold)]/5"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        ...(accentColor ? { backgroundColor: `color-mix(in srgb, ${bgColor} 5%, transparent)` } : {}),
      }}
    >
      <p className="text-sm sm:text-base leading-snug">
        <span
          className="font-semibold"
          style={{ color: accentColor ?? "var(--gold)" }}
        >
          {highlightText}
        </span>
        <span className="text-[var(--soft)]"> {remainderText}</span>
      </p>
    </div>
  );
}

export type { EditorialCalloutProps };

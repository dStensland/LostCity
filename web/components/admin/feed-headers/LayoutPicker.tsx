"use client";

/**
 * LayoutPicker — Visual selector for GreetingBar layout variants.
 * Shows miniature wireframe previews of each layout treatment.
 */

import type { LayoutVariant } from "@/lib/city-pulse/types";

interface LayoutPickerProps {
  value: LayoutVariant | "";
  onChange: (variant: LayoutVariant | "") => void;
}

const VARIANTS: { id: LayoutVariant | ""; label: string; description: string }[] = [
  { id: "", label: "Auto", description: "Rotates by day + time" },
  { id: "centered", label: "Centered", description: "Magazine cover, centered masthead" },
  { id: "bottom-left", label: "Bottom Left", description: "Editorial, anchored bottom-left" },
  { id: "split", label: "Split", description: "Masthead top, copy bottom" },
  { id: "editorial", label: "Editorial", description: "Right-aligned masthead, left copy" },
];

/** Miniature wireframe for each layout variant */
function LayoutWireframe({ variant }: { variant: LayoutVariant | "" }) {
  const base = "w-full h-full relative";

  if (variant === "") {
    // Auto: show rotation arrows
    return (
      <div className={base + " flex items-center justify-center"}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
          <path d="M21 3v9h-9M3 21v-9h9" />
        </svg>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div className={base + " flex flex-col items-center justify-end pb-2 gap-0.5"}>
        <div className="w-8 h-1.5 rounded-full bg-[var(--cream)]/60" />
        <div className="w-5 h-1 rounded-full bg-[var(--coral)]/50" />
        <div className="w-10 h-0.5 rounded-full bg-[var(--cream)]/25 mt-1" />
        <div className="w-7 h-0.5 rounded-full bg-[var(--cream)]/15" />
      </div>
    );
  }

  if (variant === "bottom-left") {
    return (
      <div className={base + " flex flex-col justify-end items-start pl-1.5 pb-2 gap-0.5"}>
        <div className="w-7 h-1.5 rounded-full bg-[var(--cream)]/60" />
        <div className="w-5 h-1 rounded-full bg-[var(--coral)]/50" />
        <div className="flex items-start gap-0.5 mt-1">
          <div className="w-px h-3 bg-[var(--coral)]/40 shrink-0" />
          <div className="space-y-0.5">
            <div className="w-8 h-0.5 rounded-full bg-[var(--cream)]/25" />
            <div className="w-6 h-0.5 rounded-full bg-[var(--cream)]/15" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "split") {
    return (
      <div className={base + " flex flex-col justify-between pl-1.5 pr-1.5 pt-2 pb-2"}>
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="w-6 h-1.5 rounded-full bg-[var(--cream)]/60" />
            <div className="w-4 h-1 rounded-full bg-[var(--coral)]/50" />
          </div>
          <div className="w-3 h-0.5 rounded-full bg-[var(--cream)]/20" />
        </div>
        <div className="space-y-0.5">
          <div className="w-9 h-0.5 rounded-full bg-[var(--cream)]/25" />
          <div className="w-6 h-0.5 rounded-full bg-[var(--cream)]/15" />
        </div>
      </div>
    );
  }

  // editorial
  return (
    <div className={base + " flex flex-col justify-between pl-1.5 pr-1.5 pt-2 pb-2"}>
      <div className="w-3 h-0.5 rounded-full bg-[var(--cream)]/20" />
      <div className="space-y-0.5">
        <div className="flex justify-end">
          <div className="space-y-0.5">
            <div className="w-7 h-1.5 rounded-full bg-[var(--cream)]/60" />
            <div className="w-5 h-1 rounded-full bg-[var(--coral)]/50" />
          </div>
        </div>
        <div className="w-8 h-0.5 rounded-full bg-[var(--cream)]/25 mt-1" />
        <div className="w-5 h-0.5 rounded-full bg-[var(--cream)]/15" />
      </div>
    </div>
  );
}

export default function LayoutPicker({ value, onChange }: LayoutPickerProps) {
  return (
    <div className="space-y-2">
      <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--muted)]">
        Layout
      </span>

      <div className="grid grid-cols-5 gap-1.5">
        {VARIANTS.map((v) => {
          const isSelected = value === v.id;
          return (
            <button
              key={v.id || "auto"}
              type="button"
              onClick={() => onChange(v.id)}
              title={v.description}
              className={`
                relative rounded-lg overflow-hidden aspect-[3/4] transition-all
                border bg-[var(--night)]
                ${
                  isSelected
                    ? "border-[var(--coral)] ring-1 ring-[var(--coral)] ring-offset-1 ring-offset-[var(--void)]"
                    : "border-[var(--twilight)] opacity-60 hover:opacity-100 hover:border-[var(--soft)]"
                }
              `}
            >
              <LayoutWireframe variant={v.id} />
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5">
                <span className="font-mono text-[0.4375rem] text-white/80 leading-none">
                  {v.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/**
 * TextTreatmentPicker — Visual selector for text rendering presets.
 * Each preset combines gradient intensity, text shadows, and optional backdrop effects.
 */

import type { TextTreatment } from "@/lib/city-pulse/types";

interface TextTreatmentPickerProps {
  value: TextTreatment | "";
  onChange: (treatment: TextTreatment | "") => void;
}

const TREATMENTS: { id: TextTreatment | ""; label: string; description: string }[] = [
  { id: "", label: "Auto", description: "Picks based on time slot" },
  { id: "clean", label: "Clean", description: "Text shadow, standard gradient" },
  { id: "frosted", label: "Frosted", description: "Blurred glass behind text" },
  { id: "bold", label: "Bold", description: "Heavy gradient + strong shadow" },
  { id: "cinematic", label: "Cinematic", description: "Deep vignette, dramatic" },
];

/** Miniature visual preview of each treatment */
function TreatmentPreview({ treatment }: { treatment: TextTreatment | "" }) {
  // Simulated photo background with text block
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Fake photo noise */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#4a6741] via-[#8b7355] to-[#556b7a]" />

      {/* Treatment-specific overlay */}
      {treatment === "" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M11.5 2.5a2 2 0 012 2v7a2 2 0 01-2 2h-7a2 2 0 01-2-2v-7a2 2 0 012-2h7z" />
            <path d="M6 8h4M8 6v4" />
          </svg>
        </div>
      )}

      {treatment === "clean" && (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
          <div className="absolute bottom-1 left-1.5">
            <div className="w-6 h-1 rounded-full bg-white/90" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }} />
            <div className="w-4 h-0.5 rounded-full bg-white/50 mt-0.5" />
          </div>
        </>
      )}

      {treatment === "frosted" && (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.4) 100%)" }} />
          <div className="absolute bottom-1 left-1 right-1">
            <div className="rounded-sm px-1 py-0.5" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
              <div className="w-5 h-1 rounded-full bg-white/90" />
              <div className="w-3.5 h-0.5 rounded-full bg-white/50 mt-0.5" />
            </div>
          </div>
        </>
      )}

      {treatment === "bold" && (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%)" }} />
          <div className="absolute bottom-1 left-1.5">
            <div className="w-7 h-1.5 rounded-full bg-white" />
            <div className="w-4 h-0.5 rounded-full bg-white/60 mt-0.5" />
          </div>
        </>
      )}

      {treatment === "cinematic" && (
        <>
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)" }} />
          <div className="absolute bottom-1 left-1.5">
            <div className="w-6 h-1 rounded-full bg-white/95" />
            <div className="w-4 h-0.5 rounded-full bg-white/40 mt-0.5" />
          </div>
        </>
      )}
    </div>
  );
}

export default function TextTreatmentPicker({ value, onChange }: TextTreatmentPickerProps) {
  return (
    <div className="space-y-2">
      <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--muted)]">
        Text Treatment
      </span>

      <div className="grid grid-cols-5 gap-1.5">
        {TREATMENTS.map((t) => {
          const isSelected = value === t.id;
          return (
            <button
              key={t.id || "auto"}
              type="button"
              onClick={() => onChange(t.id)}
              title={t.description}
              className={`
                relative rounded-lg overflow-hidden aspect-[3/4] transition-all
                border
                ${
                  isSelected
                    ? "border-[var(--coral)] ring-1 ring-[var(--coral)] ring-offset-1 ring-offset-[var(--void)]"
                    : "border-[var(--twilight)] opacity-60 hover:opacity-100 hover:border-[var(--soft)]"
                }
              `}
            >
              <TreatmentPreview treatment={t.id} />
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5">
                <span className="font-mono text-[0.4375rem] text-white/80 leading-none">
                  {t.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

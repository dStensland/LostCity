"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { effects, type EffectDef } from "./effect-defs";

function EffectCanvas({ effect, expanded }: { effect: EffectDef; expanded?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (expanded) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    } else {
      canvas.width = 480;
      canvas.height = 300;
    }

    return effect.init(canvas);
  }, [effect, expanded]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

function ExpandedOverlay({
  effect,
  onClose,
}: {
  effect: EffectDef;
  onClose: () => void;
}) {
  const onCloseStable = useCallback(onClose, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseStable();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCloseStable]);

  return (
    <div className="fixed inset-0 z-50">
      <EffectCanvas effect={effect} expanded />

      {/* Info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
        <p className="font-mono text-2xs text-white/40 tracking-[0.3em] uppercase mb-1">
          Effects Lab
        </p>
        <h2 className="font-mono text-lg sm:text-xl font-bold text-white">
          {effect.name}
        </h2>
        <p className="text-sm text-white/60 mt-1 max-w-lg">
          {effect.description}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {effect.tags.map((tag) => (
            <span
              key={tag}
              className="text-2xs font-mono text-white/40 px-1.5 py-0.5
                border border-white/10 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
          flex items-center justify-center text-white font-mono text-sm transition-colors
          backdrop-blur-sm"
      >
        &times;
      </button>
    </div>
  );
}

const STORAGE_KEY = "effects-lab-selected";

function loadSelected(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveSelected(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export default function EffectsGallery() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelected());

  const toggle = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      saveSelected(next);
      return next;
    });
  }, []);

  // Lock body scroll when expanded
  useEffect(() => {
    if (expanded !== null) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [expanded]);

  const selectedEffects = effects.filter((e) => selected.has(e.name));

  return (
    <main className="min-h-screen bg-[var(--void,#09090b)] text-[var(--cream,#f5f5f3)] px-4 py-12 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <p className="font-mono text-xs text-[var(--muted,#8b8b94)] tracking-[0.3em] uppercase mb-2">
            Lab
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Effects Gallery
          </h1>
          <p className="text-[var(--soft,#a1a1aa)] mt-2 max-w-xl text-sm">
            Ambient generative effects for page backgrounds, detail heroes, and
            portal atmosphere. Click to preview fullscreen. Check to shortlist.
          </p>
        </header>

        {/* Selection summary bar */}
        {selectedEffects.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-[var(--coral,#ff6b7a)]/20 bg-[var(--coral,#ff6b7a)]/5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-xs font-bold text-[var(--coral,#ff6b7a)] tracking-[0.12em] uppercase">
                Shortlisted for production ({selectedEffects.length})
              </p>
              <button
                onClick={() => { setSelected(new Set()); saveSelected(new Set()); }}
                className="font-mono text-2xs text-[var(--muted,#8b8b94)] hover:text-[var(--cream,#f5f5f3)]
                  tracking-wider uppercase transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedEffects.map((e) => (
                <span
                  key={e.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                    bg-[var(--coral,#ff6b7a)]/10 border border-[var(--coral,#ff6b7a)]/25
                    font-mono text-xs text-[var(--coral,#ff6b7a)]"
                >
                  {e.name}
                  <button
                    onClick={(ev) => toggle(e.name, ev)}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {effects.map((effect, i) => {
            const isSelected = selected.has(effect.name);
            return (
              <div
                key={effect.name}
                className={`group relative text-left rounded-xl overflow-hidden
                  border transition-all duration-300 hover-lift cursor-pointer
                  bg-[var(--night,#0f0f14)] ${
                    isSelected
                      ? "border-[var(--coral,#ff6b7a)]/40 shadow-[0_0_12px_rgba(255,107,122,0.08)]"
                      : "border-[var(--twilight,#252530)]/60"
                  }`}
                onClick={() => setExpanded(i)}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => toggle(effect.name, e)}
                  className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center
                    transition-all duration-200 backdrop-blur-sm ${
                      isSelected
                        ? "bg-[var(--coral,#ff6b7a)] border-[var(--coral,#ff6b7a)] text-[var(--void,#09090b)]"
                        : "bg-black/30 border-white/20 text-transparent hover:border-white/40"
                    }`}
                  aria-label={isSelected ? `Remove ${effect.name} from shortlist` : `Add ${effect.name} to shortlist`}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="aspect-[16/10] relative overflow-hidden bg-black">
                  {expanded !== i && <EffectCanvas effect={effect} />}
                </div>
                <div className="p-4">
                  <h3 className="font-mono text-sm font-bold text-[var(--cream,#f5f5f3)] tracking-wide">
                    {effect.name}
                  </h3>
                  <p className="text-xs text-[var(--soft,#a1a1aa)] mt-1 line-clamp-2">
                    {effect.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {effect.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-2xs font-mono text-[var(--muted,#8b8b94)] px-1.5 py-0.5
                          border border-[var(--twilight,#252530)]/50 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {expanded !== null && (
        <ExpandedOverlay
          effect={effects[expanded]}
          onClose={() => setExpanded(null)}
        />
      )}
    </main>
  );
}

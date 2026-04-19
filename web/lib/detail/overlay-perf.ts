"use client";

/**
 * Overlay open-latency instrumentation for Phase 7 baseline + before/after.
 *
 * Activated at runtime by setting `localStorage.overlay_perf = '1'` in devtools
 * (or `NEXT_PUBLIC_PERF_OVERLAY=1` at build time). No-op otherwise — zero
 * overhead in prod paths.
 *
 * Two marks per overlay open:
 *   overlay:target-resolved:<ref>   — router observed the overlay query param
 *   overlay:content-ready:<ref>     — detail-view fetch completed (or seed landed)
 *
 * On `content-ready`, we log the delta so baseline numbers show up inline in the
 * console. After Phase 7 ships, same flag, same log, shows the seeded delta.
 */

type Phase = "target-resolved" | "seeded-paint" | "content-ready";

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_PERF_OVERLAY === "1") return true;
  try {
    return window.localStorage?.getItem("overlay_perf") === "1";
  } catch {
    return false;
  }
}

function markName(phase: Phase, ref: string): string {
  return `overlay:${phase}:${ref}`;
}

/**
 * Stamp a named phase for this entity ref. Safe to call multiple times —
 * duplicates are tolerated by the performance API (most recent wins for our
 * measurement purposes).
 */
export function markOverlayPhase(phase: Phase, ref: string): void {
  if (!isEnabled()) return;
  try {
    performance.mark(markName(phase, ref));
    if (phase === "seeded-paint" || phase === "content-ready") {
      const start = markName("target-resolved", ref);
      const entries = performance.getEntriesByName(start);
      if (entries.length === 0) {
        console.info(`[overlay-perf] ${ref} ${phase} (no baseline mark)`);
        return;
      }
      const measureId = `overlay:${phase}:${ref}:${Date.now()}`;
      performance.measure(measureId, start, markName(phase, ref));
      const measure = performance.getEntriesByName(measureId).at(-1);
      if (measure) {
        const label = phase === "seeded-paint" ? "seed" : "ready";
        console.info(
          `[overlay-perf] ${ref} ${label} in ${measure.duration.toFixed(0)}ms`,
        );
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[overlay-perf] mark failed", err);
    }
  }
}

/** Entity-ref builder matching the DetailOverlayTarget shape. */
export function overlayRef(
  target: { kind: string; id?: number | string; slug?: string } | null,
): string | null {
  if (!target) return null;
  const key = target.id ?? target.slug;
  if (key === undefined || key === null) return null;
  return `${target.kind}:${key}`;
}

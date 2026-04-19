"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Layout-context signal for detail views that may render both on a
 * canonical page (full-width) AND inside an overlay card (constrained width).
 *
 * Consumers:
 * - `SeededDetailSkeleton` switches between "full" and "sidebar" layout
 *   variants based on this so seed→full swap doesn't cause CLS.
 * - `EventDetailView` picks shell variant (elevated vs sidebar) based on
 *   whether the view is rendered inside an overlay.
 * - Future consumers that need to adjust layout for the overlay's narrower
 *   card width can read here rather than accept an `inOverlay` prop.
 *
 * Default (`inOverlay: false`) applies when no provider is in scope — the
 * canonical page path. `DetailOverlayRouter` wraps its detail view in an
 * `OverlayContextProvider value={{ inOverlay: true }}` to flip the flag.
 */
export interface OverlayContextValue {
  inOverlay: boolean;
}

const OverlayCtx = createContext<OverlayContextValue>({ inOverlay: false });

export function OverlayContextProvider({
  value,
  children,
}: {
  value: OverlayContextValue;
  children: ReactNode;
}) {
  return <OverlayCtx.Provider value={value}>{children}</OverlayCtx.Provider>;
}

export function useOverlayContext(): OverlayContextValue {
  return useContext(OverlayCtx);
}

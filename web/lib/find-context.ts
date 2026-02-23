"use client";

import { createContext, useContext } from "react";

export interface FindPortalConfig {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
}

export const FindContext = createContext<FindPortalConfig | null>(null);

/**
 * Access portal config without prop drilling.
 * Must be used inside a FindContext.Provider (set up by FindShell).
 */
export function useFindPortal(): FindPortalConfig {
  const ctx = useContext(FindContext);
  if (!ctx) throw new Error("useFindPortal must be used inside FindContext.Provider");
  return ctx;
}

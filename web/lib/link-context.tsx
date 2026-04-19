"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Surface-scoped link mode.
 *
 * - `"overlay"`: entity links render as query-param overlays (`?event=id`,
 *   `?spot=slug`, etc.) handled by `DetailOverlayRouter` on overlay-capable
 *   surfaces (feed, explore).
 * - `"canonical"`: entity links navigate to standalone detail-page routes
 *   (`/events/id`, `/spots/slug`, etc.). Safe default — used when no
 *   provider is in scope (standalone detail pages, unit tests,
 *   shareable-link contexts).
 *
 * Every surface wrapper sets this ONCE at the surface boundary. Cards
 * consume via `useLinkContext()` — callers no longer need to know what
 * surface they're on.
 *
 * Optional override prop on consumers stays available for rare cases
 * (e.g., share buttons that must always link canonical).
 *
 * See `docs/plans/explore-overlay-architecture-2026-04-18.md` § Component 1.
 */
export type LinkContext = "overlay" | "canonical";

const LinkContextCtx = createContext<LinkContext>("canonical");

export function LinkContextProvider({
  value,
  children,
}: {
  value: LinkContext;
  children: ReactNode;
}) {
  return (
    <LinkContextCtx.Provider value={value}>{children}</LinkContextCtx.Provider>
  );
}

/**
 * Read the ambient link context. Returns `"canonical"` when no provider
 * is in scope — safe fallback that never accidentally produces an
 * overlay URL outside an overlay-capable surface.
 */
export function useLinkContext(): LinkContext {
  return useContext(LinkContextCtx);
}

/**
 * Resolve a context value with an optional explicit override.
 *
 * Use in card components that accept an optional `context` prop:
 *   `const context = resolveLinkContext(props.context);`
 *
 * Passing `undefined` (prop omitted) falls back to `useLinkContext()`.
 * Passing an explicit value wins. Never short-circuits on falsy.
 */
export function useResolvedLinkContext(
  override?: LinkContext,
): LinkContext {
  const ambient = useLinkContext();
  return override ?? ambient;
}

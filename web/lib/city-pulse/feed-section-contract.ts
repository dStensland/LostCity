/**
 * Feed section contract.
 *
 * Turns the feed shell into a thin orchestrator over a list of sections with a
 * uniform shape. Sections declare whether they render on the server or as a
 * client island, expose an optional server-side loader for initial data, and
 * carry their own wrapper chrome (anchor ids, index labels, spacing).
 *
 * The server shell resolves a portal-specific manifest, runs server-mode
 * loaders in parallel, then renders each section through a shared wrapper.
 * Client-mode sections are rendered inline as client components and bring
 * their own `"use client"` directive.
 *
 * See docs/plans/feed-shell-server-split-2026-04-17.md.
 */
import type { ComponentType } from "react";

export interface FeedSectionContext {
  portalSlug: string;
  portalId: string;
  vertical?: string | null;
  isLightTheme: boolean;
  /**
   * Server-computed hero image URL for the CityBriefing island's LCP preload.
   * Matches the `<link rel="preload">` emitted in the portal feed surface.
   */
  serverHeroUrl?: string;
}

export type FeedSectionMode = "server" | "client-island";

export interface FeedSectionWrapper {
  id?: string;
  className?: string;
  dataAnchor?: boolean;
  indexLabel?: string;
  /** Stable data-block-id, kept for analytics and anchor navigation parity with the legacy shell. */
  blockId?: string;
}

export interface FeedSectionComponentProps<TData = unknown> {
  ctx: FeedSectionContext;
  /** Pre-loaded server data, typed by the section. Undefined for client-island sections. */
  initialData?: TData;
}

export interface FeedSection<TData = unknown> {
  /** Stable identifier, e.g. "festivals". Used as the React key and the data-block-id fallback. */
  id: string;
  mode: FeedSectionMode;
  component: ComponentType<FeedSectionComponentProps<TData>>;
  /** Runs on the server (RSC path). Returns the data the component needs, or null to skip rendering. */
  loader?: (ctx: FeedSectionContext) => Promise<TData | null>;
  /** Rendered around the section (anchors, spacing, dividers). */
  wrapper?: FeedSectionWrapper;
  /** Gate. If returns false, the section is not rendered at all. */
  shouldRender?: (ctx: FeedSectionContext) => boolean;
}

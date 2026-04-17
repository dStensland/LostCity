/**
 * CityPulseServerShell — server-rendered orchestrator over a feed manifest.
 *
 * Walks the resolved manifest, runs any registered loaders in parallel
 * (server-mode and client-island sections alike — client islands still need
 * their server-prefetched `initialData`), then renders each section through
 * a shared wrapper. Client-mode sections are still rendered inline as client
 * components; the server shell just hosts them without a parent `"use client"`
 * directive.
 *
 * Owns the shell-level theme variables — matches what the legacy
 * `CityPulseShell` applied via inline `style`, derived from the city-pulse
 * context (time_slot, weather, holidays, portal slug).
 */
import type { CSSProperties } from "react";
import type { Portal } from "@/lib/portal-context";
import { getPortalVertical } from "@/lib/portal";
import { getVisualPreset } from "@/lib/visual-presets";
import { getCityPhoto } from "@/lib/city-pulse/header-defaults";
import {
  getDayOfWeek,
  getDayTheme,
  getPortalHour,
  getTimeSlot,
} from "@/lib/city-pulse/time-slots";
import { getFeedThemeVars } from "@/lib/city-pulse/theme";
import { resolveFeedManifest } from "@/lib/city-pulse/manifests";
import type {
  CityPulseResponse,
  FeedContext,
  TimeSlot,
} from "@/lib/city-pulse/types";
import type {
  FeedSection,
  FeedSectionContext,
} from "@/lib/city-pulse/feed-section-contract";

interface Props {
  portal: Portal;
  /** Optional override. Falls back to the same time-of-day computation the legacy shell used. */
  serverHeroUrl?: string;
}

function resolveIsLightTheme(portal: Portal): boolean {
  const branding = portal.branding;
  if (branding?.theme_mode === "light") return true;
  if (branding?.visual_preset) {
    return getVisualPreset(branding.visual_preset)?.theme_mode === "light";
  }
  return false;
}

function resolveServerHeroUrl(): string {
  const now = new Date();
  return getCityPhoto(
    getTimeSlot(getPortalHour(now)),
    undefined,
    getDayOfWeek(now),
  );
}

function buildDefaultContext(timeSlot: TimeSlot, dayOfWeek: string): FeedContext {
  return {
    time_slot: timeSlot,
    day_of_week: dayOfWeek,
    weather: null,
    active_holidays: [],
    active_festivals: [],
    quick_links: [],
    day_theme: getDayTheme(dayOfWeek, timeSlot),
    weather_signal: undefined,
  };
}

export async function CityPulseServerShell({ portal, serverHeroUrl }: Props) {
  const manifest = resolveFeedManifest(portal.slug);
  const ctx: FeedSectionContext = {
    portalSlug: portal.slug,
    portalId: portal.id,
    vertical: getPortalVertical(portal),
    isLightTheme: resolveIsLightTheme(portal),
    serverHeroUrl: serverHeroUrl ?? resolveServerHeroUrl(),
  };

  const serverLoads = await Promise.all(
    manifest
      .filter(
        (section) =>
          section.loader != null &&
          (section.shouldRender?.(ctx) ?? true),
      )
      .map(
        async (section) =>
          [section.id, await section.loader!(ctx)] as const,
      ),
  );
  const byId = new Map<string, unknown>(serverLoads);

  // Pull the feed context from a loaded city-pulse payload when available;
  // fall back to defaults (same pattern the legacy shell used).
  const loadedFeed =
    (byId.get("briefing") as CityPulseResponse | null | undefined) ??
    (byId.get("lineup") as CityPulseResponse | null | undefined) ??
    null;
  const now = new Date();
  const themeContext =
    loadedFeed?.context ??
    buildDefaultContext(getTimeSlot(getPortalHour(now)), getDayOfWeek(now));
  const themeVars = getFeedThemeVars(themeContext, portal.slug, {
    isLightTheme: ctx.isLightTheme,
  });

  return (
    <div style={themeVars as CSSProperties}>
      {manifest.map((section) => {
        if (section.shouldRender && !section.shouldRender(ctx)) return null;
        return renderSection(section, ctx, byId);
      })}
    </div>
  );
}

function renderSection(
  section: FeedSection,
  ctx: FeedSectionContext,
  byId: Map<string, unknown>,
) {
  const Component = section.component;
  const wrapper = section.wrapper ?? {};
  const initialData = section.loader ? byId.get(section.id) : undefined;
  const rendered = <Component ctx={ctx} initialData={initialData} />;

  if (
    !wrapper.id &&
    !wrapper.className &&
    !wrapper.dataAnchor &&
    !wrapper.indexLabel &&
    !wrapper.blockId
  ) {
    return <div key={section.id}>{rendered}</div>;
  }

  return (
    <div
      key={section.id}
      id={wrapper.id}
      className={wrapper.className}
      data-feed-anchor={wrapper.dataAnchor ? "true" : undefined}
      data-index-label={wrapper.indexLabel}
      data-block-id={wrapper.blockId ?? section.id}
    >
      {rendered}
    </div>
  );
}

"use client";

import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";
import { FIND_TYPE_FILTER_KEYS, type FindType } from "@/lib/find-filter-schema";

type SearchParamsLike = { get: (key: string) => string | null };

type FilterInput = SearchParamsLike | Record<string, unknown> | null | undefined;

const FILTER_CHANGE_SECTION_KEY = "find_filter_change";
const ZERO_RESULTS_SECTION_KEY = "find_zero_results";
const DETAIL_AFTER_FILTER_SECTION_KEY = "find_detail_after_filter";

export type FindFilterSnapshot = {
  findType: FindType;
  signature: string;
  activeKeys: string[];
  activeCount: number;
  valuesByKey: Record<string, string>;
};

function hasGetter(input: FilterInput): input is SearchParamsLike {
  return Boolean(input && typeof (input as SearchParamsLike).get === "function");
}

function normalizeValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
      .filter(Boolean)
      .join(",");
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "";
  return "";
}

function readRawValue(input: FilterInput, key: string): string {
  if (!input) return "";
  if (hasGetter(input)) return normalizeValue(input.get(key));
  return normalizeValue(input[key]);
}

export function createFindFilterSnapshot(input: FilterInput, findType: FindType): FindFilterSnapshot {
  const keys = FIND_TYPE_FILTER_KEYS[findType];
  const valuesByKey: Record<string, string> = {};

  for (const key of keys) {
    valuesByKey[key] = readRawValue(input, key);
  }

  const activeKeys = keys.filter((key) => valuesByKey[key].length > 0);
  const signature = activeKeys
    .map((key) => `${key}:${valuesByKey[key]}`)
    .join("|");

  return {
    findType,
    signature,
    activeKeys,
    activeCount: activeKeys.length,
    valuesByKey,
  };
}

export function diffFindFilterKeys(
  previousSnapshot: FindFilterSnapshot,
  nextSnapshot: FindFilterSnapshot
): string[] {
  if (previousSnapshot.findType !== nextSnapshot.findType) return [];

  const keys = FIND_TYPE_FILTER_KEYS[nextSnapshot.findType];
  return keys.filter(
    (key) => previousSnapshot.valuesByKey[key] !== nextSnapshot.valuesByKey[key]
  );
}

type TrackFilterChangeArgs = {
  portalSlug: string;
  findType: FindType;
  displayMode?: string;
  snapshot: FindFilterSnapshot;
  changedKeys: string[];
};

export function trackFindFilterChange({
  portalSlug,
  findType,
  displayMode,
  snapshot,
  changedKeys,
}: TrackFilterChangeArgs) {
  if (!portalSlug || changedKeys.length === 0) return;

  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "find",
    section_key: FILTER_CHANGE_SECTION_KEY,
    target_kind: "find_filters",
    target_label: findType,
    metadata: {
      find_type: findType,
      display_mode: displayMode,
      changed_keys: changedKeys,
      active_filter_keys: snapshot.activeKeys,
      active_filter_count: snapshot.activeCount,
      has_active_filters: snapshot.activeCount > 0,
      filter_signature: snapshot.signature || null,
    },
  });
}

type TrackZeroResultsArgs = {
  portalSlug: string;
  findType: FindType;
  displayMode?: string;
  surface?: string;
  snapshot: FindFilterSnapshot;
  resultCount: number;
};

export function trackFindZeroResults({
  portalSlug,
  findType,
  displayMode,
  surface,
  snapshot,
  resultCount,
}: TrackZeroResultsArgs) {
  if (!portalSlug) return;
  if (resultCount !== 0) return;
  if (snapshot.activeCount === 0) return;

  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "find",
    section_key: ZERO_RESULTS_SECTION_KEY,
    target_kind: "find_zero",
    target_label: findType,
    metadata: {
      find_type: findType,
      display_mode: displayMode,
      surface,
      result_count: resultCount,
      active_filter_keys: snapshot.activeKeys,
      active_filter_count: snapshot.activeCount,
      filter_signature: snapshot.signature || null,
    },
  });
}

export type FindDetailTarget = {
  targetKind: "find_event_detail" | "find_destination_detail" | "find_series_detail";
  targetId: string;
  targetUrl: string;
};

export function resolveFindDetailTarget(
  href: string,
  portalSlug: string
): FindDetailTarget | null {
  if (!href || !portalSlug) return null;

  let url: URL;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.com";
    url = new URL(href, base);
  } catch {
    return null;
  }

  if (typeof window !== "undefined" && url.origin !== window.location.origin) {
    return null;
  }

  const portalRoot = `/${portalSlug}`;

  if (url.pathname === portalRoot) {
    const eventId = url.searchParams.get("event");
    if (eventId) {
      return {
        targetKind: "find_event_detail",
        targetId: eventId,
        targetUrl: `${url.pathname}${url.search}`,
      };
    }

    const spotSlug = url.searchParams.get("spot");
    if (spotSlug) {
      return {
        targetKind: "find_destination_detail",
        targetId: spotSlug,
        targetUrl: `${url.pathname}${url.search}`,
      };
    }

    return null;
  }

  const seriesPrefix = `${portalRoot}/series/`;
  if (url.pathname.startsWith(seriesPrefix)) {
    const seriesSlug = url.pathname.slice(seriesPrefix.length).split("/")[0]?.trim();
    if (!seriesSlug) return null;

    return {
      targetKind: "find_series_detail",
      targetId: seriesSlug,
      targetUrl: `${url.pathname}${url.search}`,
    };
  }

  return null;
}

type TrackDetailAfterFilterArgs = {
  portalSlug: string;
  findType: FindType;
  displayMode?: string;
  snapshot: FindFilterSnapshot;
  detailTarget: FindDetailTarget;
  latencyMs: number;
};

export function trackFindDetailAfterFilter({
  portalSlug,
  findType,
  displayMode,
  snapshot,
  detailTarget,
  latencyMs,
}: TrackDetailAfterFilterArgs) {
  if (!portalSlug) return;
  if (snapshot.activeCount === 0) return;
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return;

  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "find",
    section_key: DETAIL_AFTER_FILTER_SECTION_KEY,
    target_kind: detailTarget.targetKind,
    target_id: detailTarget.targetId,
    target_url: detailTarget.targetUrl,
    metadata: {
      find_type: findType,
      display_mode: displayMode,
      latency_ms: Math.round(latencyMs),
      active_filter_keys: snapshot.activeKeys,
      active_filter_count: snapshot.activeCount,
      filter_signature: snapshot.signature || null,
    },
  });
}

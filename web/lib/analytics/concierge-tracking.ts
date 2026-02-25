"use client";

import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

declare global {
  interface Window {
    __lcConciergeSessionStart?: number;
    __lcConciergeFirstActionTracked?: boolean;
    __lcConciergeReasonChipImpressionKeys?: Set<string>;
  }
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function trackFirstMeaningfulAction(
  portalSlug: string,
  triggerKind: string,
  triggerLabel?: string,
) {
  if (typeof window === "undefined") return;
  if (window.__lcConciergeFirstActionTracked) return;

  const startedAt = window.__lcConciergeSessionStart;
  if (typeof startedAt !== "number") return;

  const elapsedMs = Math.max(0, Math.round(nowMs() - startedAt));
  window.__lcConciergeFirstActionTracked = true;

  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: "concierge_first_action",
    target_kind: "metric",
    target_label: "first_meaningful_action_ms",
    metadata: {
      elapsed_ms: elapsedMs,
      trigger_kind: triggerKind,
      trigger_label: triggerLabel,
    },
  });
}

export function initConciergeTrackingSession() {
  if (typeof window === "undefined") return;
  window.__lcConciergeSessionStart = nowMs();
  window.__lcConciergeFirstActionTracked = false;
  window.__lcConciergeReasonChipImpressionKeys = new Set<string>();
}

type ConciergeResourceParams = {
  sectionKey: string;
  targetKind: string;
  targetId?: string;
  targetLabel?: string;
  targetUrl?: string;
  metadata?: Record<string, unknown>;
};

const CONCIERGE_REASON_CHIP_IMPRESSION_SECTION_KEY = "concierge_reason_chip_impression";

function sanitizeReasonChips(reasonChips: string[] | undefined): string[] {
  if (!Array.isArray(reasonChips)) return [];
  return Array.from(
    new Set(
      reasonChips
        .map((reason) => (typeof reason === "string" ? reason.trim() : ""))
        .filter(Boolean)
        .slice(0, 6),
    ),
  );
}

function reasonChipSignature(reasonChips: string[]): string | undefined {
  if (reasonChips.length === 0) return undefined;
  return reasonChips.join("|").slice(0, 240);
}

export function buildReasonChipInfluenceMetadata(
  reasonChips: string[] | undefined,
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const normalized = sanitizeReasonChips(reasonChips);
  if (normalized.length === 0) return metadata;

  const signature = reasonChipSignature(normalized);
  return {
    ...(metadata || {}),
    reason_chip_present: true,
    reason_chip_count: normalized.length,
    reason_chip_signature: signature,
    reason_chips: normalized,
  };
}

type ConciergeReasonChipImpressionParams = {
  sectionKey: string;
  targetKind: string;
  targetId?: string;
  targetLabel?: string;
  reasonChips: string[];
  metadata?: Record<string, unknown>;
};

export function trackConciergeReasonChipImpression(
  portalSlug: string,
  params: ConciergeReasonChipImpressionParams,
) {
  if (typeof window === "undefined") return;

  const normalizedReasonChips = sanitizeReasonChips(params.reasonChips);
  if (normalizedReasonChips.length === 0) return;

  if (!window.__lcConciergeReasonChipImpressionKeys) {
    window.__lcConciergeReasonChipImpressionKeys = new Set<string>();
  }

  const contextKey = typeof params.metadata?.context_key === "string"
    ? params.metadata.context_key
    : "default";
  const key = [
    portalSlug,
    params.sectionKey,
    params.targetKind,
    params.targetId || "unknown",
    contextKey,
    reasonChipSignature(normalizedReasonChips) || "none",
  ].join(":");

  if (window.__lcConciergeReasonChipImpressionKeys.has(key)) return;
  window.__lcConciergeReasonChipImpressionKeys.add(key);

  const metadata = buildReasonChipInfluenceMetadata(normalizedReasonChips, {
    ...(params.metadata || {}),
    source_section_key: params.sectionKey,
  });

  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: CONCIERGE_REASON_CHIP_IMPRESSION_SECTION_KEY,
    target_kind: params.targetKind,
    target_id: params.targetId,
    target_label: params.targetLabel,
    metadata,
  });
}

export function trackConciergeResource(
  portalSlug: string,
  params: ConciergeResourceParams,
) {
  trackFirstMeaningfulAction(portalSlug, params.targetKind, params.targetLabel);

  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: params.sectionKey,
    target_kind: params.targetKind,
    target_id: params.targetId,
    target_label: params.targetLabel,
    target_url: params.targetUrl,
    metadata: params.metadata,
  });
}

type ConciergeWayfindingParams = {
  sectionKey: string;
  targetLabel: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export function trackConciergeWayfinding(
  portalSlug: string,
  params: ConciergeWayfindingParams,
) {
  trackFirstMeaningfulAction(portalSlug, "wayfinding", params.targetLabel);

  trackPortalAction(portalSlug, {
    action_type: "wayfinding_opened",
    page_type: "feed",
    section_key: params.sectionKey,
    target_kind: "wayfinding",
    target_id: params.targetId,
    target_label: params.targetLabel,
    metadata: params.metadata,
  });
}

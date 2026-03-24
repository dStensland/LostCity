// Server-side data fetching for Open Calls
// Types and display helpers live in lib/types/open-calls.ts

import { getSiteUrl } from "@/lib/site-url";
import type { OpenCallWithOrg } from "@/lib/types/open-calls";

export type { OpenCallWithOrg } from "@/lib/types/open-calls";
export type {
  OpenCall,
  CallType,
  CallStatus,
  ConfidenceTier,
} from "@/lib/types/open-calls";

export interface OpenCallsFilters {
  type?: string;
  tier?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface OpenCallsResult {
  open_calls: OpenCallWithOrg[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Fetch open calls from the portal-scoped API.
 * Called server-side from page components — uses internal API URL.
 */
export async function getOpenCalls(
  portalSlug: string,
  filters: OpenCallsFilters = {}
): Promise<OpenCallsResult> {
  const params = new URLSearchParams({ portal: portalSlug });

  if (filters.type) params.set("type", filters.type);
  if (filters.tier) params.set("tier", filters.tier);
  if (filters.status) params.set("status", filters.status);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));

  const url = `${getSiteUrl()}/api/open-calls?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error(`[getOpenCalls] API error ${res.status} for portal=${portalSlug}`);
      return { open_calls: [], total: 0, offset: 0, limit: filters.limit ?? 20 };
    }

    return (await res.json()) as OpenCallsResult;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[getOpenCalls] Request timed out");
    } else {
      console.error("[getOpenCalls] Fetch error:", err);
    }
    return { open_calls: [], total: 0, offset: 0, limit: filters.limit ?? 20 };
  } finally {
    clearTimeout(timeoutId);
  }
}

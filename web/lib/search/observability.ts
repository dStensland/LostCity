import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { PresentedResults } from "@/lib/search/presenting/types";

/**
 * Single-source query hashing. Per spec §3.6 and the security reviewer's
 * R12 concern: the hash function lives HERE. Every write path and future
 * analytics join path must call this — not reimplement it.
 *
 * Formula: sha256(normalized_query || '\0' || portal_slug || '\0' || salt)
 *
 * The salt is rotated daily. Hashes are not reproducible across day
 * boundaries (intentional — defeats long-term correlation of query history).
 */
export function hashQuery(
  normalizedQ: string,
  salt: Buffer,
  portalSlug: string
): Buffer {
  return createHash("sha256")
    .update(normalizedQ)
    .update("\0")
    .update(portalSlug)
    .update("\0")
    .update(salt)
    .digest();
}

/**
 * In-process cache of today's salt. TTL 60s — short enough to pick up
 * a cron rotation quickly, long enough to amortize the DB read across
 * the warm hot path.
 */
let cachedSalt: { day: string; salt: Buffer; expires: number } | null = null;

/**
 * Fetch today's salt from the search_log_salt table. Creates an
 * in-process cache entry with 60s TTL. The cron job at 00:05 UTC
 * rotates the salt daily (Phase 1); Phase 0 seeds today's row at
 * migration time so this function never sees a missing salt.
 */
export async function getTodaySalt(): Promise<Buffer> {
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  if (cachedSalt && cachedSalt.day === today && cachedSalt.expires > now) {
    return cachedSalt.salt;
  }
  const client = createServiceClient();
  const { data, error } = await client
    .from("search_log_salt")
    .select("salt")
    .eq("day", today)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`search_log_salt missing for ${today}`);
  }
  const salt = Buffer.from((data as { salt: Uint8Array }).salt);
  cachedSalt = { day: today, salt, expires: now + 60_000 };
  return salt;
}

export interface BuildRowInput {
  query: string;
  portalSlug: string;
  segment: "anon" | "authed";
  hadFilters: boolean;
  presented: PresentedResults;
  intentType: string;
  salt: Buffer;
}

/**
 * Build a search_events row from the orchestrator's output and request
 * context. CRITICAL: no user_id. Only user_segment. See spec §3.6 and
 * the security review rationale — GDPR cascade prevention.
 */
export function buildSearchEventRow(input: BuildRowInput) {
  const { query, portalSlug, segment, hadFilters, presented, intentType, salt } = input;
  return {
    portal_slug: portalSlug,
    locale: "en",
    user_segment: segment,
    query_hash: hashQuery(query, salt, portalSlug),
    query_length: query.length,
    query_word_count: query.split(/\s+/).filter(Boolean).length,
    intent_type: intentType,
    filters_json: hadFilters ? { had: true } : {},
    cache_hit: presented.diagnostics.cache_hit,
    degraded: presented.diagnostics.degraded,
    // retriever_breakdown stays as a jsonb map for when we measure per
    // retriever. retrieve_total_ms is the scalar aggregate that replaces
    // the old "stuff the total into retriever_ms.fts" anti-pattern.
    retriever_breakdown: presented.diagnostics.retriever_ms,
    retrieve_total_ms: presented.diagnostics.retrieve_total_ms,
    result_count: presented.sections.reduce((sum, s) => sum + s.total, 0),
    result_type_counts: presented.diagnostics.result_type_counts,
    top_matches_types: presented.topMatches.map((c) => c.type),
    zero_result: presented.sections.length === 0,
    total_ms: presented.diagnostics.total_ms,
  };
}

/**
 * Fire-and-forget logging. Called via Next 16 `after()` from the route
 * handler so it never blocks the response. Failures are swallowed —
 * observability must never break search.
 */
export async function logSearchEvent(input: BuildRowInput): Promise<void> {
  try {
    const row = buildSearchEventRow(input);
    const client = createServiceClient();
    await client.from("search_events").insert(row as never);
  } catch (err) {
    console.warn("logSearchEvent failed", err instanceof Error ? err.message : err);
  }
}

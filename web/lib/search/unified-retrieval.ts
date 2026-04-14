import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  Candidate,
  RetrieverContext,
  RetrieverId,
  EntityType,
} from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

/**
 * Per-retriever candidate sets, pre-materialized by a single call to the
 * search_unified RPC. Retrievers read from this shape (via their factory);
 * they do NOT issue their own database calls.
 *
 * The ESLint rule `local/no-retriever-rpc-calls` enforces this at CI time.
 */
export interface UnifiedRetrievalResult {
  fts: Candidate[];
  trigram: Candidate[];
  structured: Candidate[];
}

/** Row shape returned by search_unified RPC (migration 20260413000008). */
interface RawRow {
  retriever_id: string;
  entity_type: string;
  entity_id: string;
  raw_score: number;
  quality: number;
  days_out: number;
  title: string;
  venue_name: string | null;    // populated for events, NULL for venues
  neighborhood: string | null;  // populated for venues, NULL for events
  image_url: string | null;
  href_slug: string;
  starts_at: string | null;
}

function toCandidate(row: RawRow): Candidate {
  return {
    id: row.entity_id,
    type: row.entity_type as EntityType,
    source_retriever: row.retriever_id as RetrieverId,
    raw_score: row.raw_score,
    matched_fields: [], // Phase 0: populated by ranker from other signals
    payload: {
      title: row.title,
      venue_name: row.venue_name,
      neighborhood: row.neighborhood,
      image_url: row.image_url,
      href_slug: row.href_slug,
      starts_at: row.starts_at,
      quality: row.quality,
      days_out: row.days_out,
    },
  };
}

/**
 * Single-connection retrieval. Runs all retrievers (FTS, trigram) for all
 * requested entity types as CTEs inside one Postgres function call. The
 * returned tagged rows are demultiplexed into per-retriever candidate sets
 * which downstream Retriever classes consume via their `retrieve()` method.
 *
 * CRITICAL: this function is the ONE place that calls search_unified. It
 * lives outside lib/search/retrievers/ so the ESLint rule scoped to retrievers
 * doesn't apply here. Retrievers in lib/search/retrievers/ consume the result
 * but do not call the database.
 */
export async function runUnifiedRetrieval(
  q: AnnotatedQuery,
  ctx: RetrieverContext
): Promise<UnifiedRetrievalResult> {
  if (!ctx.portal_id) {
    throw new Error("runUnifiedRetrieval: portal_id is required");
  }

  const client = createServiceClient();

  // Note: database.types.ts still has the OLD search_unified signature typed.
  // Task 47 (legacy cleanup) will regenerate types. Until then, cast args
  // as `never` per project convention.
  const { data, error } = await client.rpc("search_unified", {
    p_portal_id: ctx.portal_id,
    p_query: q.normalized,
    p_types: ["event", "venue"],
    p_categories: q.structured_filters.categories ?? null,
    p_neighborhoods: q.structured_filters.neighborhoods ?? null,
    p_date_from: q.temporal?.start ?? null,
    p_date_to: q.temporal?.end ?? null,
    p_free_only: q.structured_filters.price?.free ?? false,
    p_limit_per_retriever: ctx.limit,
  } as never);

  if (error) {
    throw new Error(`search_unified failed: ${error.message}`);
  }

  const result: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
  for (const row of (data ?? []) as RawRow[]) {
    const bucket = row.retriever_id as keyof UnifiedRetrievalResult;
    if (bucket in result) {
      result[bucket].push(toCandidate(row));
    } else {
      // Unknown retriever_id — fail loudly rather than silently drop.
      throw new Error(`runUnifiedRetrieval: unknown retriever_id '${row.retriever_id}'`);
    }
  }
  return result;
}

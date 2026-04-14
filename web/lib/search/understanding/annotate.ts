import { createHash } from "node:crypto";
import { normalizeSearchQuery } from "@/lib/search/normalize";
import { tokenize } from "@/lib/search/understanding/tokenize";
import { classifyIntent } from "@/lib/search/understanding/intent";
import { linkEntities } from "@/lib/search/understanding/entities";
import type {
  AnnotatedQuery,
  PortalContext,
  Token,
  EntityAnnotation,
} from "@/lib/search/understanding/types";

/**
 * Deep freeze helper. TypeScript `readonly` is structural only — this
 * enforces runtime immutability so a future cache implementation can't
 * "just patch the fingerprint after the fact" and erode the contract.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Object.isFrozen(obj)) return obj;

  // Freeze each nested field before freezing the container
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== null && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * The ONLY public entry point for query understanding. Retrievers consume
 * the AnnotatedQuery output; they never see the raw string directly.
 *
 * CRITICAL INVARIANT: this function must NEVER mutate, strip, or substitute
 * the user's query. The `raw` and `normalized` fields preserve the user's
 * intent end-to-end. This is the architectural fix for the 1869-line
 * unified-search.ts bug where "jazz" was silently replaced with
 * category=music and an empty FTS query.
 *
 * The returned AnnotatedQuery is DEEPLY frozen — not just top-level readonly.
 * Inner arrays, Token objects, entities, intent, and structured_filters are
 * all frozen. Any attempt to mutate in strict mode throws.
 */
export async function annotate(
  raw: string,
  ctx: PortalContext
): Promise<AnnotatedQuery> {
  const normalized = normalizeSearchQuery(raw);
  const tokens = tokenize(normalized);
  const intent = classifyIntent(normalized, tokens);
  const entities = linkEntities(normalized, tokens, ctx);

  // Fingerprint is sha256(portal_slug || '\0' || normalized || '\0' || intent.type)
  // truncated to 32 hex chars. Used for cache key, observability, and stable
  // request IDs. The portal_slug is included so the same query across portals
  // produces different fingerprints — portal isolation propagates through
  // the cache layer automatically.
  const fingerprint = createHash("sha256")
    .update(ctx.portal_slug)
    .update("\0")
    .update(normalized)
    .update("\0")
    .update(intent.type)
    .digest("hex")
    .slice(0, 32);

  // Build the AnnotatedQuery object and deep-freeze it before returning.
  // The deep freeze is what enforces the "retrievers can only read" contract
  // at runtime.
  const query: AnnotatedQuery = deepFreeze({
    raw,
    normalized,
    tokens: tokens.map((t) => Object.freeze({ ...t })) as ReadonlyArray<Token>,
    entities: entities.map((e) => Object.freeze({ ...e })) as ReadonlyArray<EntityAnnotation>,
    spelling: [],
    synonyms: [],
    structured_filters: {},
    intent: { type: intent.type, confidence: intent.confidence },
    fingerprint,
  });

  return query;
}

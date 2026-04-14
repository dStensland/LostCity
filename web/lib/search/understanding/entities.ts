import type {
  EntityAnnotation,
  PortalContext,
  Token,
} from "@/lib/search/understanding/types";

/**
 * Phase 0 stub. Entity linking (category lookup, neighborhood resolution,
 * venue name matching) lands in Phase 1 when real query data shows which
 * entities to prioritize. The interface exists now so annotate() can call it.
 *
 * Pure sync function — no DB access in Phase 0.
 */
export function linkEntities(
  _raw: string,
  _tokens: Token[],
  _ctx: PortalContext
): EntityAnnotation[] {
  return [];
}

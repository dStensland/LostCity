import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Check if an entity's source is federated to the current portal.
 * Returns the canonical portal slug if the entity belongs elsewhere,
 * or null if it belongs to the current portal.
 */
export async function getCanonicalPortalRedirect(
  sourceId: number | null | undefined,
  currentPortalId: string | undefined,
): Promise<string | null> {
  if (!sourceId || !currentPortalId) return null;

  const supabase = await createClient();

  // Check if this source is accessible from the current portal
  const { data: access } = await supabase
    .from("portal_source_access")
    .select("portal_id")
    .eq("portal_id", currentPortalId)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (access) return null; // Source is federated to this portal

  // Source not federated — find the canonical portal
  const { data: sourceData } = await supabase
    .from("sources")
    .select("owner_portal_id, portal:portals!sources_owner_portal_id_fkey(slug)")
    .eq("id", sourceId)
    .maybeSingle();

  const source = sourceData as { owner_portal_id: string | null; portal: { slug: string } | null } | null;
  if (!source?.portal) return null;
  return source.portal.slug;
}

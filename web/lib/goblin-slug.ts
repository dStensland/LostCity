import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lowercase, collapse non-alphanumerics to single dashes, trim dashes.
 * Falls back to "group" for empty results so the slug column is never "".
 * Matches the Postgres backfill used in the schema migration.
 */
export function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized === "" ? "group" : normalized;
}

interface SlugRow {
  slug: string | null;
}

/**
 * Given a user and a group name, return a unique slug (suffixing with -2, -3, …
 * against that user's existing non-recommendations groups).
 */
export async function generateUniqueGroupSlug(
  serviceClient: SupabaseClient,
  userId: string,
  name: string
): Promise<string> {
  const base = slugify(name);

  const { data } = await serviceClient
    .from("goblin_lists")
    .select("slug")
    .eq("user_id", userId)
    .eq("is_recommendations", false)
    .not("slug", "is", null)
    .returns<SlugRow[]>();

  const existing = new Set(
    (data || []).map((r) => r.slug).filter((s): s is string => !!s)
  );

  if (!existing.has(base)) return base;

  let n = 2;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

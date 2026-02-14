const PORTAL_SLUG_ALIASES: Record<string, string> = {
  "atlanta-test": "atlanta",
  "atlanta-test-mood-1": "atlanta",
  "atlanta-test-mood-2": "atlanta",
  "atlanta-test-mood-3": "atlanta",
  "emory-test": "emory-demo",
};

export function normalizePortalSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function resolvePortalSlugAlias(slug: string): string {
  const normalized = normalizePortalSlug(slug);
  return PORTAL_SLUG_ALIASES[normalized] || normalized;
}

export function isPortalSlugAlias(slug: string): boolean {
  const normalized = normalizePortalSlug(slug);
  return Object.prototype.hasOwnProperty.call(PORTAL_SLUG_ALIASES, normalized);
}

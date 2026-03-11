const ENABLED_PORTAL_SLUGS = new Set(["helpatl"]);

export function isHelpAtlSupportDirectoryEnabled(portalSlug: string): boolean {
  return ENABLED_PORTAL_SLUGS.has(portalSlug);
}

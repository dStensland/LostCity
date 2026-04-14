"use client";

import { usePathname } from "next/navigation";
import { UnifiedSearchShell } from "@/components/search/UnifiedSearchShell";
import { RESERVED_PORTAL_ROUTE_SLUGS } from "@/lib/portal-runtime/types";

/**
 * Root-level search overlay mount.
 *
 * Phase 0 mounted `<UnifiedSearchShell mode="overlay">` under [portal]/layout
 * only, which meant non-portal pages (`/community`, `/happening-now`, `/`) had
 * a `LaunchButton` in their header that set `overlayOpen=true` in the store
 * with no listener — the button was a silent no-op. That was a regression
 * from the old `HeaderSearchButton` + `MobileSearchOverlay` which was
 * self-contained. Phase 0.5 migrated GlassHeader to `LaunchButton` and
 * deleted the old overlay, so we need to promote the shell to root level
 * so every surface has an overlay to open.
 *
 * Portal slug is derived from the URL pathname reactively via usePathname()
 * so it updates on client navigation (Next client router does not remount
 * components in the root layout across route changes). If the first path
 * segment is a known portal slug (anything NOT in RESERVED_PORTAL_ROUTE_SLUGS),
 * that slug wins. Otherwise we fall back to "atlanta" — the main consumer
 * portal, so users searching from `/community` land on Atlanta results,
 * which matches the old `HeaderSearchButton` → `MobileSearchOverlay` default.
 *
 * This replaces the per-portal-layout mount. `[portal]/layout.tsx` no longer
 * mounts its own shell — the root mount covers portal pages too, reading
 * the portal slug off the URL instead of the route params.
 */
export function RootSearchOverlay() {
  const pathname = usePathname();
  const portalSlug = derivePortalSlug(pathname);
  return <UnifiedSearchShell portalSlug={portalSlug} mode="overlay" />;
}

// Widen the const-array to a plain string set so `.has()` accepts
// arbitrary URL segments without fighting the literal union type.
const RESERVED_SLUGS: Set<string> = new Set(RESERVED_PORTAL_ROUTE_SLUGS);

function derivePortalSlug(pathname: string | null): string {
  if (!pathname) return "atlanta";
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) return "atlanta";
  if (RESERVED_SLUGS.has(firstSegment)) return "atlanta";
  // Anything not reserved is a portal slug (assumption baked into the
  // Next.js route tree: `/[portal]/*` catches anything that isn't a
  // reserved literal segment).
  return firstSegment;
}

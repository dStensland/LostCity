"use client";

import { usePortalTracking } from "@/lib/hooks/usePortalTracking";

export function PortalTracker({ portalSlug }: { portalSlug: string }) {
  usePortalTracking(portalSlug);
  return null;
}

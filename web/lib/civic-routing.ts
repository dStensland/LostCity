/**
 * Determines the correct detail href for an event in a civic portal.
 * Returns null if the event should use the standard detail modal.
 */
import { normalizePortalVertical } from "@/lib/portal-taxonomy";

export function getCivicEventHref(
  event: { id: number; category: string | null | undefined },
  portalSlug: string,
  vertical: string | null | undefined,
): string | null {
  if (normalizePortalVertical(vertical, "city") !== "community") return null;

  if (event.category === "government" || event.category === "community") {
    return `/${portalSlug}/meetings/${event.id}`;
  }
  if (event.category === "volunteer") {
    return `/${portalSlug}/volunteer/${event.id}`;
  }
  return null;
}

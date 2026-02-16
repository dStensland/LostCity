import type { Portal } from "@/lib/portal-context";

export function isForthVariantPortal(portal: Portal): boolean {
  const variant = typeof portal.settings?.experience_variant === "string"
    ? portal.settings.experience_variant.toLowerCase()
    : "";

  return portal.slug === "forth" || variant === "forth" || variant === "forth_signature" || variant === "concierge";
}

import { toAbsoluteUrl } from "@/lib/site-url";

export function buildBreadcrumbSchema(
  items: { name: string; href?: string }[]
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.href ? { item: toAbsoluteUrl(item.href) } : {}),
    })),
  };
}

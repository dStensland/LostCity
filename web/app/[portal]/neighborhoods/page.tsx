import { permanentRedirect } from "next/navigation";

/**
 * `/[portal]/neighborhoods` → `/[portal]/explore?lane=neighborhoods`
 *
 * Neighborhoods is a proper lane inside the Explore shell. This route exists
 * for backward compatibility with external links + bookmarks from the
 * pre-refactor state; detail pages at `/[portal]/neighborhoods/[slug]` stay
 * standalone (matching how Places lane → /spots/[slug] and Events lane →
 * /events/[id] handle deep drilldown).
 *
 * `force-dynamic` ensures the redirect fires at the HTTP layer (308) rather
 * than as a client-side meta refresh (which would flash a blank document).
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ portal: string }>;
};

export default async function NeighborhoodsIndexRedirect({ params }: Props) {
  const { portal } = await params;
  permanentRedirect(`/${portal}/explore?lane=neighborhoods`);
}

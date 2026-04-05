import { notFound } from "next/navigation";
import { ExhibitionFeed } from "@/components/arts/ExhibitionFeed";
import { ArtsSecondaryNav } from "@/components/arts/ArtsSecondaryNav";
import type { Metadata } from "next";
import type { ExhibitionWithVenue } from "@/lib/exhibitions-utils";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/exhibitions`,
  });
  const activePortalSlug = request?.portal.slug || portalSlug;
  const portalName = request?.portal.name || "Lost City: Arts";

  return {
    title: `Exhibitions | ${portalName}`,
    description:
      "Currently showing across Atlanta's galleries and museums. Solo shows, group exhibitions, installations, and more.",
    alternates: {
      canonical: `/${activePortalSlug}/exhibitions`,
    },
    openGraph: {
      title: `Exhibitions | ${portalName}`,
      description:
        "Currently showing across Atlanta's galleries and museums.",
    },
  };
}

async function fetchExhibitions(
  portalSlug: string
): Promise<{ exhibitions: ExhibitionWithVenue[]; total: number }> {
  // Construct absolute URL for server-side fetch
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const url = `${baseUrl}/api/exhibitions?portal=${encodeURIComponent(portalSlug)}&showing=current&limit=100`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { exhibitions: [], total: 0 };
    const json = await res.json();
    return {
      exhibitions: (json.exhibitions ?? []) as ExhibitionWithVenue[],
      total: json.total ?? 0,
    };
  } catch {
    return { exhibitions: [], total: 0 };
  }
}

export default async function ExhibitionsPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/exhibitions`,
  });
  const portal = request?.portal ?? null;

  if (!portal) {
    notFound();
  }

  const { exhibitions, total } = await fetchExhibitions(portalSlug);

  return (
    <div className="min-h-screen">
      <ArtsSecondaryNav portalSlug={portalSlug} />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-16">
        {/* Page header — Underground Gallery style */}
        <header className="mb-8">
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--action-primary)] uppercase tracking-[0.16em] mb-3">
            {"// exhibitions"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] leading-tight mb-2">
            What&rsquo;s Showing
          </h1>
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[var(--muted)]">
            Currently showing across Atlanta&rsquo;s galleries and museums.
          </p>
        </header>

        {/* Divider */}
        <div className="border-t border-[var(--twilight)] mb-6" />

        {/* Interactive feed — owns filter state */}
        <ExhibitionFeed
          initialExhibitions={exhibitions}
          portalSlug={portalSlug}
          totalFromApi={total}
        />
      </main>
    </div>
  );
}

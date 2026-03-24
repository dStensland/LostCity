import { notFound } from "next/navigation";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getOpenCalls } from "@/lib/open-calls";
import { OpenCallsBoard } from "@/components/arts/OpenCallsBoard";
import { ArtsSecondaryNav } from "@/components/arts/ArtsSecondaryNav";
import type { Metadata } from "next";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  const portalName = portal?.name || "Lost City: Arts";

  return {
    title: `Open Calls | ${portalName}`,
    description:
      "Open calls, residencies, grants, and commissions for Atlanta artists. Curated and updated daily.",
    alternates: {
      canonical: `/${portalSlug}/open-calls`,
    },
    openGraph: {
      title: `Open Calls | ${portalName}`,
      description:
        "Open calls, residencies, grants, and commissions for Atlanta artists.",
    },
  };
}

export default async function OpenCallsPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!portal) {
    notFound();
  }

  const { open_calls: openCalls, total } = await getOpenCalls(portalSlug, {
    status: "open",
    limit: 100,
  });

  return (
    <div className="min-h-screen">
      <ArtsSecondaryNav portalSlug={portalSlug} />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-16">
        {/* Page header — Underground Gallery style */}
        <header className="mb-8">
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--action-primary)] uppercase tracking-[0.16em] mb-3">
            {"// open calls"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] leading-tight mb-2">
            Opportunities for Artists
          </h1>
          <p className="text-sm text-[var(--soft)]">
            {total > 0
              ? `${total} open call${total !== 1 ? "s" : ""} — submissions, residencies, grants, and commissions`
              : "Submissions, residencies, grants, and commissions for Atlanta artists"}
          </p>
        </header>

        {/* Divider */}
        <div className="border-t border-[var(--twilight)] mb-6" />

        {/* Interactive board — owns filter state */}
        <OpenCallsBoard
          initialCalls={openCalls}
          portalSlug={portalSlug}
        />
      </main>
    </div>
  );
}

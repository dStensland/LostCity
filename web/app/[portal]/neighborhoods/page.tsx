import { Metadata } from "next";
import Link from "next/link";
import {
  type Neighborhood,
} from "@/config/neighborhoods";
import { buildNeighborhoodIndexSections } from "@/lib/neighborhood-index";
import { supabase } from "@/lib/supabase";
import { toAbsoluteUrl } from "@/lib/site-url";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal } = await params;
  return {
    title: "Neighborhoods — Atlanta Events & Places | Lost City",
    description:
      "Explore Atlanta neighborhoods and find events, places, and things to do across the city.",
    alternates: {
      canonical: toAbsoluteUrl(`/${portal}/neighborhoods`),
    },
  };
}

async function getVenueCountsByNeighborhood(): Promise<Record<string, number>> {
  // Fetch all venue neighborhoods in one query
  const { data, error } = await supabase
    .from("places")
    .select("neighborhood")
    .eq("is_active", true)
    .not("neighborhood", "is", null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data as { neighborhood: string | null }[]) {
    if (row.neighborhood) {
      counts[row.neighborhood] = (counts[row.neighborhood] || 0) + 1;
    }
  }
  return counts;
}

function NeighborhoodIndexCard({
  neighborhood,
  count,
  portalSlug,
}: {
  neighborhood: Neighborhood;
  count: number;
  portalSlug: string;
}) {
  return (
    <Link
      href={`/${portalSlug}/neighborhoods/${neighborhood.id}`}
      className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 transition-all hover:bg-[var(--dusk)]/60 hover:border-[var(--muted)]"
    >
      <div className="font-mono text-xs font-medium text-[var(--cream)] truncate">
        {neighborhood.name}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="font-mono text-2xs text-[var(--soft)]">
          {count} {count === 1 ? "place" : "places"}
        </span>
      </div>
    </Link>
  );
}

export default async function NeighborhoodsIndexPage({ params }: Props) {
  const { portal } = await params;
  const counts = await getVenueCountsByNeighborhood();
  const sections = buildNeighborhoodIndexSections(counts);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <section className="py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)]">
          Neighborhoods
        </h1>
        <p className="text-sm text-[var(--soft)] mt-2 max-w-xl">
          Explore events and places across Atlanta&apos;s neighborhoods.
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="mb-8">
          <div className="flex items-center gap-3 py-3 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
              {section.title}
            </h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-2xs font-mono bg-[var(--twilight)] text-[var(--soft)]">
              {section.neighborhoods.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {section.neighborhoods.map(({ neighborhood, count }) => (
              <NeighborhoodIndexCard
                key={neighborhood.id}
                neighborhood={neighborhood}
                count={count}
                portalSlug={portal}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

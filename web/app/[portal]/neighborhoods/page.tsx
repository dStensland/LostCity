import { Metadata } from "next";
import Link from "next/link";
import {
  getNeighborhoodsByTier,
  type Neighborhood,
} from "@/config/neighborhoods";
import { supabase } from "@/lib/supabase";
import { toAbsoluteUrl } from "@/lib/site-url";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal } = await params;
  return {
    title: "Neighborhoods — Atlanta Events & Spots | Lost City",
    description:
      "Explore Atlanta neighborhoods — find events, spots, and things to do across the city's most vibrant areas.",
    alternates: {
      canonical: toAbsoluteUrl(`/${portal}/neighborhoods`),
    },
  };
}

async function getVenueCountsByNeighborhood(): Promise<Record<string, number>> {
  // Fetch all venue neighborhoods in one query
  const { data, error } = await supabase
    .from("venues")
    .select("neighborhood")
    .eq("active", true)
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
  const hasVenues = count > 0;
  return (
    <Link
      href={`/${portalSlug}/neighborhoods/${neighborhood.id}`}
      className={`block p-3 rounded-lg border transition-all ${
        hasVenues
          ? "border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 hover:border-[var(--muted)]"
          : "border-[var(--twilight)]/50 bg-[var(--dusk)]/10 opacity-60 hover:opacity-80"
      }`}
    >
      <div className="font-mono text-xs font-medium text-[var(--cream)] truncate">
        {neighborhood.name}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {count > 0 ? (
          <span className="font-mono text-[0.6rem] text-[var(--soft)]">
            {count} {count === 1 ? "spot" : "spots"}
          </span>
        ) : (
          <span className="font-mono text-[0.55rem] text-[var(--muted)]">
            No spots yet
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function NeighborhoodsIndexPage({ params }: Props) {
  const { portal } = await params;
  const counts = await getVenueCountsByNeighborhood();

  const tier1 = getNeighborhoodsByTier(1);
  const tier2ITP = getNeighborhoodsByTier(2);
  const tier3ITP = getNeighborhoodsByTier(3);

  // Sort each group by venue count descending, then alphabetically
  const sortByCount = (a: Neighborhood, b: Neighborhood) => {
    const ca = counts[a.name] || 0;
    const cb = counts[b.name] || 0;
    if (cb !== ca) return cb - ca;
    return a.name.localeCompare(b.name);
  };

  tier1.sort(sortByCount);
  tier2ITP.sort(sortByCount);
  tier3ITP.sort(sortByCount);

  const sections = [
    { title: "Active Neighborhoods", neighborhoods: tier1 },
    { title: "Neighborhoods", neighborhoods: tier2ITP },
    { title: "Emerging Areas", neighborhoods: tier3ITP },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <section className="py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)]">
          Neighborhoods
        </h1>
        <p className="text-sm text-[var(--soft)] mt-2 max-w-xl">
          Explore events and spots across Atlanta&apos;s neighborhoods and metro areas.
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="mb-8">
          <div className="flex items-center gap-3 py-3 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--muted)]">
              {section.title}
            </h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[0.6rem] font-mono bg-[var(--twilight)] text-[var(--soft)]">
              {section.neighborhoods.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {section.neighborhoods.map((n) => (
              <NeighborhoodIndexCard
                key={n.id}
                neighborhood={n}
                count={counts[n.name] || 0}
                portalSlug={portal}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import GlassHeader from "@/components/GlassHeader";
import MainNav from "@/components/MainNav";
import PageFooter from "@/components/PageFooter";
import CommunityContent from "./CommunityContent";

export const revalidate = 300; // 5 minutes for the page

export type Producer = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  featured: boolean;
  event_count?: number;
};

// Cache event counts separately - they change more frequently
const getEventCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const today = new Date().toISOString().split("T")[0];

    // Efficient query: only fetch producer_id, let DB do the heavy lifting
    const { data: events } = await supabase
      .from("events")
      .select("producer_id")
      .gte("start_date", today)
      .not("producer_id", "is", null);

    const counts: Record<string, number> = {};
    for (const event of (events || []) as { producer_id: string }[]) {
      counts[event.producer_id] = (counts[event.producer_id] || 0) + 1;
    }
    return counts;
  },
  ["producer-event-counts"],
  { revalidate: 300, tags: ["producer-counts"] } // 5 minute cache
);

// Cache producer data - changes less frequently
const getProducersData = unstable_cache(
  async (): Promise<Producer[]> => {
    const { data: producers, error } = await supabase
      .from("event_producers")
      .select("id, name, slug, org_type, website, instagram, logo_url, description, categories, neighborhood, featured")
      .eq("hidden", false)
      .order("featured", { ascending: false })
      .order("name");

    if (error || !producers) {
      console.error("Error fetching producers:", error);
      return [];
    }

    return producers as Producer[];
  },
  ["producers-list"],
  { revalidate: 600, tags: ["producers"] } // 10 minute cache
);

async function getProducersWithCounts(): Promise<Producer[]> {
  // Fetch both in parallel
  const [producers, counts] = await Promise.all([
    getProducersData(),
    getEventCounts(),
  ]);

  // Merge counts
  const producersWithCounts = producers.map((p) => ({
    ...p,
    event_count: counts[p.id] || 0,
  }));

  // Sort: featured first, then by event count, then by name
  producersWithCounts.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if ((b.event_count || 0) !== (a.event_count || 0)) {
      return (b.event_count || 0) - (a.event_count || 0);
    }
    return a.name.localeCompare(b.name);
  });

  return producersWithCounts;
}

type Props = {
  searchParams: Promise<{
    type?: string;
    search?: string;
  }>;
};

export default async function CommunityPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedType = params.type || "all";
  const searchQuery = params.search || "";

  const producers = await getProducersWithCounts();

  // Filter by type and search
  let filteredProducers = producers;

  if (selectedType && selectedType !== "all") {
    filteredProducers = filteredProducers.filter((p) => p.org_type === selectedType);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredProducers = filteredProducers.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.categories?.some((c) => c.toLowerCase().includes(query))
    );
  }

  return (
    <div className="min-h-screen">
      <GlassHeader />

      <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
        <MainNav />
      </Suspense>

      <Suspense fallback={<div className="h-12 bg-[var(--night)]" />}>
        <CommunityContent
          producers={filteredProducers}
          selectedType={selectedType}
          searchQuery={searchQuery}
        />
      </Suspense>

      <PageFooter />
    </div>
  );
}

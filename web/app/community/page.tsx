import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import GlassHeader from "@/components/GlassHeader";
import MainNav from "@/components/MainNav";
import PageFooter from "@/components/PageFooter";
import CommunityContent from "./CommunityContent";
import { getLocalDateString } from "@/lib/formats";

export const metadata: Metadata = {
  title: "Community | Lost City",
  description: "Discover event organizers, arts nonprofits, and community groups in Atlanta.",
};

export const revalidate = 300; // 5 minutes for the page

export type Organization = {
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
    const today = getLocalDateString();

    // Efficient query: only fetch organization_id, let DB do the heavy lifting
    const { data: events } = await supabase
      .from("events")
      .select("organization_id")
      .gte("start_date", today)
      .not("organization_id", "is", null)
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    const counts: Record<string, number> = {};
    for (const event of (events || []) as { organization_id: string }[]) {
      counts[event.organization_id] = (counts[event.organization_id] || 0) + 1;
    }
    return counts;
  },
  ["organization-event-counts"],
  { revalidate: 300, tags: ["organization-counts"] } // 5 minute cache
);

// Cache organization data - changes less frequently
const getOrganizationsData = unstable_cache(
  async (): Promise<Organization[]> => {
    const { data: organizations, error } = await supabase
      .from("organizations")
      .select("id, name, slug, org_type, website, instagram, logo_url, description, categories, neighborhood, featured")
      .eq("hidden", false)
      .order("featured", { ascending: false })
      .order("name");

    if (error || !organizations) {
      console.error("Error fetching organizations:", error);
      return [];
    }

    return organizations as Organization[];
  },
  ["organizations-list"],
  { revalidate: 600, tags: ["organizations"] } // 10 minute cache
);

async function getOrganizationsWithCounts(): Promise<Organization[]> {
  // Fetch both in parallel
  const [organizations, counts] = await Promise.all([
    getOrganizationsData(),
    getEventCounts(),
  ]);

  // Merge counts
  const organizationsWithCounts = organizations.map((p) => ({
    ...p,
    event_count: counts[p.id] || 0,
  }));

  // Sort: featured first, then by event count, then by name
  organizationsWithCounts.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if ((b.event_count || 0) !== (a.event_count || 0)) {
      return (b.event_count || 0) - (a.event_count || 0);
    }
    return a.name.localeCompare(b.name);
  });

  return organizationsWithCounts;
}

type Props = {
  searchParams: Promise<{
    type?: string;
    category?: string;
    search?: string;
  }>;
};

export default async function CommunityPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedType = params.type || "all";
  const selectedCategories = params.category?.split(",").filter(Boolean) || [];
  const searchQuery = params.search || "";

  const organizations = await getOrganizationsWithCounts();

  // Filter by type, category, and search
  let filteredOrganizations = organizations;

  if (selectedType && selectedType !== "all") {
    filteredOrganizations = filteredOrganizations.filter((p) => p.org_type === selectedType);
  }

  // Filter by event categories (organizations who create events in these categories)
  if (selectedCategories.length > 0) {
    filteredOrganizations = filteredOrganizations.filter((p) =>
      p.categories?.some((cat) => selectedCategories.includes(cat))
    );
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredOrganizations = filteredOrganizations.filter(
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
          organizations={filteredOrganizations}
          selectedType={selectedType}
          selectedCategories={selectedCategories}
          searchQuery={searchQuery}
        />
      </Suspense>

      <PageFooter />
    </div>
  );
}

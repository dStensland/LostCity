import { supabase } from "@/lib/supabase";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/search";
import { SPOT_TYPES, VIBES, NEIGHBORHOODS } from "@/lib/spots";
import { ITP_NEIGHBORHOODS } from "@/config/neighborhoods";
import { PLACE_CATEGORIES } from "@/config/categories";

// Prevent static generation - page fetches from database
export const dynamic = "force-dynamic";

type Source = {
  name: string;
  slug: string;
  source_type: string;
  url: string;
  is_active: boolean;
};

type Venue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  venue_type: string | null;
  venue_types: string[] | null;
  vibes: string[] | null;
  active: boolean;
};

type DbCategory = {
  id: string;
  name: string;
  display_order: number;
};

async function getData() {
  // Fetch sources
  const { data: sources } = await supabase
    .from("sources")
    .select("name, slug, source_type, url, is_active")
    .order("name");

  // Fetch venues/spots with counts
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, slug, neighborhood, venue_type, venue_types, vibes, active")
    .eq("active", true)
    .order("name");

  // Fetch categories from DB
  const { data: dbCategories } = await supabase
    .from("categories")
    .select("id, name, display_order")
    .order("display_order");

  return {
    sources: sources as Source[] | null,
    venues: venues as Venue[] | null,
    dbCategories: dbCategories as DbCategory[] | null,
  };
}

export default async function DataPage() {
  const { sources, venues, dbCategories } = await getData();

  const data = {
    _meta: {
      description: "Lost City - Configuration Data",
      updated: new Date().toISOString(),
      note: "This page is for internal reference only",
    },
    eventSources: sources?.map((s) => ({
      name: s.name,
      slug: s.slug,
      type: s.source_type,
      url: s.url,
      active: s.is_active,
    })),
    eventCategories: {
      main: CATEGORIES.map((c) => ({ id: c.value, label: c.label })),
      subcategories: SUBCATEGORIES,
      fromDatabase: dbCategories,
    },
    spotTypes: Object.entries(SPOT_TYPES).map(([id, info]) => ({
      id,
      label: info.label,
      icon: info.icon,
    })),
    vibes: VIBES.map((v) => ({ id: v.value, label: v.label })),
    neighborhoods: {
      current: NEIGHBORHOODS,
      expanded: ITP_NEIGHBORHOODS.map((n) => ({
        id: n.id,
        name: n.name,
        lat: n.lat,
        lng: n.lng,
        radius: n.radius,
        tier: n.tier,
      })),
    },
    placeCategories: PLACE_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      googleTypes: c.googleTypes,
      refreshDays: c.refreshDays,
    })),
    venues: venues?.map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      neighborhood: v.neighborhood,
      types: v.venue_types || (v.venue_type ? [v.venue_type] : []),
      vibes: v.vibes || [],
    })),
    stats: {
      totalSources: sources?.length || 0,
      activeSources: sources?.filter((s) => s.is_active).length || 0,
      totalVenues: venues?.length || 0,
      totalNeighborhoods: ITP_NEIGHBORHOODS.length,
      totalEventCategories: CATEGORIES.length,
      totalSpotTypes: Object.keys(SPOT_TYPES).length,
      totalVibes: VIBES.length,
    },
  };

  return (
    <div className="min-h-screen bg-[var(--night)] p-8">
      <pre className="text-[var(--cream)] text-xs font-mono whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

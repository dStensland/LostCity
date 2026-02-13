import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

type SourceRow = {
  id: number;
  slug: string;
  name: string;
  is_active: boolean | null;
  source_type: string | null;
};

type SectionSeed = {
  title: string;
  slug: string;
  description: string;
  section_type: "auto";
  auto_filter: Record<string, unknown>;
  is_visible: boolean;
  display_order: number;
};

const ACTIVATE_ON_SUCCESS = process.argv.includes("--activate");
const DRY_RUN = process.argv.includes("--dry-run");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PORTAL_CONFIG = {
  slug: "atlanta-film",
  name: "Atlanta Film",
  tagline: "Film groups, indie screenings, repertory nights, and what is showing now in Atlanta",
  portal_type: "event",
  visibility: "public",
  plan: "professional",
  filters: {
    city: "Atlanta",
    categories: ["film", "art", "theater", "learning", "community"],
    exclude_categories: ["sports"],
  },
  branding: {
    visual_preset: "cosmic_dark",
    theme_mode: "dark",
    primary_color: "#f59e0b",
    secondary_color: "#f97316",
    accent_color: "#fb7185",
    background_color: "#05070b",
    text_color: "#f8fafc",
    muted_color: "#94a3b8",
    button_color: "#f59e0b",
    button_text_color: "#111827",
    border_color: "#1f2937",
    card_color: "#0f172a",
    font_heading: "Space Grotesk",
    font_body: "Manrope",
    header: {
      template: "immersive",
      logo_position: "left",
      logo_size: "md",
      nav_style: "underline",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "noise_texture",
      intensity: "subtle",
      colors: {
        primary: "#f59e0b",
        secondary: "#f97316",
      },
      animation_speed: "slow",
    },
    component_style: {
      border_radius: "md",
      shadows: "medium",
      card_style: "elevated",
      button_style: "default",
      glow_enabled: false,
      glow_intensity: "subtle",
      animations: "subtle",
      glass_enabled: false,
    },
    category_colors: {
      film: "#f59e0b",
      art: "#fb7185",
      theater: "#a78bfa",
      learning: "#22d3ee",
      community: "#4ade80",
    },
  },
  settings: {
    vertical: "film",
    show_categories: true,
    show_map: false,
    default_view: "list",
    icon_glow: false,
    feed: {
      feed_type: "sections",
      default_layout: "list",
      items_per_section: 10,
      show_activity_tab: false,
    },
    nav_labels: {
      feed: "Screenings",
      events: "Calendar",
      spots: "Cinemas",
    },
    meta_description: "Atlanta Film highlights movie showtimes, indie cinema, film festivals, and film community events across the city.",
  },
};

const SOURCE_PACKS = {
  cinemas: [
    "landmark-midtown",
    "plaza-theatre",
    "tara-theatre",
    "springs-cinema",
    "studio-movie-grill-atlanta",
    "cinemark-atlanta",
    "ncg-cinemas-atlanta",
    "silverspot-cinema-atlanta",
  ],
  indie: [
    "landmark-midtown",
    "plaza-theatre",
    "tara-theatre",
    "springs-cinema",
  ],
  festivals: [
    "atlanta-film-festival",
    "atlanta-film-series",
    "atlanta-film-society",
    "out-on-film",
  ],
  community: [
    "atlanta-film-society",
    "atlanta-film-series",
    "wewatchstuff",
    "scad-fash",
    "scad-atlanta",
    "artsatl-calendar",
  ],
} as const;

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

async function getAtlantaPortalId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("portals")
    .select("id,name")
    .eq("slug", "atlanta")
    .maybeSingle();

  if (error) {
    console.error("Failed to lookup parent portal (atlanta):", error.message);
    return null;
  }

  if (!data) {
    console.warn("Atlanta parent portal not found. Proceeding without parent_portal_id.");
    return null;
  }

  console.log(`Parent portal: ${data.name} (${data.id})`);
  return data.id;
}

async function resolveFilmSources(): Promise<Map<string, SourceRow>> {
  const requestedSlugs = unique(Object.values(SOURCE_PACKS).flat());
  const { data, error } = await supabase
    .from("sources")
    .select("id,slug,name,is_active,source_type")
    .in("slug", requestedSlugs)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed resolving film sources: ${error.message}`);
  }

  const activeSources = (data || []) as SourceRow[];
  const sourceMap = new Map<string, SourceRow>();
  for (const source of activeSources) {
    sourceMap.set(source.slug, source);
  }

  const missingOrInactive = requestedSlugs.filter((slug) => !sourceMap.has(slug));
  if (missingOrInactive.length > 0) {
    console.warn(`Skipping unavailable/inactive sources: ${missingOrInactive.join(", ")}`);
  }

  console.log(`Resolved ${sourceMap.size} active film sources.`);
  return sourceMap;
}

function idsForPack(
  sourceMap: Map<string, SourceRow>,
  packName: keyof typeof SOURCE_PACKS
): number[] {
  return unique(
    SOURCE_PACKS[packName]
      .map((slug) => sourceMap.get(slug)?.id)
      .filter((id): id is number => typeof id === "number")
  );
}

function buildSections(sourceMap: Map<string, SourceRow>): SectionSeed[] {
  const cinemaSourceIds = idsForPack(sourceMap, "cinemas");
  const indieSourceIds = idsForPack(sourceMap, "indie");
  const festivalSourceIds = idsForPack(sourceMap, "festivals");
  const communitySourceIds = idsForPack(sourceMap, "community");

  return [
    {
      title: "Now Showing",
      slug: "now-showing",
      description: "What is playing in Atlanta cinemas this week",
      section_type: "auto",
      auto_filter: {
        categories: ["film"],
        source_ids: cinemaSourceIds,
        date_filter: "next_7_days",
        sort_by: "date",
      },
      is_visible: true,
      display_order: 1,
    },
    {
      title: "Indie + Repertory",
      slug: "indie-repertory",
      description: "Independent, arthouse, and classic film programming",
      section_type: "auto",
      auto_filter: {
        categories: ["film"],
        source_ids: indieSourceIds,
        tags: ["indie", "arthouse", "classic", "screening", "repertory"],
        date_filter: "next_30_days",
        sort_by: "date",
      },
      is_visible: true,
      display_order: 2,
    },
    {
      title: "Festivals + Series",
      slug: "festivals-series",
      description: "Film festivals, ongoing series, and special programs",
      section_type: "auto",
      auto_filter: {
        categories: ["film", "community"],
        source_ids: festivalSourceIds,
        date_filter: "next_30_days",
        sort_by: "date",
      },
      is_visible: true,
      display_order: 3,
    },
    {
      title: "Film Community",
      slug: "film-community",
      description: "Film groups, talks, workshops, and creator meetups",
      section_type: "auto",
      auto_filter: {
        categories: ["film", "learning", "community", "art"],
        source_ids: communitySourceIds,
        date_filter: "next_30_days",
        sort_by: "date",
      },
      is_visible: true,
      display_order: 4,
    },
    {
      title: "Screen Adjacent",
      slug: "screen-adjacent",
      description: "Soundtrack performances, art events, and related culture",
      section_type: "auto",
      auto_filter: {
        categories: ["film", "art", "theater", "music"],
        exclude_categories: ["sports"],
        date_filter: "next_30_days",
        sort_by: "date",
      },
      is_visible: true,
      display_order: 5,
    },
  ];
}

async function createOrUpdatePortal(parentPortalId: string | null): Promise<string> {
  const { data: existingPortal, error: existingError } = await supabase
    .from("portals")
    .select("id,status")
    .eq("slug", PORTAL_CONFIG.slug)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed checking existing portal: ${existingError.message}`);
  }

  const basePayload = {
    ...PORTAL_CONFIG,
    ...(ACTIVATE_ON_SUCCESS ? { status: "active" as const } : {}),
  };

  const writeAttempts = [
    { ...basePayload, parent_portal_id: parentPortalId, plan: PORTAL_CONFIG.plan, owner_type: "user" },
    { ...basePayload, parent_portal_id: parentPortalId, plan: PORTAL_CONFIG.plan },
    { ...basePayload, parent_portal_id: parentPortalId },
    { ...basePayload },
  ];

  if (existingPortal) {
    console.log(`Portal exists (${existingPortal.id}). Updating configuration...`);

    for (const attempt of writeAttempts) {
      const { error } = await supabase
        .from("portals")
        .update({
          ...attempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPortal.id);

      if (!error) {
        return existingPortal.id;
      }

      if (!error.message?.includes("column")) {
        throw new Error(`Failed to update portal: ${error.message}`);
      }
    }

    throw new Error("Failed to update portal after fallback attempts.");
  }

  console.log("Creating Atlanta Film portal...");

  for (const attempt of writeAttempts) {
    const { data, error } = await supabase
      .from("portals")
      .insert({
        ...attempt,
        status: ACTIVATE_ON_SUCCESS ? "active" : "draft",
      })
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      return data.id;
    }

    if (error && !error.message?.includes("column")) {
      throw new Error(`Failed to create portal: ${error.message}`);
    }
  }

  throw new Error("Failed to create portal after fallback attempts.");
}

async function upsertSections(portalId: string, sections: SectionSeed[]): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("portal_sections")
    .select("id,slug")
    .eq("portal_id", portalId);

  if (fetchError) {
    throw new Error(`Failed to fetch existing sections: ${fetchError.message}`);
  }

  const existingBySlug = new Map(
    ((existing || []) as { id: string; slug: string }[]).map((row) => [row.slug, row.id])
  );

  for (const section of sections) {
    const existingId = existingBySlug.get(section.slug);

    if (existingId) {
      const { error } = await supabase
        .from("portal_sections")
        .update({
          title: section.title,
          description: section.description,
          section_type: section.section_type,
          auto_filter: section.auto_filter,
          is_visible: section.is_visible,
          display_order: section.display_order,
        })
        .eq("id", existingId);

      if (error) {
        throw new Error(`Failed to update section ${section.slug}: ${error.message}`);
      }

      console.log(`Updated section: ${section.title}`);
    } else {
      const { error } = await supabase.from("portal_sections").insert({
        portal_id: portalId,
        title: section.title,
        slug: section.slug,
        description: section.description,
        section_type: section.section_type,
        auto_filter: section.auto_filter,
        is_visible: section.is_visible,
        display_order: section.display_order,
      });

      if (error) {
        throw new Error(`Failed to create section ${section.slug}: ${error.message}`);
      }

      console.log(`Created section: ${section.title}`);
    }
  }
}

async function upsertSourceSubscriptions(portalId: string, sourceIds: number[]): Promise<void> {
  if (sourceIds.length === 0) {
    console.warn("No active film sources found. Skipping source subscriptions.");
    return;
  }

  const { data: existingSubs, error: existingError } = await supabase
    .from("source_subscriptions")
    .select("id,source_id,is_active")
    .eq("subscriber_portal_id", portalId)
    .in("source_id", sourceIds);

  if (existingError) {
    throw new Error(`Failed to fetch source subscriptions: ${existingError.message}`);
  }

  const existingBySourceId = new Map(
    ((existingSubs || []) as { id: string; source_id: number; is_active: boolean | null }[])
      .map((row) => [row.source_id, row])
  );

  const toInsert = sourceIds
    .filter((sourceId) => !existingBySourceId.has(sourceId))
    .map((source_id) => ({
      subscriber_portal_id: portalId,
      source_id,
      subscription_scope: "all",
      is_active: true,
    }));

  const toReactivate = sourceIds
    .filter((sourceId) => {
      const sub = existingBySourceId.get(sourceId);
      return !!sub && !sub.is_active;
    });

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("source_subscriptions")
      .insert(toInsert);

    if (error) {
      throw new Error(`Failed to insert source subscriptions: ${error.message}`);
    }
  }

  for (const sourceId of toReactivate) {
    const sub = existingBySourceId.get(sourceId);
    if (!sub) continue;

    const { error } = await supabase
      .from("source_subscriptions")
      .update({
        is_active: true,
        subscription_scope: "all",
      })
      .eq("id", sub.id);

    if (error) {
      throw new Error(`Failed to reactivate subscription for source ${sourceId}: ${error.message}`);
    }
  }

  console.log(`Source subscriptions: ${toInsert.length} added, ${toReactivate.length} reactivated`);
}

async function refreshSourceAccessView(): Promise<void> {
  const { error } = await supabase.rpc("refresh_portal_source_access");
  if (error) {
    console.warn(`Could not refresh portal_source_access automatically: ${error.message}`);
    return;
  }
  console.log("Refreshed portal_source_access.");
}

async function verify(portalId: string): Promise<void> {
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id,slug,name,status,portal_type,parent_portal_id,settings,filters")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError || !portal) {
    throw new Error(`Verification failed: portal not found (${portalError?.message || "unknown error"})`);
  }

  const { data: sections, error: sectionsError } = await supabase
    .from("portal_sections")
    .select("title,slug,display_order")
    .eq("portal_id", portalId)
    .order("display_order", { ascending: true });

  if (sectionsError) {
    throw new Error(`Verification failed: section lookup failed (${sectionsError.message})`);
  }

  const { data: subscriptions } = await supabase
    .from("source_subscriptions")
    .select("source_id")
    .eq("subscriber_portal_id", portalId)
    .eq("is_active", true);

  const { data: sourceAccess } = await supabase
    .from("portal_source_access")
    .select("source_id")
    .eq("portal_id", portalId);

  console.log("\n=== Verification ===");
  console.log(`Portal: ${portal.name} (/${portal.slug})`);
  console.log(`Status: ${portal.status}`);
  console.log(`Type: ${portal.portal_type}`);
  console.log(`Parent Portal ID: ${portal.parent_portal_id || "none"}`);
  console.log(`Vertical: ${(portal.settings as Record<string, unknown>)?.vertical || "unset"}`);
  console.log(`Section count: ${sections?.length || 0}`);
  console.log(`Active subscriptions: ${subscriptions?.length || 0}`);
  console.log(`Accessible sources: ${sourceAccess?.length || 0}`);
  console.log("Sections:");
  for (const section of (sections || []) as { title: string; slug: string }[]) {
    console.log(`  - ${section.title} (${section.slug})`);
  }
}

async function main(): Promise<void> {
  console.log("\n=== Atlanta Film Portal Setup ===");
  console.log(`Mode: ${DRY_RUN ? "dry-run" : "write"}${ACTIVATE_ON_SUCCESS ? " + activate" : " (draft)"}`);

  const parentPortalId = await getAtlantaPortalId();
  const sourceMap = await resolveFilmSources();
  const sections = buildSections(sourceMap);
  const allSourceIds = unique(Array.from(sourceMap.values()).map((source) => source.id));

  if (DRY_RUN) {
    console.log("\nDry run summary:");
    console.log(`  Portal slug: ${PORTAL_CONFIG.slug}`);
    console.log(`  Sections to upsert: ${sections.length}`);
    console.log(`  Source subscriptions to target: ${allSourceIds.length}`);
    return;
  }

  const portalId = await createOrUpdatePortal(parentPortalId);
  await upsertSections(portalId, sections);
  await upsertSourceSubscriptions(portalId, allSourceIds);
  await refreshSourceAccessView();
  await verify(portalId);

  console.log("\nSetup complete.");
  if (!ACTIVATE_ON_SUCCESS) {
    console.log("Portal is in draft mode. Re-run with --activate when you want to publish.");
  }
}

main().catch((error) => {
  console.error("\nSetup failed:");
  console.error(error);
  process.exit(1);
});

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Marietta Portal Creation Script
 *
 * Creates a city portal for Marietta, GA (historic downtown city in metro Atlanta).
 * Run with: npx tsx scripts/create-marietta-portal.ts
 *
 * Portal: Discover Marietta (slug: marietta)
 * Type: city
 * Plan: starter
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Marietta neighborhoods based on the city's actual geography
const MARIETTA_NEIGHBORHOODS = [
  "Marietta Square",
  "Downtown Marietta",
  "East Cobb",
  "Polk",
  "Whitlock",
  "Fort Hill",
  "North Landing",
  "Eastern Marietta",
  "Indian Hills",
  "Chimney Springs",
  "Windsor Oaks",
  "Somerset",
  "Brookstone",
  "Powers Park",
];

// Portal configuration
const PORTAL_CONFIG = {
  slug: "marietta",
  name: "Discover Marietta",
  tagline: "Events & happenings in historic Marietta",
  portal_type: "city",
  visibility: "public",
  plan: "starter",
  filters: {
    city: "Marietta",
    neighborhoods: MARIETTA_NEIGHBORHOODS,
  },
  branding: {
    visual_preset: "corporate_clean",
    theme_mode: "light",
    primary_color: "#2563eb", // Historic blue
    secondary_color: "#7c3aed", // Regal purple
    accent_color: "#dc2626", // Brick red (historic buildings)
    background_color: "#f8fafc", // Clean light gray
    text_color: "#1e293b",
    muted_color: "#64748b",
    button_color: "#2563eb",
    button_text_color: "#ffffff",
    border_color: "#e2e8f0",
    card_color: "#ffffff",
    font_heading: "Inter",
    font_body: "Inter",
    header: {
      template: "standard",
      logo_position: "left",
      logo_size: "md",
      nav_style: "tabs",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "subtle_glow",
      intensity: "subtle",
      colors: {
        primary: "#dbeafe",
        secondary: "#ede9fe",
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
  },
  settings: {
    exclude_adult: false,
    icon_glow: false,
    show_categories: true,
    show_map: true,
    default_view: "list",
    meta_description: "Discover events, activities, and entertainment in historic Marietta, GA. From the Marietta Square to East Cobb, find what's happening in your neighborhood.",
    nav_labels: {
      feed: "Feed",
      events: "Events",
      spots: "Places",
    },
  },
};

// Feed sections to create
const SECTIONS = [
  {
    title: "This Week in Marietta",
    slug: "this-week",
    description: "What's happening this week in Marietta",
    section_type: "auto",
    auto_filter: {
      days_ahead: 7,
    },
    is_visible: true,
  },
  {
    title: "Around the Square",
    slug: "marietta-square",
    description: "Events in historic Marietta Square",
    section_type: "auto",
    auto_filter: {
      neighborhoods: ["Marietta Square", "Downtown Marietta"],
    },
    is_visible: true,
  },
  {
    title: "Arts & Culture",
    slug: "arts-culture",
    description: "Art, theater, and cultural events",
    section_type: "auto",
    auto_filter: {
      categories: ["art", "theater", "music"],
    },
    is_visible: true,
  },
  {
    title: "Family Events",
    slug: "family",
    description: "Family-friendly activities",
    section_type: "auto",
    auto_filter: {
      categories: ["family", "community"],
    },
    is_visible: true,
  },
  {
    title: "Food & Drink",
    slug: "food-drink",
    description: "Dining and nightlife events",
    section_type: "auto",
    auto_filter: {
      categories: ["food_drink", "nightlife"],
    },
    is_visible: true,
  },
];

async function getAtlantaPortalId(): Promise<string | null> {
  console.log("Looking up Atlanta portal ID...");

  const { data, error } = await supabase
    .from("portals")
    .select("id, slug, name")
    .eq("slug", "atlanta")
    .maybeSingle();

  if (error) {
    console.error("Error looking up Atlanta portal:", error);
    return null;
  }

  if (!data) {
    console.log("Atlanta portal not found");
    return null;
  }

  console.log(`Found Atlanta portal: ${data.name} (${data.id})`);
  return data.id;
}

async function createPortal(parentPortalId: string | null): Promise<string | null> {
  console.log("\nCreating Marietta portal...");

  // Check if portal already exists
  const { data: existing } = await supabase
    .from("portals")
    .select("id, status")
    .eq("slug", PORTAL_CONFIG.slug)
    .maybeSingle();

  if (existing) {
    console.log(`Portal already exists with ID: ${existing.id}, status: ${existing.status}`);
    return existing.id;
  }

  // Build portal data - only include parent_portal_id and plan if they exist in schema
  const fullPortalData = {
    ...PORTAL_CONFIG,
    parent_portal_id: parentPortalId,
    status: "draft" as const,
    owner_type: null,
  };

  let data = null;
  let error = null;

  // Try with full schema first (includes parent_portal_id and plan)
  const result = await supabase
    .from("portals")
    .insert(fullPortalData)
    .select()
    .maybeSingle();

  data = result.data;
  error = result.error;

  // If parent_portal_id column doesn't exist, retry without it
  if (error && error.message?.includes("parent_portal_id")) {
    console.log("  Note: parent_portal_id column not found, creating without parent link");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { parent_portal_id: _unused1, ...portalWithoutParent } = fullPortalData;
    const retryResult = await supabase
      .from("portals")
      .insert(portalWithoutParent)
      .select()
      .maybeSingle();

    data = retryResult.data;
    error = retryResult.error;

    // If plan column doesn't exist either, retry without it
    if (error && error.message?.includes("plan")) {
      console.log("  Note: plan column not found, creating without plan");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { plan: _unused2, ...portalWithoutPlan } = portalWithoutParent;
      const finalResult = await supabase
        .from("portals")
        .insert(portalWithoutPlan)
        .select()
        .maybeSingle();

      data = finalResult.data;
      error = finalResult.error;
    }
  }

  if (error) {
    console.error("Error creating portal:", error);
    return null;
  }

  console.log(`Created portal: ${data.name} (${data.id})`);
  return data.id;
}

async function createSections(portalId: string): Promise<void> {
  console.log("\nCreating feed sections...");

  // Check for existing sections
  const { data: existingSections } = await supabase
    .from("portal_sections")
    .select("slug")
    .eq("portal_id", portalId);

  const existingSlugs = new Set((existingSections || []).map((s: { slug: string }) => s.slug));

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];

    if (existingSlugs.has(section.slug)) {
      console.log(`  Section "${section.title}" already exists, skipping`);
      continue;
    }

    const { error } = await supabase.from("portal_sections").insert({
      portal_id: portalId,
      ...section,
      display_order: i + 1,
    });

    if (error) {
      console.error(`  Error creating section "${section.title}":`, error);
    } else {
      console.log(`  Created section: ${section.title}`);
    }
  }
}

async function activatePortal(portalId: string): Promise<void> {
  console.log("\nActivating portal...");

  const { error } = await supabase
    .from("portals")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", portalId);

  if (error) {
    console.error("Error activating portal:", error);
  } else {
    console.log("Portal activated successfully");
  }
}

async function updateAtlantaPortal(): Promise<void> {
  console.log("\nUpdating Atlanta portal to include Marietta neighborhoods...");

  // Get current Atlanta portal
  const { data: atlantaPortal, error: fetchError } = await supabase
    .from("portals")
    .select("id, filters")
    .eq("slug", "atlanta")
    .maybeSingle();

  if (fetchError || !atlantaPortal) {
    console.error("Could not fetch Atlanta portal:", fetchError);
    return;
  }

  // Get current neighborhoods or initialize empty array
  const currentFilters = atlantaPortal.filters as { neighborhoods?: string[] };
  const currentNeighborhoods = currentFilters.neighborhoods || [];

  // Add Marietta neighborhoods to Atlanta (avoiding duplicates)
  const mariettaNeighborhoodsToAdd = MARIETTA_NEIGHBORHOODS.filter(
    (n) => !currentNeighborhoods.includes(n)
  );

  if (mariettaNeighborhoodsToAdd.length === 0) {
    console.log("  Atlanta portal already includes all Marietta neighborhoods");
    return;
  }

  const updatedNeighborhoods = [...currentNeighborhoods, ...mariettaNeighborhoodsToAdd];

  const { error: updateError } = await supabase
    .from("portals")
    .update({
      filters: {
        ...currentFilters,
        neighborhoods: updatedNeighborhoods,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", atlantaPortal.id);

  if (updateError) {
    console.error("Error updating Atlanta portal:", updateError);
  } else {
    console.log(`  Added ${mariettaNeighborhoodsToAdd.length} Marietta neighborhoods to Atlanta portal`);
    console.log(`  Total neighborhoods in Atlanta portal: ${updatedNeighborhoods.length}`);
  }
}

async function verifyPortal(portalId: string): Promise<void> {
  console.log("\n=== Portal Verification ===");

  // Get portal details
  const { data: portal } = await supabase
    .from("portals")
    .select("*")
    .eq("id", portalId)
    .maybeSingle();

  if (!portal) {
    console.error("Portal not found for verification");
    return;
  }

  console.log("\nPortal Details:");
  console.log(`  Name: ${portal.name}`);
  console.log(`  Slug: ${portal.slug}`);
  console.log(`  Type: ${portal.portal_type}`);
  console.log(`  Plan: ${portal.plan || "N/A"}`);
  console.log(`  Status: ${portal.status}`);
  console.log(`  Parent Portal ID: ${portal.parent_portal_id || "none"}`);

  console.log("\nBranding:");
  const branding = portal.branding as Record<string, string>;
  console.log(`  Theme: ${branding.theme_mode}`);
  console.log(`  Primary Color: ${branding.primary_color}`);
  console.log(`  Accent Color: ${branding.accent_color}`);
  console.log(`  Visual Preset: ${branding.visual_preset || "none"}`);

  console.log("\nFilters:");
  const filters = portal.filters as Record<string, unknown>;
  console.log(`  City: ${filters.city}`);
  console.log(`  Neighborhoods: ${(filters.neighborhoods as string[])?.length || 0} neighborhoods`);

  // Get sections
  const { data: sections } = await supabase
    .from("portal_sections")
    .select("title, slug, section_type")
    .eq("portal_id", portalId)
    .order("display_order");

  console.log("\nSections:");
  (sections || []).forEach((s: { title: string; slug: string; section_type: string }) => {
    console.log(`  - ${s.title} (${s.slug}) [${s.section_type}]`);
  });

  console.log(`\n✅ Portal is ready at: /${portal.slug}`);
}

async function main() {
  console.log("\n=== Marietta Portal Setup ===\n");

  try {
    // Step 1: Get Atlanta portal ID for parent relationship
    const atlantaPortalId = await getAtlantaPortalId();

    if (!atlantaPortalId) {
      console.warn("Warning: Atlanta portal not found. Creating portal without parent.");
    }

    // Step 2: Create the Marietta portal
    const portalId = await createPortal(atlantaPortalId);

    if (!portalId) {
      throw new Error("Failed to create portal");
    }

    // Step 3: Create feed sections
    await createSections(portalId);

    // Step 4: Activate the portal
    await activatePortal(portalId);

    // Step 5: Update Atlanta portal to include Marietta neighborhoods
    await updateAtlantaPortal();

    // Step 6: Verify the setup
    await verifyPortal(portalId);

    console.log("\n=== Setup Complete ===\n");
    console.log("Next steps:");
    console.log("  1. Visit /marietta to see the portal");
    console.log("  2. Marietta events will now appear in both /marietta and /atlanta");
    console.log("  3. Add branding assets (logo, hero image) via admin panel");
  } catch (error) {
    console.error("\n=== Setup Failed ===");
    console.error(error);
    process.exit(1);
  }
}

main();

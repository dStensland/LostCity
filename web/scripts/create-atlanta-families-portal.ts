import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Atlanta Families Portal Creation Script
 *
 * Creates a family-focused B2B portal demonstrating the white-label system.
 * Run with: npx tsx scripts/create-atlanta-families-portal.ts
 *
 * Portal: Atlanta Families (slug: atlanta-families)
 * Type: business
 * Plan: professional
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Portal configuration
const PORTAL_CONFIG = {
  slug: "atlanta-families",
  name: "Atlanta Families",
  tagline: "Family-friendly fun in the ATL",
  portal_type: "business",
  visibility: "public",
  plan: "professional",
  filters: {
    city: "Atlanta",
    categories: [
      "family",
      "community",
      "art",
      "theater",
      "food_drink",
      "learning",
      "outdoors",
      "markets",
      "wellness",
    ],
    exclude_categories: ["nightlife", "gaming"],
  },
  branding: {
    visual_preset: "family_friendly",
    theme_mode: "light",
    primary_color: "#059669",
    secondary_color: "#0891b2",
    accent_color: "#f59e0b",
    background_color: "#fefce8",
    text_color: "#1c1917",
    muted_color: "#78716c",
    button_color: "#059669",
    button_text_color: "#ffffff",
    border_color: "#fde68a",
    card_color: "#fffbeb",
    font_heading: "Nunito",
    font_body: "Inter",
    header: {
      template: "branded",
      logo_position: "center",
      logo_size: "lg",
      nav_style: "pills",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "gradient_wave",
      intensity: "subtle",
      colors: {
        primary: "#fde68a",
        secondary: "#bbf7d0",
      },
      animation_speed: "slow",
    },
    component_style: {
      border_radius: "lg",
      shadows: "medium",
      card_style: "elevated",
      button_style: "pill",
      glow_enabled: false,
      glow_intensity: "subtle",
      animations: "subtle",
      glass_enabled: false,
    },
    category_colors: {
      family: "#059669",
      community: "#0891b2",
      art: "#d97706",
      theater: "#a855f7",
      food_drink: "#ea580c",
      learning: "#2563eb",
      outdoors: "#16a34a",
    },
  },
  settings: {
    exclude_adult: true,
    icon_glow: false,
    show_categories: true,
    nav_labels: {
      feed: "Family Fun",
      events: "Activities",
      spots: "Places",
    },
  },
};

// Feed sections to create
const SECTIONS = [
  {
    title: "This Weekend",
    slug: "this-weekend",
    description: "Family-friendly events happening this weekend",
    section_type: "auto",
    auto_filter: {
      categories: ["family", "community"],
      days_ahead: 3,
    },
    is_visible: true,
  },
  {
    title: "Free & Affordable",
    slug: "free-affordable",
    description: "Budget-friendly family activities",
    section_type: "auto",
    auto_filter: {
      price_max: 25,
      include_free: true,
    },
    is_visible: true,
  },
  {
    title: "Outdoor Adventures",
    slug: "outdoor-adventures",
    description: "Get outside with the family",
    section_type: "auto",
    auto_filter: {
      categories: ["outdoors"],
    },
    is_visible: true,
  },
  {
    title: "Learning & Educational",
    slug: "learning-educational",
    description: "Educational events for curious minds",
    section_type: "auto",
    auto_filter: {
      categories: ["learning"],
    },
    is_visible: true,
  },
  {
    title: "Arts & Culture",
    slug: "arts-culture",
    description: "Art, theater, and cultural experiences",
    section_type: "auto",
    auto_filter: {
      categories: ["art", "theater"],
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
  console.log("\nCreating Atlanta Families portal...");

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
  // First try with all columns
  const fullPortalData = {
    ...PORTAL_CONFIG,
    parent_portal_id: parentPortalId,
    status: "draft" as const,
    owner_type: "user" as const,
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
  console.log(`  Plan: ${portal.plan}`);
  console.log(`  Status: ${portal.status}`);
  console.log(`  Parent Portal ID: ${portal.parent_portal_id || "none"}`);

  console.log("\nBranding:");
  const branding = portal.branding as Record<string, string>;
  console.log(`  Theme: ${branding.theme_mode}`);
  console.log(`  Primary Color: ${branding.primary_color}`);
  console.log(`  Accent Color: ${branding.accent_color}`);
  console.log(`  Heading Font: ${branding.font_heading}`);
  console.log(`  Body Font: ${branding.font_body}`);

  console.log("\nSettings:");
  const settings = portal.settings as Record<string, unknown>;
  console.log(`  Exclude Adult: ${settings.exclude_adult}`);
  console.log(`  Icon Glow: ${settings.icon_glow}`);
  console.log(`  Nav Labels: ${JSON.stringify(settings.nav_labels)}`);

  console.log("\nFilters:");
  const filters = portal.filters as Record<string, unknown>;
  console.log(`  City: ${filters.city}`);
  console.log(`  Categories: ${JSON.stringify(filters.categories)}`);
  console.log(`  Excluded: ${JSON.stringify(filters.exclude_categories)}`);

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
  console.log("\n=== Atlanta Families Portal Setup ===\n");

  try {
    // Step 1: Get Atlanta portal ID for parent relationship
    const atlantaPortalId = await getAtlantaPortalId();

    if (!atlantaPortalId) {
      console.warn("Warning: Atlanta portal not found. Creating portal without parent.");
    }

    // Step 2: Create the portal
    const portalId = await createPortal(atlantaPortalId);

    if (!portalId) {
      throw new Error("Failed to create portal");
    }

    // Step 3: Create feed sections
    await createSections(portalId);

    // Step 4: Activate the portal
    await activatePortal(portalId);

    // Step 5: Verify the setup
    await verifyPortal(portalId);

    console.log("\n=== Setup Complete ===\n");
  } catch (error) {
    console.error("\n=== Setup Failed ===");
    console.error(error);
    process.exit(1);
  }
}

main();

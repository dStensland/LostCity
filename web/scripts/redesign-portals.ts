import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

/**
 * Redesign both Atlanta and Nashville portals with unique visual identities
 * using the new hybrid portal design system.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// ATLANTA - "Cosmic Peach" - Modern, vibrant, diverse
// ============================================================================
const ATLANTA_BRANDING = {
  visual_preset: "cosmic_dark",
  theme_mode: "dark",
  // Warm peach/coral as primary - reflects Georgia peach heritage
  primary_color: "#FF6B7A",
  // Electric teal as secondary - modern, tech-forward ATL
  secondary_color: "#00D4E8",
  // Gold accent - prosperity, southern warmth
  accent_color: "#FFD93D",
  // Deep cosmic backgrounds
  background_color: "#0A0A12",
  text_color: "#FFF5F0",
  muted_color: "#8B8B9A",
  button_color: "#FF6B7A",
  button_text_color: "#0A0A12",
  border_color: "#2A2A3A",
  card_color: "#14141E",
  font_heading: "Space Grotesk",
  font_body: "Inter",
  header: {
    template: "modern",
    logo_position: "left",
    logo_size: "md",
    nav_style: "underline",
    show_search_in_header: true,
    transparent_on_top: true,
  },
  ambient: {
    effect: "aurora",
    intensity: "medium",
    colors: {
      primary: "#FF6B7A",
      secondary: "#00D4E8",
    },
    animation_speed: "slow",
  },
  component_style: {
    border_radius: "md",
    shadows: "glow",
    card_style: "glass",
    button_style: "solid",
    glow_enabled: true,
    glow_intensity: "medium",
    animations: "smooth",
    glass_enabled: true,
  },
  category_colors: {
    music: "#FF6B7A",
    film: "#A855F7",
    comedy: "#FFD93D",
    theater: "#EC4899",
    art: "#00D4E8",
    community: "#10B981",
    food_drink: "#F97316",
    sports: "#EF4444",
    fitness: "#22C55E",
    nightlife: "#8B5CF6",
    family: "#06B6D4",
  },
};

const ATLANTA_SETTINGS = {
  feed_config: {
    layout: "vertical",
    card_variant: "standard",
    sections: ["featured", "for_you", "trending"],
    hero_style: "carousel",
    show_filters: true,
    group_by: "none",
  },
};

// ============================================================================
// NASHVILLE - "Neon Honky-Tonk" - Music City, Broadway at night
// ============================================================================
const NASHVILLE_BRANDING = {
  visual_preset: "neon_honkytonk",
  theme_mode: "dark",
  // Hot pink neon - like Tootsie's Orchid Lounge signs
  primary_color: "#FF1B8D",
  // Electric blue - Broadway neon tubes
  secondary_color: "#00E5FF",
  // Whiskey amber - warm stage lights, bourbon
  accent_color: "#FF9500",
  // Deep midnight navy - night sky over Broadway
  background_color: "#0A0E1A",
  // Warm cream - vintage signage warmth
  text_color: "#FFF8E7",
  muted_color: "#9CA3AF",
  button_color: "#FF1B8D",
  button_text_color: "#0A0E1A",
  // Neon glow border
  border_color: "#1E293B",
  card_color: "#0F172A",
  font_heading: "Space Grotesk",
  font_body: "Inter",
  header: {
    template: "modern",
    logo_position: "center",
    logo_size: "lg",
    nav_style: "pills",
    show_search_in_header: true,
    transparent_on_top: true,
  },
  ambient: {
    effect: "aurora",
    intensity: "high",
    colors: {
      primary: "#FF1B8D",
      secondary: "#00E5FF",
    },
    animation_speed: "medium",
  },
  component_style: {
    border_radius: "lg",
    shadows: "glow",
    card_style: "glass",
    button_style: "pill",
    glow_enabled: true,
    glow_intensity: "high",
    animations: "smooth",
    glass_enabled: true,
  },
  category_colors: {
    music: "#FF1B8D",
    film: "#A855F7",
    comedy: "#FF9500",
    theater: "#EC4899",
    art: "#00E5FF",
    community: "#10B981",
    food_drink: "#FF9500",
    sports: "#EF4444",
    fitness: "#22C55E",
    nightlife: "#8B5CF6",
    family: "#06B6D4",
  },
};

const NASHVILLE_SETTINGS = {
  feed_config: {
    layout: "horizontal",
    card_variant: "hero",
    sections: ["featured", "trending", "by_category"],
    hero_style: "carousel",
    show_filters: true,
    group_by: "category",
  },
};

async function updatePortal(
  slug: string,
  branding: Record<string, unknown>,
  settings: Record<string, unknown>
) {
  console.log(`\n🎨 Updating ${slug} portal...`);

  // Find the portal
  const { data: portal, error: findError } = await supabase
    .from("portals")
    .select("id, slug, name, branding, settings")
    .eq("slug", slug)
    .maybeSingle();

  if (findError) {
    console.error(`  ❌ Error finding portal:`, findError);
    return false;
  }

  if (!portal) {
    console.error(`  ❌ Portal not found: ${slug}`);
    return false;
  }

  console.log(`  📍 Found: ${portal.name} (${portal.id})`);

  // Merge settings to preserve any existing non-feed_config settings
  const mergedSettings = {
    ...(portal.settings || {}),
    ...settings,
  };

  // Update the portal
  const { error: updateError } = await supabase
    .from("portals")
    .update({
      branding,
      settings: mergedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portal.id);

  if (updateError) {
    console.error(`  ❌ Error updating portal:`, updateError);
    return false;
  }

  console.log(`  ✅ Updated successfully!`);
  console.log(`  🎨 Primary: ${branding.primary_color}`);
  console.log(`  🌊 Secondary: ${branding.secondary_color}`);
  console.log(`  ⚡ Accent: ${branding.accent_color}`);
  const feedConfig = settings.feed_config as { layout?: string } | undefined;
  console.log(`  📐 Layout: ${feedConfig?.layout || "default"}`);
  return true;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║       PORTAL REDESIGN - Hybrid Design System               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  let success = 0;
  let failed = 0;

  // Update Atlanta
  if (await updatePortal("atlanta", ATLANTA_BRANDING, ATLANTA_SETTINGS)) {
    success++;
  } else {
    failed++;
  }

  // Update Nashville
  if (await updatePortal("nashville", NASHVILLE_BRANDING, NASHVILLE_SETTINGS)) {
    success++;
  } else {
    failed++;
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`✅ Success: ${success} portal(s)`);
  console.log(`❌ Failed: ${failed} portal(s)`);
  console.log("════════════════════════════════════════════════════════════");

  if (success > 0) {
    console.log("\n🌟 View the redesigned portals:");
    console.log("   • Atlanta: http://localhost:3000/atlanta");
    console.log("   • Nashville: http://localhost:3000/nashville");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();

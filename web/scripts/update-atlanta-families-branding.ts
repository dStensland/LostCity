import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

/**
 * Update Atlanta Families portal with full visual preset configuration
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Full visual preset configuration for family_friendly
const FULL_BRANDING = {
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
};

async function updatePortalBranding() {
  console.log("\n=== Updating Atlanta Families Portal Branding ===\n");

  // Find the portal
  const { data: portal, error: findError } = await supabase
    .from("portals")
    .select("id, slug, name, branding")
    .eq("slug", "atlanta-families")
    .maybeSingle();

  if (findError) {
    console.error("Error finding portal:", findError);
    process.exit(1);
  }

  if (!portal) {
    console.error("Portal not found: atlanta-families");
    process.exit(1);
  }

  console.log(`Found portal: ${portal.name} (${portal.id})`);
  console.log("\nCurrent branding:");
  console.log(JSON.stringify(portal.branding, null, 2));

  // Update the branding
  const { data: updated, error: updateError } = await supabase
    .from("portals")
    .update({
      branding: FULL_BRANDING,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portal.id)
    .select()
    .maybeSingle();

  if (updateError) {
    console.error("\nError updating portal:", updateError);
    process.exit(1);
  }

  console.log("\n✅ Branding updated successfully!");
  console.log("\nNew branding configuration:");
  console.log(JSON.stringify(updated.branding, null, 2));

  console.log("\n=== Update Complete ===");
  console.log(`\nView the portal at: /atlanta-families`);
  console.log("\nKey changes:");
  console.log("  - Visual preset: family_friendly");
  console.log("  - Theme mode: light");
  console.log("  - Colors: Warm yellows, greens, and blues");
  console.log("  - Header: Branded template with centered logo");
  console.log("  - Ambient: Gradient wave effect");
  console.log("  - Components: Large rounded corners, pill buttons");
  console.log("  - Category colors: Custom palette for 7 categories");
}

updatePortalBranding();

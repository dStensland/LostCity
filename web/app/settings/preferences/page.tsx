import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import PreferencesClient from "./PreferencesClient";

export const metadata: Metadata = {
  title: "Preferences | Lost City",
  description: "Set your favorite categories, neighborhoods, vibes, and price preferences on Lost City.",
};

type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"] & {
  favorite_genres?: Record<string, string[]> | null;
  needs_accessibility?: string[] | null;
  needs_dietary?: string[] | null;
  needs_family?: string[] | null;
  cross_portal_recommendations?: boolean | null;
};

type Props = {
  searchParams: Promise<{ welcome?: string }>;
};

export default async function PreferencesPage({ searchParams }: Props) {
  const { welcome } = await searchParams;
  const isWelcome = welcome === "true";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/settings/preferences");
  }

  const { data: prefsData } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const prefs = prefsData as UserPreferences | null;

  // Get count of user preferences to show they have a taste profile
  const { count: preferencesCount } = await supabase
    .from("inferred_preferences")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Show active portals (simplified - just show available portals as examples)
  // In a real implementation, you might track which portals the user has visited
  const portalActivity: { portalSlug: string; portalName: string; viewCount: number }[] = [];

  // If user has preferences, show example portals to demonstrate cross-portal reach
  if (!isWelcome && (preferencesCount ?? 0) > 0) {
    const { data: examplePortals } = await supabase
      .from("portals")
      .select("slug, name")
      .eq("is_active", true)
      .in("portal_type", ["city", "neighborhood"])
      .limit(4);

    if (examplePortals) {
      type PortalRow = { slug: string; name: string };
      portalActivity.push(
        ...(examplePortals as PortalRow[]).map(p => ({
          portalSlug: p.slug,
          portalName: p.name,
          viewCount: 0, // We don't track individual views per user
        }))
      );
    }
  }

  return (
    <PreferencesClient
      isWelcome={isWelcome}
      initialPreferences={{
        categories: prefs?.favorite_categories || [],
        neighborhoods: prefs?.favorite_neighborhoods || [],
        vibes: prefs?.favorite_vibes || [],
        pricePreference: prefs?.price_preference || "any",
        genres: (prefs?.favorite_genres as Record<string, string[]>) || {},
        needsAccessibility: prefs?.needs_accessibility || [],
        needsDietary: prefs?.needs_dietary || [],
        needsFamily: prefs?.needs_family || [],
        crossPortalRecommendations: prefs?.cross_portal_recommendations ?? true,
      }}
      portalActivity={portalActivity}
    />
  );
}

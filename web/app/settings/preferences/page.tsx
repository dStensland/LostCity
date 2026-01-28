import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import PreferencesClient from "./PreferencesClient";

type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];

type Props = {
  searchParams: Promise<{ welcome?: string }>;
};

export default async function PreferencesPage({ searchParams }: Props) {
  const { welcome } = await searchParams;
  const isWelcome = welcome === "true";

  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/settings/preferences");
  }

  // Load existing preferences
  const { data: prefsData } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const prefs = prefsData as UserPreferences | null;

  return (
    <PreferencesClient
      userId={user.id}
      isWelcome={isWelcome}
      initialPreferences={{
        categories: prefs?.favorite_categories || [],
        neighborhoods: prefs?.favorite_neighborhoods || [],
        vibes: prefs?.favorite_vibes || [],
        pricePreference: prefs?.price_preference || "any",
      }}
    />
  );
}

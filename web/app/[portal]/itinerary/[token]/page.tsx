import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import SharedItineraryView from "./SharedItineraryView";

type Props = {
  params: Promise<{ portal: string; token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();

  const { data: itinerary } = await supabase
    .from("itineraries")
    .select("title, description")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  const itin = itinerary as { title: string; description: string | null } | null;

  return {
    title: itin?.title || "Shared Itinerary",
    description: itin?.description || "Check out this itinerary on LostCity",
  };
}

export default async function SharedItineraryPage({ params }: Props) {
  const { portal: portalSlug, token } = await params;
  const supabase = await createClient();

  // Fetch itinerary
  const { data: itinerary } = await supabase
    .from("itineraries")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (!itinerary) notFound();

  const itineraryData = itinerary as {
    id: string;
    title: string;
    date: string | null;
    description: string | null;
    portal_id: string;
  };

  // Fetch items with joins
  const { data: items } = await supabase
    .from("itinerary_items")
    .select(
      `
      *,
      event:events(id, title, start_date, start_time, image_url, category, lat, lng, venue_name:venues(name)),
      venue:venues(id, slug, name, image_url, neighborhood, venue_type, lat, lng)
    `
    )
    .eq("itinerary_id", itineraryData.id)
    .order("position", { ascending: true });

  // Fetch portal for branding
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug, name, branding")
    .eq("id", itineraryData.portal_id)
    .maybeSingle();

  const portalData = portal as {
    id: string;
    slug: string;
    name: string;
    branding: Record<string, unknown>;
  } | null;

  return (
    <SharedItineraryView
      itinerary={{ ...itineraryData, items: items || [] }}
      portalName={portalData?.name || portalSlug}
      portalSlug={portalSlug}
    />
  );
}

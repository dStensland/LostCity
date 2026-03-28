import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Metadata } from "next";
import SharedItineraryView from "./SharedItineraryView";

type Props = {
  params: Promise<{ portal: string; token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  // Use service client — the share token IS the authorization
  const serviceClient = createServiceClient();

  const { data: itinerary } = await serviceClient
    .from("itineraries")
    .select("title, description")
    .eq("share_token", token)
    .in("visibility", ["public", "invitees"])
    .maybeSingle();

  const itin = itinerary as { title: string; description: string | null } | null;

  return {
    title: itin?.title || "Shared Plan",
    description: itin?.description || "Check out this plan on LostCity",
  };
}

export default async function SharedItineraryPage({ params }: Props) {
  const { portal: portalSlug, token } = await params;
  // Use service client for share-token-based access (token IS the auth)
  // Keep user client for profile/portal lookups that are public reads
  const serviceClient = createServiceClient();
  const supabase = await createClient();

  // Fetch itinerary — accept public or invitees visibility
  const { data: itinerary } = await serviceClient
    .from("itineraries")
    .select("*")
    .eq("share_token", token)
    .in("visibility", ["public", "invitees"])
    .maybeSingle();

  if (!itinerary) notFound();

  const itineraryData = itinerary as {
    id: string;
    title: string;
    date: string | null;
    description: string | null;
    portal_id: string;
    visibility: string;
    user_id: string;
  };

  // Fetch items with joins (service client bypasses RLS — token is the auth)
  const { data: rawItems } = await serviceClient
    .from("itinerary_items")
    .select(
      `
      *,
      event:events(id, title, start_date, start_time, image_url, category:category_id, venue:places(name, lat, lng)),
      venue:places(id, slug, name, image_url, neighborhood, place_type, lat, lng)
    `
    )
    .eq("itinerary_id", itineraryData.id)
    .order("position", { ascending: true });

  // Flatten event.venue for frontend compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (rawItems || []).map((item: any) => {
    if (item.event?.venue) {
      const { venue: eventVenue, ...eventRest } = item.event;
      return {
        ...item,
        event: {
          ...eventRest,
          lat: eventVenue.lat,
          lng: eventVenue.lng,
          venue_name: eventVenue.name,
        },
      };
    }
    return item;
  });

  // Fetch crew data (reuse service client)
  const { data: crew } = await serviceClient.rpc("get_itinerary_crew", {
    p_itinerary_id: itineraryData.id,
  } as never);

  // Fetch owner profile
  const { data: owner } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url")
    .eq("id", itineraryData.user_id)
    .maybeSingle();

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

  const ownerData = owner as {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;

  return (
    <SharedItineraryView
      itinerary={{
        ...itineraryData,
        items: items || [],
        crew: crew || undefined,
      }}
      owner={ownerData}
      portalName={portalData?.name || portalSlug}
      portalSlug={portalSlug}
    />
  );
}

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import SharedPlanView from "./SharedPlanView";

type Props = {
  params: Promise<{ portal: string; token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, portal: portalSlug } = await params;
  const serviceClient = createServiceClient();

  const { data: plan } = await serviceClient
    .from("plans")
    .select(`
      title, description, plan_date,
      creator:profiles!plans_creator_id_fkey(display_name, username),
      items:plan_items(
        venue:places(name, image_url)
      )
    `)
    .eq("share_token", token)
    .eq("status", "active")
    .maybeSingle();

  if (!plan) {
    return { title: "Plan Not Found" };
  }

  const planData = plan as {
    title: string;
    description: string | null;
    plan_date: string;
    creator: { display_name: string | null; username: string } | null;
    items: { venue: { name: string; image_url: string | null } | null }[];
  };

  const creatorName = planData.creator?.display_name || planData.creator?.username || "Someone";
  const date = new Date(planData.plan_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Get first venue image for OG
  const firstVenueImage = planData.items
    ?.find((i) => i.venue?.image_url)?.venue?.image_url;

  const venueNames = planData.items
    ?.filter((i) => i.venue?.name)
    .map((i) => i.venue!.name)
    .slice(0, 3);

  const stopsSummary = venueNames && venueNames.length > 0
    ? venueNames.join(", ")
    : null;

  const description = planData.description
    || (stopsSummary ? `${creatorName}'s plan for ${date}: ${stopsSummary}` : `${creatorName} has a plan for ${date} on Lost City`);

  return {
    title: `${planData.title} — Lost City`,
    description,
    openGraph: {
      title: planData.title,
      description,
      type: "website",
      url: `/${portalSlug}/plans/share/${token}`,
      ...(firstVenueImage ? { images: [{ url: firstVenueImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: firstVenueImage ? "summary_large_image" : "summary",
      title: planData.title,
      description,
    },
  };
}

export default async function SharedPlanPage({ params }: Props) {
  const { portal: portalSlug, token } = await params;
  const serviceClient = createServiceClient();
  const supabase = await createClient();

  // Fetch plan by share_token
  const { data: plan } = await serviceClient
    .from("plans")
    .select(`
      id, title, description, plan_date, plan_time, status, visibility, created_at,
      creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
      items:plan_items(
        id, title, sort_order, event_id, venue_id, note, start_time,
        event:events(id, title, start_date, start_time, image_url),
        venue:places(id, name, slug, image_url, neighborhood)
      ),
      participants:plan_participants(
        id, status,
        user:profiles!plan_participants_user_id_fkey(id, username, display_name, avatar_url)
      )
    `)
    .eq("share_token", token)
    .eq("status", "active")
    .single();

  if (!plan) notFound();

  // Fetch portal for branding
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug, name")
    .eq("slug", portalSlug)
    .maybeSingle();

  const portalName = (portal as { name: string } | null)?.name || portalSlug;

  return (
    <SharedPlanView
      plan={plan as never}
      portalSlug={portalSlug}
      portalName={portalName}
    />
  );
}

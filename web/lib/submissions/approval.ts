import type { createServiceClient } from "@/lib/supabase/service";
import type {
  EventSubmissionData,
  VenueSubmissionData,
  ProducerSubmissionData,
} from "@/lib/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

type SourceCandidateInput = {
  name: string;
  website: string | null | undefined;
  sourceType: "venue" | "organization";
  portalId?: string | null;
};

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export async function queueCrawlerSourceEvaluationFromSubmission(
  supabase: ServiceClient,
  input: SourceCandidateInput
): Promise<void> {
  const normalizedUrl = normalizeWebsite(input.website);
  if (!normalizedUrl) return;

  const baseSlug = slugifyName(input.name) || slugifyName(extractHost(normalizedUrl)) || "submission-source";
  let slug = baseSlug;

  const { data: existingByUrl } = await supabase
    .from("sources")
    .select("id, slug, health_tags")
    .eq("url", normalizedUrl)
    .maybeSingle();

  const existingUrlRow = existingByUrl as { id: number; slug: string; health_tags?: string[] | null } | null;
  if (existingUrlRow) {
    const tags = new Set(existingUrlRow.health_tags || []);
    tags.add("needs-crawler-evaluation");
    tags.add("from-user-submission");
    await supabase
      .from("sources")
      .update({ health_tags: Array.from(tags) } as never)
      .eq("id", existingUrlRow.id);
    return;
  }

  const host = extractHost(normalizedUrl);
  if (host) {
    const { data: maybeHostMatch } = await supabase
      .from("sources")
      .select("id, slug")
      .ilike("url", `%${host}%`)
      .limit(1)
      .maybeSingle();
    const hostRow = maybeHostMatch as { id: number; slug: string } | null;
    if (hostRow) return;
  }

  for (let i = 0; i < 20; i += 1) {
    const { data: existingSlug } = await supabase
      .from("sources")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existingSlug) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  await supabase
    .from("sources")
    .insert(
      {
        name: input.name,
        slug,
        url: normalizedUrl,
        source_type: input.sourceType,
        integration_method: null,
        crawl_frequency: "weekly",
        is_active: false,
        owner_portal_id: input.portalId || null,
        health_tags: ["needs-crawler-evaluation", "from-user-submission"],
      } as never
    );
}

export async function createEventFromSubmission(
  supabase: ServiceClient,
  data: EventSubmissionData,
  submittedBy: string,
  submissionId: string
): Promise<number> {
  const { data: sourceData } = await supabase
    .from("sources")
    .select("id")
    .eq("slug", "user-submissions")
    .maybeSingle();

  const source = sourceData as { id: number } | null;
  if (!source) {
    throw new Error("User submissions source not found");
  }

  let venueId = data.venue_id;
  if (!venueId && data.venue) {
    venueId = await createVenueFromSubmission(
      supabase,
      data.venue,
      submittedBy,
      submissionId
    );
  }

  let organizationId = data.organization_id;
  if (!organizationId && data.organization) {
    organizationId = await createOrganizationFromSubmission(
      supabase,
      data.organization,
      submittedBy,
      submissionId
    );
  }

  const { data: eventData, error } = await supabase
    .from("events")
    .insert({
      source_id: source.id,
      venue_id: venueId || null,
      organization_id: organizationId || null,
      title: data.title,
      description: data.description || null,
      start_date: data.start_date,
      start_time: data.start_time || null,
      end_date: data.end_date || null,
      end_time: data.end_time || null,
      is_all_day: data.is_all_day || false,
      category: data.category || null,
      genres: data.genres || null,
      tags: data.tags || null,
      price_min: data.price_min || null,
      price_max: data.price_max || null,
      price_note: data.price_note || null,
      is_free: data.is_free || false,
      source_url: data.source_url || `https://lostcity.io/submit/${submissionId}`,
      ticket_url: data.ticket_url || null,
      image_url: data.image_url || null,
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .maybeSingle();

  const event = eventData as { id: number } | null;
  if (error || !event) {
    throw error || new Error("Failed to create event");
  }

  return event.id;
}

export async function createVenueFromSubmission(
  supabase: ServiceClient,
  data: VenueSubmissionData,
  submittedBy: string,
  submissionId: string
): Promise<number> {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: existing } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const finalSlug = existing
    ? `${slug}-${Date.now().toString(36)}`
    : slug;

  const { data: venueData, error } = await supabase
    .from("venues")
    .insert({
      name: data.name,
      slug: finalSlug,
      address: data.address || null,
      neighborhood: null, // Polygon pipeline assigns from coordinates
      city: data.city || "Atlanta",
      state: data.state || "GA",
      zip: data.zip || null,
      website: data.website || null,
      venue_type: data.venue_type || null,
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .maybeSingle();

  const venue = venueData as { id: number } | null;
  if (error || !venue) {
    throw error || new Error("Failed to create venue");
  }

  return venue.id;
}

export async function createOrganizationFromSubmission(
  supabase: ServiceClient,
  data: ProducerSubmissionData,
  submittedBy: string,
  submissionId: string
): Promise<string> {
  const baseSlug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", baseSlug)
    .maybeSingle();

  const finalId = existing
    ? `${baseSlug}-${Date.now().toString(36)}`
    : baseSlug;

  const { data: organizationData, error } = await supabase
    .from("organizations")
    .insert({
      id: finalId,
      name: data.name,
      slug: finalId,
      org_type: data.org_type || "community_group",
      website: data.website || null,
      email: data.email || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      neighborhood: data.neighborhood || null,
      description: data.description || null,
      categories: data.categories || null,
      is_verified: false,
      submitted_by: submittedBy,
      from_submission: submissionId,
    } as never)
    .select("id")
    .maybeSingle();

  const organization = organizationData as { id: string } | null;
  if (error || !organization) {
    throw error || new Error("Failed to create organization");
  }

  return organization.id;
}

import { createServiceClient } from "@/lib/supabase/service";
import type { AnySupabase } from "@/lib/api-utils";

export type VolunteerOpportunity = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  commitment_level: "drop_in" | "ongoing" | "lead_role";
  time_horizon: "one_day" | "multi_week" | "multi_month" | "ongoing" | null;
  onboarding_level: "none" | "light" | "screening_required" | "training_required" | null;
  schedule_summary: string | null;
  location_summary: string | null;
  skills_required: string[];
  language_support: string[];
  physical_demand: "low" | "medium" | "high" | null;
  min_age: number | null;
  family_friendly: boolean;
  group_friendly: boolean;
  remote_allowed: boolean;
  accessibility_notes: string | null;
  background_check_required: boolean;
  training_required: boolean;
  capacity_total: number | null;
  capacity_remaining: number | null;
  urgency_level: "normal" | "urgent";
  starts_on: string | null;
  ends_on: string | null;
  application_url: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  updated_at: string;
  source_id: number | null;
  portal_id: string | null;
  event_id: number | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    org_type: string | null;
    website: string | null;
    logo_url: string | null;
    description: string | null;
    city: string | null;
    neighborhood: string | null;
  };
  source: {
    id: number;
    name: string;
    slug: string;
    url: string;
  } | null;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
  } | null;
};

export type VolunteerProfile = {
  user_id: string;
  causes: string[];
  skills: string[];
  availability_windows: Array<Record<string, unknown>>;
  travel_radius_km: number | null;
  mobility_constraints: string | null;
  languages: string[];
  commitment_preference: "drop_in" | "ongoing" | "lead_role" | "mixed" | null;
};

export type RankedVolunteerOpportunity = VolunteerOpportunity & {
  fit_score: number;
  fit_reasons: string[];
};

export type VolunteerOpportunitySummary = {
  total: number;
  by_commitment_level: Record<VolunteerOpportunity["commitment_level"], number>;
  by_cause: Array<{
    cause: string;
    count: number;
  }>;
};

type PortalRow = {
  id: string;
  slug: string;
  name: string;
};

export type VolunteerOpportunityFilters = {
  portalSlug: string;
  limit?: number;
  commitmentLevel?: VolunteerOpportunity["commitment_level"];
  organizationSlug?: string;
  timeHorizon?: NonNullable<VolunteerOpportunity["time_horizon"]>;
  onboardingLevel?: NonNullable<VolunteerOpportunity["onboarding_level"]>;
  remoteAllowed?: boolean;
  cause?: string;
  query?: string;
};

const VOLUNTEER_OPPORTUNITY_SELECT = `
  id,
  slug,
  title,
  summary,
  description,
  commitment_level,
  time_horizon,
  onboarding_level,
  schedule_summary,
  location_summary,
  skills_required,
  language_support,
  physical_demand,
  min_age,
  family_friendly,
  group_friendly,
  remote_allowed,
  accessibility_notes,
  background_check_required,
  training_required,
  capacity_total,
  capacity_remaining,
  urgency_level,
  starts_on,
  ends_on,
  application_url,
  source_url,
  metadata,
  is_active,
  updated_at,
  source_id,
  portal_id,
  event_id,
  organization:organizations!inner(
    id,
    name,
    slug,
    org_type,
    website,
    logo_url,
    description,
    city,
    neighborhood
  ),
  source:sources(
    id,
    name,
    slug,
    url
  ),
  event:events(
    id,
    title,
    start_date,
    start_time,
    end_time
  )
`;

function getDb(): AnySupabase {
  return createServiceClient() as unknown as AnySupabase;
}

async function getActivePortalBySlug(slug: string): Promise<PortalRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("slug", slug)
    .in("status", ["active", "draft"])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve portal: ${error.message}`);
  }

  return (data as PortalRow | null) ?? null;
}

async function getPortalAccessibleSourceIds(portalId: string): Promise<Set<number>> {
  const db = getDb();
  const { data, error } = await db
    .from("portal_source_access")
    .select("source_id")
    .eq("portal_id", portalId);

  if (error) {
    throw new Error(`Failed to resolve portal source access: ${error.message}`);
  }

  return new Set(
    ((data || []) as Array<{ source_id: number | null }>)
      .map((row) => row.source_id)
      .filter((value): value is number => typeof value === "number")
  );
}

function sortOpportunities<T extends VolunteerOpportunity>(opportunities: T[]): T[] {
  const urgencyWeight = (value: VolunteerOpportunity["urgency_level"]) => (value === "urgent" ? 0 : 1);
  const commitmentWeight = (value: VolunteerOpportunity["commitment_level"]) => {
    if (value === "lead_role") return 2;
    if (value === "ongoing") return 1;
    return 0;
  };
  const fitScore = (value: T) =>
    "fit_score" in value && typeof value.fit_score === "number" ? value.fit_score : 0;

  return [...opportunities].sort((a, b) => {
    const fitDiff = fitScore(b) - fitScore(a);
    if (fitDiff !== 0) return fitDiff;

    const urgencyDiff = urgencyWeight(a.urgency_level) - urgencyWeight(b.urgency_level);
    if (urgencyDiff !== 0) return urgencyDiff;

    const commitmentDiff = commitmentWeight(b.commitment_level) - commitmentWeight(a.commitment_level);
    if (commitmentDiff !== 0) return commitmentDiff;

    const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (updatedDiff !== 0) return updatedDiff;

    return a.title.localeCompare(b.title);
  });
}

export function formatCommitmentLevel(value: VolunteerOpportunity["commitment_level"]): string {
  if (value === "lead_role") return "Lead";
  if (value === "ongoing") return "Ongoing";
  return "Drop-in";
}

export function formatOnboardingLevel(value: VolunteerOpportunity["onboarding_level"]): string | null {
  if (value === "screening_required") return "Screening required";
  if (value === "training_required") return "Training required";
  if (value === "light") return "Light onboarding";
  if (value === "none") return "No onboarding";
  return null;
}

export function formatTimeHorizon(value: VolunteerOpportunity["time_horizon"]): string | null {
  if (value === "multi_month") return "Multi-month";
  if (value === "multi_week") return "Multi-week";
  if (value === "one_day") return "One day";
  if (value === "ongoing") return "Open-ended";
  return null;
}

export function formatVolunteerCause(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVolunteerOpportunityCause(opportunity: VolunteerOpportunity): string | null {
  return typeof opportunity.metadata?.cause === "string" ? opportunity.metadata.cause : null;
}

export function summarizeVolunteerOpportunities(
  opportunities: VolunteerOpportunity[],
): VolunteerOpportunitySummary {
  const byCommitmentLevel: VolunteerOpportunitySummary["by_commitment_level"] = {
    drop_in: 0,
    ongoing: 0,
    lead_role: 0,
  };
  const causeCounts = new Map<string, number>();

  for (const opportunity of opportunities) {
    byCommitmentLevel[opportunity.commitment_level] += 1;
    const cause = getVolunteerOpportunityCause(opportunity);
    if (cause) {
      causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + 1);
    }
  }

  return {
    total: opportunities.length,
    by_commitment_level: byCommitmentLevel,
    by_cause: Array.from(causeCounts.entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause)),
  };
}

function matchesOpportunityFilters(
  opportunity: VolunteerOpportunity,
  filters: VolunteerOpportunityFilters,
): boolean {
  if (filters.cause) {
    const cause = getVolunteerOpportunityCause(opportunity);
    if (cause !== filters.cause) return false;
  }

  if (filters.query) {
    const haystack = [
      opportunity.title,
      opportunity.summary || "",
      opportunity.description || "",
      opportunity.organization.name,
      opportunity.organization.slug,
      opportunity.location_summary || "",
      opportunity.schedule_summary || "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }

  if (typeof filters.remoteAllowed === "boolean" && opportunity.remote_allowed !== filters.remoteAllowed) {
    return false;
  }

  if (filters.timeHorizon && opportunity.time_horizon !== filters.timeHorizon) {
    return false;
  }

  if (filters.onboardingLevel && opportunity.onboarding_level !== filters.onboardingLevel) {
    return false;
  }

  return true;
}

export async function getVolunteerProfileForUser(userId: string): Promise<VolunteerProfile | null> {
  const db = getDb();
  const { data, error } = await db
    .from("user_volunteer_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch volunteer profile: ${error.message}`);
  }

  return (data as VolunteerProfile | null) ?? null;
}

function rankVolunteerOpportunity(
  opportunity: VolunteerOpportunity,
  profile: VolunteerProfile | null | undefined,
): RankedVolunteerOpportunity {
  const reasons: string[] = [];
  let score = 0;

  if (!profile) {
    return {
      ...opportunity,
      fit_score: score,
      fit_reasons: reasons,
    };
  }

  const cause = getVolunteerOpportunityCause(opportunity);
  if (cause && profile.causes.includes(cause)) {
    score += 4;
    reasons.push("Cause match");
  }

  const skillOverlap = opportunity.skills_required.filter((skill) => profile.skills.includes(skill));
  if (skillOverlap.length > 0) {
    score += 3;
    reasons.push("Skill match");
  }

  if (profile.commitment_preference && profile.commitment_preference !== "mixed") {
    if (profile.commitment_preference === opportunity.commitment_level) {
      score += 2;
      reasons.push("Matches your commitment level");
    } else if (profile.commitment_preference === "ongoing" && opportunity.commitment_level === "lead_role") {
      score += 1;
      reasons.push("Near your commitment preference");
    }
  }

  if (profile.languages.some((language) => opportunity.language_support.includes(language))) {
    score += 2;
    reasons.push("Language match");
  }

  if (opportunity.remote_allowed && profile.mobility_constraints) {
    score += 1;
    reasons.push("Remote-friendly");
  }

  return {
    ...opportunity,
    fit_score: score,
    fit_reasons: reasons,
  };
}

export async function getVolunteerOpportunitiesForPortal(
  options: VolunteerOpportunityFilters & { profile?: VolunteerProfile | null },
): Promise<{
  portal: PortalRow;
  opportunities: RankedVolunteerOpportunity[];
  summary: VolunteerOpportunitySummary;
} | null> {
  const portal = await getActivePortalBySlug(options.portalSlug);
  if (!portal) return null;

  const db = getDb();
  const accessibleSourceIds = await getPortalAccessibleSourceIds(portal.id);

  let query = db
    .from("volunteer_opportunities")
    .select(VOLUNTEER_OPPORTUNITY_SELECT)
    .eq("is_active", true)
    .or(`portal_id.is.null,portal_id.eq.${portal.id}`);

  if (options.commitmentLevel) {
    query = query.eq("commitment_level", options.commitmentLevel);
  }

  if (options.organizationSlug) {
    query = query.eq("organization.slug", options.organizationSlug);
  }

  // Structured opportunity inventories are small enough that fetching a wider pool keeps
  // summary counts truthful even when a surface only renders a short ranked slice.
  const fetchLimit = Math.max(options.limit ?? 24, 200);
  const { data, error } = await query.limit(fetchLimit);
  if (error) {
    throw new Error(`Failed to fetch volunteer opportunities: ${error.message}`);
  }

  const filtered = ((data || []) as unknown as VolunteerOpportunity[]).filter((opportunity) => {
    if (opportunity.source_id === null) return true;
    if (accessibleSourceIds.size === 0) return true;
    return accessibleSourceIds.has(opportunity.source_id);
  }).filter((opportunity) => matchesOpportunityFilters(opportunity, options));

  const ranked = filtered.map((opportunity) => rankVolunteerOpportunity(opportunity, options.profile));

  return {
    portal,
    opportunities: sortOpportunities(ranked).slice(0, options.limit ?? 24),
    summary: summarizeVolunteerOpportunities(filtered),
  };
}

export async function getVolunteerOpportunityBySlug(options: {
  portalSlug: string;
  slug: string;
  profile?: VolunteerProfile | null;
}): Promise<{ portal: PortalRow; opportunity: RankedVolunteerOpportunity } | null> {
  const portal = await getActivePortalBySlug(options.portalSlug);
  if (!portal) return null;

  const db = getDb();
  const accessibleSourceIds = await getPortalAccessibleSourceIds(portal.id);
  const { data, error } = await db
    .from("volunteer_opportunities")
    .select(VOLUNTEER_OPPORTUNITY_SELECT)
    .eq("slug", options.slug)
    .eq("is_active", true)
    .or(`portal_id.is.null,portal_id.eq.${portal.id}`)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch volunteer opportunity: ${error.message}`);
  }

  const opportunity = (data || null) as unknown as VolunteerOpportunity | null;
  if (!opportunity) return null;

  if (
    opportunity.source_id !== null
    && accessibleSourceIds.size > 0
    && !accessibleSourceIds.has(opportunity.source_id)
  ) {
    return null;
  }

  return { portal, opportunity: rankVolunteerOpportunity(opportunity, options.profile) };
}

export async function getVolunteerOpportunitiesForOrganization(options: {
  organizationSlug: string;
  limit?: number;
}): Promise<VolunteerOpportunity[]> {
  const db = getDb();
  const { data, error } = await db
    .from("volunteer_opportunities")
    .select(VOLUNTEER_OPPORTUNITY_SELECT)
    .eq("is_active", true)
    .eq("organization.slug", options.organizationSlug)
    .limit(options.limit ?? 12);

  if (error) {
    throw new Error(`Failed to fetch organization volunteer opportunities: ${error.message}`);
  }

  return sortOpportunities((data || []) as unknown as VolunteerOpportunity[]).slice(0, options.limit ?? 12);
}

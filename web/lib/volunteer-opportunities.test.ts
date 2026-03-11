import { describe, expect, it } from "vitest";
import {
  formatVolunteerCause,
  summarizeVolunteerOpportunities,
  type VolunteerOpportunity,
} from "./volunteer-opportunities";

function buildOpportunity(
  overrides: Partial<VolunteerOpportunity>,
): VolunteerOpportunity {
  return {
    id: overrides.id ?? "opp-1",
    slug: overrides.slug ?? "opp-1",
    title: overrides.title ?? "Volunteer role",
    summary: overrides.summary ?? null,
    description: overrides.description ?? null,
    commitment_level: overrides.commitment_level ?? "ongoing",
    time_horizon: overrides.time_horizon ?? "multi_month",
    onboarding_level: overrides.onboarding_level ?? "light",
    schedule_summary: overrides.schedule_summary ?? null,
    location_summary: overrides.location_summary ?? null,
    skills_required: overrides.skills_required ?? [],
    language_support: overrides.language_support ?? [],
    physical_demand: overrides.physical_demand ?? null,
    min_age: overrides.min_age ?? null,
    family_friendly: overrides.family_friendly ?? false,
    group_friendly: overrides.group_friendly ?? false,
    remote_allowed: overrides.remote_allowed ?? false,
    accessibility_notes: overrides.accessibility_notes ?? null,
    background_check_required: overrides.background_check_required ?? false,
    training_required: overrides.training_required ?? false,
    capacity_total: overrides.capacity_total ?? null,
    capacity_remaining: overrides.capacity_remaining ?? null,
    urgency_level: overrides.urgency_level ?? "normal",
    starts_on: overrides.starts_on ?? null,
    ends_on: overrides.ends_on ?? null,
    application_url: overrides.application_url ?? "https://example.com/apply",
    source_url: overrides.source_url ?? null,
    metadata: overrides.metadata ?? {},
    is_active: overrides.is_active ?? true,
    updated_at: overrides.updated_at ?? "2026-03-11T12:00:00.000Z",
    source_id: overrides.source_id ?? 1,
    portal_id: overrides.portal_id ?? null,
    event_id: overrides.event_id ?? null,
    organization: overrides.organization ?? {
      id: "org-1",
      name: "Example Org",
      slug: "example-org",
      org_type: null,
      website: null,
      logo_url: null,
      description: null,
      city: "Atlanta",
      neighborhood: null,
    },
    source: overrides.source ?? {
      id: 1,
      name: "Example Source",
      slug: "example-source",
      url: "https://example.com",
    },
    event: overrides.event ?? null,
  };
}

describe("volunteer opportunity helpers", () => {
  it("formats cause labels for display", () => {
    expect(formatVolunteerCause("immigrant_refugee")).toBe("Immigrant Refugee");
    expect(formatVolunteerCause("health_wellness")).toBe("Health Wellness");
  });

  it("summarizes commitment and cause mix across opportunities", () => {
    const summary = summarizeVolunteerOpportunities([
      buildOpportunity({
        id: "opp-1",
        commitment_level: "ongoing",
        metadata: { cause: "civic_engagement" },
      }),
      buildOpportunity({
        id: "opp-2",
        slug: "opp-2",
        commitment_level: "lead_role",
        metadata: { cause: "civic_engagement" },
      }),
      buildOpportunity({
        id: "opp-3",
        slug: "opp-3",
        commitment_level: "drop_in",
        metadata: { cause: "family_support" },
      }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.by_commitment_level).toEqual({
      drop_in: 1,
      ongoing: 1,
      lead_role: 1,
    });
    expect(summary.by_cause).toEqual([
      { cause: "civic_engagement", count: 2 },
      { cause: "family_support", count: 1 },
    ]);
  });
});

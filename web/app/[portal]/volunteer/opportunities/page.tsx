import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  formatCommitmentLevel,
  formatVolunteerCause,
  formatOnboardingLevel,
  formatTimeHorizon,
  getVolunteerProfileForUser,
  getVolunteerOpportunitiesForPortal,
} from "@/lib/volunteer-opportunities";
import { VolunteerInterestButton } from "@/components/volunteer/VolunteerInterestButton";
import { VolunteerApplyLink } from "@/components/volunteer/VolunteerApplyLink";
import { VolunteerProfilePanel } from "@/components/volunteer/VolunteerProfilePanel";
import { resolveCommunityPageRequest } from "../../_surfaces/community/resolve-community-page-request";

export const revalidate = 180;
export const dynamic = "force-dynamic";

type SearchParams = {
  commitment_level?: string;
  time_horizon?: string;
  onboarding_level?: string;
  cause?: string;
  remote_allowed?: string;
  q?: string;
};

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<SearchParams>;
};

const FILTER_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  lead_role: "Lead",
  multi_week: "Multi-week",
  multi_month: "Multi-month",
  training_required: "Training required",
  screening_required: "Screening required",
  civic_engagement: "Civic engagement",
  health_wellness: "Health and public health",
  environment: "Environment",
  food_security: "Food security",
  youth_education: "Youth education",
  family_support: "Family support",
  education: "Education",
  housing: "Housing",
  immigrant_refugee: "Immigrant and refugee support",
  legal_aid: "Legal aid",
  true: "Remote-friendly",
};

function withFilter(
  current: URLSearchParams,
  key: string,
  value: string | null,
): string {
  const next = new URLSearchParams(current);
  if (value === null) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next.toString();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/volunteer/opportunities`,
  });
  const portal = request?.portal ?? null;

  if (!portal) {
    return { title: "Volunteer Opportunities", robots: { index: false, follow: false } };
  }

  return {
    title: `Commit To A Cause | ${portal.name}`,
    description: `Browse long-term volunteer roles and civic commitments in ${portal.name}.`,
    alternates: {
      canonical: `/${portal.slug}/volunteer/opportunities`,
    },
  };
}

export default async function VolunteerOpportunitiesPage({
  params,
  searchParams,
}: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/volunteer/opportunities`,
  });
  const portal = request?.portal ?? null;
  if (!portal) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getVolunteerProfileForUser(user.id) : null;

  const filters = await searchParams;
  const result = await getVolunteerOpportunitiesForPortal({
    portalSlug: portal.slug,
    limit: 48,
    commitmentLevel:
      filters.commitment_level === "ongoing" || filters.commitment_level === "lead_role"
        ? filters.commitment_level
        : undefined,
    timeHorizon:
      filters.time_horizon === "one_day"
      || filters.time_horizon === "multi_week"
      || filters.time_horizon === "multi_month"
      || filters.time_horizon === "ongoing"
        ? filters.time_horizon
        : undefined,
    onboardingLevel:
      filters.onboarding_level === "none"
      || filters.onboarding_level === "light"
      || filters.onboarding_level === "screening_required"
      || filters.onboarding_level === "training_required"
        ? filters.onboarding_level
        : undefined,
    cause: filters.cause,
    query: filters.q,
    remoteAllowed: filters.remote_allowed === "true" ? true : undefined,
    profile,
  });

  if (!result) notFound();

  const query = new URLSearchParams();
  if (filters.commitment_level) query.set("commitment_level", filters.commitment_level);
  if (filters.time_horizon) query.set("time_horizon", filters.time_horizon);
  if (filters.onboarding_level) query.set("onboarding_level", filters.onboarding_level);
  if (filters.cause) query.set("cause", filters.cause);
  if (filters.remote_allowed) query.set("remote_allowed", filters.remote_allowed);
  if (filters.q) query.set("q", filters.q);

  const activeTokens = Array.from(query.entries());

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      <header className="sticky top-0 z-40 border-b border-[#E5E4E1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={`/${portal.slug}`} className="text-sm font-medium text-[#1A1918]">
            Back
          </Link>
          <span className="text-sm font-semibold text-[#1A1918]">{portal.name}</span>
          <span className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
            Commit to a Cause
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section className="rounded-3xl border border-[#E5E4E1] bg-white p-6">
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#2D6A4F]">
            Structured opportunities
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#1A1918]">
            Long-term volunteer roles across metro Atlanta
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[#6D6C6A]">
            These are ongoing commitments, not one-off event listings. Browse roles by cause,
            onboarding level, and time horizon.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                Active roles
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1918]">{result.summary.total}</p>
            </div>
            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                Ongoing roles
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1918]">
                {result.summary.by_commitment_level.ongoing}
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                Lead roles
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1918]">
                {result.summary.by_commitment_level.lead_role}
              </p>
            </div>
          </div>

          <form className="mt-5 flex flex-col gap-3 md:flex-row" action={`/${portal.slug}/volunteer/opportunities`}>
            <input
              type="search"
              name="q"
              defaultValue={filters.q || ""}
              placeholder="Search mentoring, environment, tutoring..."
              className="flex-1 rounded-xl border border-[#E5E4E1] px-4 py-2.5 text-sm text-[#1A1918] outline-none focus:border-[#2D6A4F]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#255740]"
            >
              Apply filters
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["commitment_level", "ongoing"],
              ["commitment_level", "lead_role"],
              ["time_horizon", "multi_week"],
              ["time_horizon", "multi_month"],
              ["onboarding_level", "training_required"],
              ["cause", "civic_engagement"],
              ["cause", "environment"],
              ["cause", "food_security"],
              ["cause", "youth_education"],
              ["cause", "housing"],
              ["cause", "immigrant_refugee"],
              ["cause", "legal_aid"],
              ["remote_allowed", "true"],
            ].map(([key, value]) => (
              <Link
                key={`${key}-${value}`}
                href={`/${portal.slug}/volunteer/opportunities?${withFilter(query, key, value)}`}
                className="rounded-full border border-[#D9D7D1] px-3 py-1.5 text-xs font-medium text-[#6D6C6A] hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
              >
                {FILTER_LABELS[value]}
              </Link>
            ))}
            {activeTokens.length > 0 && (
              <Link
                href={`/${portal.slug}/volunteer/opportunities`}
                className="rounded-full border border-[#E7C9BF] bg-[#FEF0E8] px-3 py-1.5 text-xs font-medium text-[#9F4C34]"
              >
                Clear all
              </Link>
            )}
          </div>

          {activeTokens.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6D6C6A]">
              {activeTokens.map(([key, value]) => (
                <span key={`${key}-${value}`} className="rounded-full bg-[#F0EFEC] px-3 py-1.5">
                  {FILTER_LABELS[value] || `${key}: ${value}`}
                </span>
              ))}
            </div>
          )}

          {result.summary.by_cause.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                Strongest cause lanes
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.summary.by_cause.slice(0, 5).map((entry) => (
                  <Link
                    key={entry.cause}
                    href={`/${portal.slug}/volunteer/opportunities?${withFilter(query, "cause", entry.cause)}`}
                    className="rounded-full border border-[#D9D7D1] bg-white px-3 py-1.5 text-xs font-medium text-[#4D4B47] hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
                  >
                    {formatVolunteerCause(entry.cause)} {entry.count}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-6">
          <VolunteerProfilePanel />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
              {result.opportunities.length} roles
            </h2>
            {profile && (
              <span className="text-xs text-[#6D6C6A]">
                Ranked using your volunteer fit profile
              </span>
            )}
          </div>

          <div className="space-y-4">
            {result.opportunities.map((opportunity) => (
              <article key={opportunity.id} className="rounded-2xl border border-[#E5E4E1] bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#E6F3EF] px-2.5 py-1 text-xs font-mono uppercase tracking-[0.14em] text-[#2D6A4F]">
                        {formatCommitmentLevel(opportunity.commitment_level)}
                      </span>
                      {formatTimeHorizon(opportunity.time_horizon) && (
                        <span className="rounded-full border border-[#E5E4E1] px-2.5 py-1 text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                          {formatTimeHorizon(opportunity.time_horizon)}
                        </span>
                      )}
                      {opportunity.remote_allowed && (
                        <span className="rounded-full border border-[#E5E4E1] px-2.5 py-1 text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                          Remote-friendly
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-xl font-semibold text-[#1A1918]">
                      <Link href={`/${portal.slug}/volunteer/opportunities/${opportunity.slug}`} className="hover:text-[#2D6A4F]">
                        {opportunity.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm font-medium text-[#6D6C6A]">
                      <Link href={`/${portal.slug}/community/${opportunity.organization.slug}`} className="hover:text-[#1A1918]">
                        {opportunity.organization.name}
                      </Link>
                    </p>
                    <p className="mt-3 text-sm text-[#4D4B47]">
                      {opportunity.summary || opportunity.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6D6C6A]">
                      {opportunity.schedule_summary && <span>{opportunity.schedule_summary}</span>}
                      {opportunity.location_summary && <span>{opportunity.location_summary}</span>}
                      {formatOnboardingLevel(opportunity.onboarding_level) && (
                        <span>{formatOnboardingLevel(opportunity.onboarding_level)}</span>
                      )}
                      {opportunity.background_check_required && <span>Background check</span>}
                      {opportunity.training_required && <span>Training</span>}
                    </div>

                    {opportunity.fit_reasons.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {opportunity.fit_reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-[#FEF0E8] px-2.5 py-1 text-xs font-medium text-[#9F4C34]"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:w-48">
                    <VolunteerInterestButton
                      portalSlug={portal.slug}
                      opportunityId={opportunity.id}
                      opportunitySlug={opportunity.slug}
                      sectionKey="volunteer_browse_list"
                    />
                    <VolunteerApplyLink
                      portalSlug={portal.slug}
                      opportunityId={opportunity.id}
                      opportunitySlug={opportunity.slug}
                      href={opportunity.application_url}
                      sectionKey="volunteer_browse_list"
                      className="inline-flex items-center justify-center rounded-xl border border-[#E5E4E1] px-4 py-2.5 text-sm font-medium text-[#1A1918] hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
                    >
                      Apply externally
                    </VolunteerApplyLink>
                    <Link
                      href={`/${portal.slug}/volunteer/opportunities/${opportunity.slug}`}
                      className="text-center text-sm text-[#6D6C6A] hover:text-[#1A1918]"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {result.opportunities.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#D9D7D1] bg-white px-6 py-10 text-center text-sm text-[#6D6C6A]">
              No opportunities matched those filters.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

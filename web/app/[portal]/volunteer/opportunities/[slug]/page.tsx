import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCachedPortalBySlug } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import {
  formatCommitmentLevel,
  formatOnboardingLevel,
  formatTimeHorizon,
  formatVolunteerCause,
  getVolunteerProfileForUser,
  getVolunteerOpportunityBySlug,
} from "@/lib/volunteer-opportunities";
import { VolunteerInterestButton } from "@/components/volunteer/VolunteerInterestButton";
import { VolunteerApplyLink } from "@/components/volunteer/VolunteerApplyLink";
import { VolunteerDetailTracker } from "@/components/volunteer/VolunteerDetailTracker";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug, slug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) {
    return { title: "Volunteer Opportunity", robots: { index: false, follow: false } };
  }

  const result = await getVolunteerOpportunityBySlug({ portalSlug: portal.slug, slug });
  if (!result) {
    return {
      title: `Opportunity Not Found | ${portal.name}`,
      robots: { index: false, follow: false },
    };
  }

  const description =
    result.opportunity.summary
    || result.opportunity.description
    || `Volunteer with ${result.opportunity.organization.name} through ${portal.name}.`;

  return {
    title: `${result.opportunity.title} | ${portal.name}`,
    description,
    alternates: {
      canonical: `/${portal.slug}/volunteer/opportunities/${result.opportunity.slug}`,
    },
  };
}

export default async function VolunteerOpportunityDetailPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getVolunteerProfileForUser(user.id) : null;

  const result = await getVolunteerOpportunityBySlug({ portalSlug: portal.slug, slug, profile });
  if (!result) notFound();

  const { opportunity } = result;
  const cause = typeof opportunity.metadata?.cause === "string"
    ? formatVolunteerCause(opportunity.metadata.cause)
    : null;

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      <VolunteerDetailTracker
        portalSlug={portal.slug}
        opportunityId={opportunity.id}
        opportunitySlug={opportunity.slug}
      />
      <header className="sticky top-0 z-40 border-b border-[#E5E4E1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href={`/${portal.slug}/volunteer/opportunities`} className="text-sm font-medium text-[#1A1918]">
            Back
          </Link>
          <span className="text-sm font-semibold text-[#1A1918]">{portal.name}</span>
          <Link href={`/${portal.slug}/community/${opportunity.organization.slug}`} className="text-xs text-[#6D6C6A]">
            Organization
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <section className="rounded-3xl border border-[#E5E4E1] bg-white p-6">
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
            {cause && (
              <span className="rounded-full border border-[#E5E4E1] px-2.5 py-1 text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">
                {cause}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-[#1A1918]">{opportunity.title}</h1>
          <p className="mt-2 text-sm font-medium text-[#6D6C6A]">
            <Link href={`/${portal.slug}/community/${opportunity.organization.slug}`} className="hover:text-[#1A1918]">
              {opportunity.organization.name}
            </Link>
          </p>

          <p className="mt-4 text-base leading-7 text-[#4D4B47]">
            {opportunity.description || opportunity.summary}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">Commitment</p>
              <div className="mt-3 space-y-2 text-sm text-[#1A1918]">
                <p>{formatCommitmentLevel(opportunity.commitment_level)}</p>
                {formatTimeHorizon(opportunity.time_horizon) && <p>{formatTimeHorizon(opportunity.time_horizon)}</p>}
                {opportunity.schedule_summary && <p>{opportunity.schedule_summary}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">Requirements</p>
              <div className="mt-3 space-y-2 text-sm text-[#1A1918]">
                {formatOnboardingLevel(opportunity.onboarding_level) && (
                  <p>{formatOnboardingLevel(opportunity.onboarding_level)}</p>
                )}
                {opportunity.background_check_required && <p>Background check required</p>}
                {opportunity.training_required && <p>Training required</p>}
                {opportunity.min_age !== null && <p>Minimum age {opportunity.min_age}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">Location</p>
              <div className="mt-3 space-y-2 text-sm text-[#1A1918]">
                {opportunity.location_summary && <p>{opportunity.location_summary}</p>}
                {opportunity.remote_allowed && <p>Remote participation available</p>}
                {opportunity.accessibility_notes && <p>{opportunity.accessibility_notes}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E4E1] bg-[#FAF9F7] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#6D6C6A]">Skills</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(opportunity.skills_required.length > 0 ? opportunity.skills_required : ["No specific skills listed"]).map((skill) => (
                  <span key={skill} className="rounded-full bg-white px-3 py-1 text-sm text-[#1A1918]">
                    {skill.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {opportunity.fit_reasons.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[#E7C9BF] bg-[#FEF0E8] p-4">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#9F4C34]">
                Why this matches
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {opportunity.fit_reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-white px-3 py-1 text-sm text-[#9F4C34]">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <VolunteerInterestButton
              portalSlug={portal.slug}
              opportunityId={opportunity.id}
              opportunitySlug={opportunity.slug}
              sectionKey="volunteer_detail"
            />
            <VolunteerApplyLink
              portalSlug={portal.slug}
              opportunityId={opportunity.id}
              opportunitySlug={opportunity.slug}
              href={opportunity.application_url}
              sectionKey="volunteer_detail"
              className="inline-flex items-center justify-center rounded-xl border border-[#E5E4E1] px-4 py-2.5 text-sm font-medium text-[#1A1918] hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
            >
              Apply on organization site
            </VolunteerApplyLink>
          </div>

          <div className="mt-6 border-t border-[#F0EFEC] pt-4 text-sm text-[#6D6C6A]">
            Source:
            {" "}
            <a href={opportunity.source_url || opportunity.application_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#1A1918]">
              {opportunity.source?.name || opportunity.organization.name}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

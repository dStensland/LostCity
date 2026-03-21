"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HandHeart, ArrowRight } from "@phosphor-icons/react";
import { VolunteerInterestButton } from "@/components/volunteer/VolunteerInterestButton";
import { VolunteerApplyLink } from "@/components/volunteer/VolunteerApplyLink";
import { formatVolunteerCause } from "@/lib/volunteer-opportunities";

type Opportunity = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  commitment_level: "drop_in" | "ongoing" | "lead_role";
  time_horizon: "one_day" | "multi_week" | "multi_month" | "ongoing" | null;
  onboarding_level: "none" | "light" | "screening_required" | "training_required" | null;
  schedule_summary: string | null;
  location_summary: string | null;
  remote_allowed: boolean;
  training_required: boolean;
  background_check_required: boolean;
  application_url: string;
  organization: {
    name: string;
    slug: string;
  };
};

type OpportunityWithReasons = Opportunity & {
  fit_reasons?: string[];
};

type VolunteerResponse = {
  opportunities: OpportunityWithReasons[];
  summary?: {
    total: number;
    by_commitment_level: {
      drop_in: number;
      ongoing: number;
      lead_role: number;
    };
    by_cause: Array<{
      cause: string;
      count: number;
    }>;
  };
  personalization?: {
    applied: boolean;
    has_profile: boolean;
  };
};

type VolunteerImpactResponse = {
  totals: {
    tracked: number;
    interested: number;
    committed: number;
    attended: number;
  };
};

function formatCommitmentLevel(value: Opportunity["commitment_level"]): string {
  if (value === "lead_role") return "Lead";
  if (value === "ongoing") return "Ongoing";
  return "Drop-in";
}

function formatTimeHorizon(value: Opportunity["time_horizon"]): string | null {
  if (value === "multi_month") return "Multi-month";
  if (value === "multi_week") return "Multi-week";
  if (value === "one_day") return "One day";
  if (value === "ongoing") return "Open-ended";
  return null;
}

export default function CommitmentOpportunitiesCard({
  portalSlug,
}: {
  portalSlug: string;
}) {
  const [opportunities, setOpportunities] = useState<OpportunityWithReasons[]>([]);
  const [summary, setSummary] = useState<VolunteerResponse["summary"] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [trackedCount, setTrackedCount] = useState<number | null>(null);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/portals/${portalSlug}/volunteer/opportunities?limit=8`, {
      signal: controller.signal,
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<VolunteerResponse>;
      })
      .then((json) => {
        setOpportunities(json.opportunities || []);
        setSummary(json.summary || null);
        setPersonalized(Boolean(json.personalization?.applied));
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [portalSlug]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/me/volunteer-impact", {
      signal: controller.signal,
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<VolunteerImpactResponse>;
      })
      .then((json) => {
        if (json?.totals) {
          setTrackedCount(json.totals.tracked);
        }
      })
      .catch(() => {
        /* ignore user impact fetch failures */
      });

    return () => controller.abort();
  }, []);

  const visible = useMemo<OpportunityWithReasons[]>(
    () => opportunities.filter((item) => item.commitment_level !== "drop_in").slice(0, 4),
    [opportunities],
  );
  const commitmentRoleCount = (summary?.by_commitment_level.ongoing ?? 0)
    + (summary?.by_commitment_level.lead_role ?? 0);
  const topCauses = summary?.by_cause?.slice(0, 3) ?? [];

  if (status === "error" || visible.length === 0) return null;

  return (
    <section className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{
              backgroundColor: "color-mix(in srgb, var(--action-primary) 12%, transparent)",
            }}
          >
            <HandHeart weight="duotone" className="w-3.5 h-3.5 text-[var(--action-primary)]" />
          </div>
          <span className="font-mono text-xs font-bold tracking-[0.1em] uppercase text-[var(--cream)]">
            Commit To A Cause
          </span>
        </div>
        <Link
          href={`/${portalSlug}/volunteer/opportunities`}
          className="font-mono text-2xs text-[var(--muted)] hover:text-[var(--cream)]"
        >
          Browse all
        </Link>
      </div>

      {status === "loading" ? (
        <div className="px-4 pb-4 space-y-2 animate-pulse">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-24 rounded-lg bg-[var(--twilight)]/20" />
          ))}
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3">
          {summary && (
            <div className="rounded-lg border border-[var(--twilight)]/70 bg-[var(--night)]/60 px-3 py-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Active roles
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[var(--cream)]">
                    {commitmentRoleCount || summary.total}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Ongoing
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[var(--cream)]">
                    {summary.by_commitment_level.ongoing}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Lead roles
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[var(--cream)]">
                    {summary.by_commitment_level.lead_role}
                  </div>
                </div>
              </div>
              {topCauses.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {topCauses.map((entry) => (
                    <Link
                      key={entry.cause}
                      href={`/${portalSlug}/volunteer/opportunities?cause=${encodeURIComponent(entry.cause)}`}
                      className="rounded-full border border-[var(--twilight)]/70 px-2.5 py-1 text-2xs text-[var(--soft)] hover:border-[var(--action-primary)]/35 hover:text-[var(--cream)]"
                    >
                      {formatVolunteerCause(entry.cause)} {entry.count}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {trackedCount !== null && trackedCount > 0 && (
            <div className="rounded-lg border border-[var(--action-primary)]/20 bg-[var(--action-primary)]/8 px-3 py-2 text-xs text-[var(--soft)]">
              You&apos;re tracking {trackedCount} volunteer role{trackedCount === 1 ? "" : "s"}.
            </div>
          )}
          {personalized && (
            <div className="rounded-lg border border-[var(--twilight)]/70 bg-[var(--night)]/60 px-3 py-2 text-xs text-[var(--muted)]">
              Ranked using your volunteer fit profile.
            </div>
          )}
          {visible.map((opportunity) => {
            const timeHorizonLabel = formatTimeHorizon(opportunity.time_horizon);

            return (
              <div
                key={opportunity.id}
                className="rounded-lg border border-[var(--twilight)]/70 bg-[var(--night)]/80 p-3"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full border border-[var(--action-primary)]/35 bg-[var(--action-primary)]/10 px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-[var(--action-primary)]">
                    {formatCommitmentLevel(opportunity.commitment_level)}
                  </span>
                  {timeHorizonLabel && (
                    <span className="inline-flex items-center rounded-full border border-[var(--twilight)]/70 px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {timeHorizonLabel}
                    </span>
                  )}
                  {opportunity.remote_allowed && (
                    <span className="inline-flex items-center rounded-full border border-[var(--twilight)]/70 px-2 py-1 font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Remote
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-[var(--cream)]">
                  {opportunity.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--soft)]">
                  {opportunity.organization.name}
                </p>
                {opportunity.summary && (
                  <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">
                    {opportunity.summary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-2xs text-[var(--muted)]">
                  {opportunity.schedule_summary && <span>{opportunity.schedule_summary}</span>}
                  {opportunity.location_summary && <span>{opportunity.location_summary}</span>}
                  {opportunity.background_check_required && <span>Background check</span>}
                  {opportunity.training_required && <span>Training</span>}
                </div>

                {opportunity.fit_reasons && opportunity.fit_reasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunity.fit_reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-[var(--action-primary)]/10 px-2 py-1 text-2xs text-[var(--action-primary)]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <VolunteerInterestButton
                    portalSlug={portalSlug}
                    opportunityId={opportunity.id}
                    opportunitySlug={opportunity.slug}
                    sectionKey="volunteer_commitment_card"
                    compact
                  />
                  <VolunteerApplyLink
                    portalSlug={portalSlug}
                    opportunityId={opportunity.id}
                    opportunitySlug={opportunity.slug}
                    href={opportunity.application_url}
                    sectionKey="volunteer_commitment_card"
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--twilight)]/80 px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:border-[var(--action-primary)]/35 hover:text-[var(--action-primary)] transition-colors"
                  >
                    Apply
                    <ArrowRight weight="bold" className="w-3.5 h-3.5" />
                  </VolunteerApplyLink>
                  <Link
                    href={`/${portalSlug}/volunteer/opportunities/${opportunity.slug}`}
                    className="text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  >
                    View details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

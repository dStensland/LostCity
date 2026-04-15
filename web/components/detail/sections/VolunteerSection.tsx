"use client";

import { CaretRight } from "@phosphor-icons/react";
import type { SectionProps } from "@/lib/detail/types";
import type { VolunteerOpportunity } from "@/lib/detail/types";

function formatCommitmentLevel(level: VolunteerOpportunity["commitment_level"]): string {
  if (level === "lead_role") return "Lead";
  if (level === "ongoing") return "Ongoing";
  return "Drop-in";
}

function formatTimeHorizon(value: VolunteerOpportunity["time_horizon"]): string | null {
  if (value === "multi_month") return "Multi-month";
  if (value === "multi_week") return "Multi-week";
  if (value === "one_day") return "One day";
  if (value === "ongoing") return "Open-ended";
  return null;
}

function formatOnboarding(value: VolunteerOpportunity["onboarding_level"]): string | null {
  if (value === "screening_required") return "Screening required";
  if (value === "training_required") return "Training required";
  if (value === "light") return "Brief orientation";
  return null;
}

export function VolunteerSection({ data }: SectionProps) {
  if (data.entityType !== "org") return null;

  const opportunities = data.payload.volunteer_opportunities;
  if (!opportunities || opportunities.length === 0) return null;

  return (
    <div className="space-y-2">
      {opportunities.map((opportunity) => {
        const onboardingLabel = formatOnboarding(opportunity.onboarding_level);
        const timeHorizonLabel = formatTimeHorizon(opportunity.time_horizon);
        const commitmentLabel = formatCommitmentLevel(opportunity.commitment_level);

        const pills = [
          commitmentLabel,
          timeHorizonLabel,
          opportunity.remote_allowed ? "Remote-friendly" : null,
        ].filter(Boolean) as string[];

        return (
          <div
            key={opportunity.id}
            className="border border-[var(--twilight)] rounded-card bg-[var(--dusk)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {pills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pills.map((pill) => (
                      <span
                        key={pill}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--twilight)] text-[var(--soft)]"
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                )}
                <h3 className="text-[var(--cream)] font-medium">{opportunity.title}</h3>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {opportunity.summary || opportunity.description}
                </p>
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-[var(--muted)]">
                  {opportunity.schedule_summary && (
                    <span>{opportunity.schedule_summary}</span>
                  )}
                  {opportunity.location_summary && (
                    <span>{opportunity.location_summary}</span>
                  )}
                  {onboardingLabel && <span>{onboardingLabel}</span>}
                  {opportunity.background_check_required && <span>Background check</span>}
                  {opportunity.training_required && <span>Training</span>}
                </div>
              </div>

              <a
                href={opportunity.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--coral)] hover:text-[var(--cream)] transition-colors flex-shrink-0"
              >
                Learn more
                <CaretRight weight="bold" className="w-4 h-4" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

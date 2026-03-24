"use client";

import { memo } from "react";
import type { OpenCallWithOrg } from "@/lib/open-calls-utils";
import {
  CALL_TYPE_LABELS,
  CONFIDENCE_TIER_LABELS,
  formatDeadline,
  formatFee,
  getDeadlineUrgencyClass,
} from "@/lib/open-calls-utils";

interface OpenCallCardProps {
  call: OpenCallWithOrg;
}

/**
 * Individual open call card — Underground Gallery aesthetic.
 *
 * Design rules:
 * - Zero corner radius (rounded-none)
 * - Stroke-defined: border only, minimal fill
 * - IBM Plex Mono for all labels (applied via portal font variable)
 * - // {call_type} section label in copper (action-primary)
 * - Deadline urgency: red < 7 days, copper < 30 days, muted otherwise
 * - Art provides the only color — UI is monochrome
 * - Full card is a link to application_url (external)
 */
export const OpenCallCard = memo(function OpenCallCard({ call }: OpenCallCardProps) {
  const orgName = call.organization?.name ?? call.venue?.name ?? null;
  const deadlineDisplay = formatDeadline(call.deadline);
  const deadlineClass = getDeadlineUrgencyClass(call.deadline, call.status);
  const feeDisplay = formatFee(call.fee);
  const typeLabel = CALL_TYPE_LABELS[call.call_type];
  const tierLabel = CONFIDENCE_TIER_LABELS[call.confidence_tier];
  const hasMediums =
    call.medium_requirements && call.medium_requirements.length > 0;

  return (
    <a
      href={call.application_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border border-[var(--twilight)] bg-transparent hover:border-[var(--soft)] hover:bg-[var(--night)]/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]"
      aria-label={`${call.title} — ${typeLabel}. Apply at external site.`}
    >
      <div className="p-4 sm:p-5">
        {/* Row 1: type label + tier badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs font-medium uppercase tracking-[0.14em] text-[var(--action-primary)]">
            {"// "}{typeLabel.toLowerCase()}
          </span>
          <TierBadge tier={call.confidence_tier} label={tierLabel} />
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-[var(--cream)] leading-snug mb-1 group-hover:text-[var(--action-primary)] transition-colors">
          {call.title}
        </h3>

        {/* Org name */}
        {orgName && (
          <p className="text-sm text-[var(--soft)] mb-3">{orgName}</p>
        )}

        {/* Divider */}
        <div className="border-t border-[var(--twilight)] mb-3" />

        {/* Deadline + fee row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`font-[family-name:var(--font-ibm-plex-mono)] text-xs font-medium ${deadlineClass}`}
          >
            {call.deadline
              ? `Deadline: ${deadlineDisplay}`
              : "Rolling deadline"}
          </span>
          <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)]">
            {feeDisplay}
          </span>
        </div>

        {/* Medium requirements pills */}
        {hasMediums && (
          <div className="flex flex-wrap gap-1.5">
            {call.medium_requirements!.slice(0, 6).map((medium) => (
              <span
                key={medium}
                className="inline-flex items-center px-2 py-0.5 border border-[var(--twilight)] font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-wider text-[var(--muted)]"
              >
                {medium.replace(/_/g, " ")}
              </span>
            ))}
            {call.medium_requirements!.length > 6 && (
              <span className="inline-flex items-center px-2 py-0.5 border border-[var(--twilight)] font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-wider text-[var(--muted)]">
                +{call.medium_requirements!.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    </a>
  );
});

export type { OpenCallCardProps };

// --- Sub-components ---

interface TierBadgeProps {
  tier: string;
  label: string;
}

function TierBadge({ tier, label }: TierBadgeProps) {
  if (tier === "verified") {
    return (
      <span className="flex-shrink-0 inline-flex items-center gap-1 font-[family-name:var(--font-ibm-plex-mono)] text-2xs font-medium uppercase tracking-wider text-[var(--action-primary)]">
        {label}
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label="Verified"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex-shrink-0 font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-wider text-[var(--muted)]">
      {label}
    </span>
  );
}

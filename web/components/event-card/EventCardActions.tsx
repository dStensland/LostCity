"use client";

import RSVPButton, { type RSVPStatus } from "@/components/RSVPButton";

interface EventCardActionsProps {
  eventId: number;
  handleRSVPChange: (newStatus: RSVPStatus, prevStatus: RSVPStatus) => void;
  isExternalLinkOut: boolean;
  linkOutUrl: string;
  linkOutLabel: string;
  isTicketLinkOut: boolean;
}

/**
 * Right-side action column for the comfortable-density EventCard row.
 * Contains the RSVP button and the optional link-out/ticket button.
 */
export function EventCardActions({
  eventId,
  handleRSVPChange,
  isExternalLinkOut,
  linkOutUrl,
  linkOutLabel,
  isTicketLinkOut,
}: EventCardActionsProps) {
  return (
    <div className="flex flex-col items-end gap-2 pt-2.5 pr-2.5 pb-2.5 sm:pt-3 sm:pr-3.5 sm:pb-3 flex-shrink-0">
      <div className="flex items-start gap-1.5 sm:gap-2">
        <div data-row-save-action="true">
          <RSVPButton
            eventId={eventId}
            variant="compact"
            onRSVPChange={handleRSVPChange}
            className="list-save-trigger"
          />
        </div>
        {isExternalLinkOut && (
          <a
            href={linkOutUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={linkOutLabel}
            data-row-open-action="true"
            style={{ touchAction: "manipulation" }}
            className="hidden sm:inline-flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_18px_var(--cta-glow,rgba(255,107,122,0.25))] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
          >
            {isTicketLinkOut ? (
              <svg
                className="w-4.5 h-4.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
            ) : (
              <svg
                className="w-4.5 h-4.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 3h7v7m0-7L10 14"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10v8a1 1 0 001 1h8"
                />
              </svg>
            )}
          </a>
        )}
      </div>
    </div>
  );
}

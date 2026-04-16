import Link from "next/link";
import {
  CalendarBlank,
  MapPin,
  Ticket,
  IdentificationBadge,
} from "@phosphor-icons/react";

interface QuickFactsCardProps {
  date: string;               // Pre-formatted (e.g., "Fri, Apr 18 · 7:00 PM")
  venueName: string | null;
  venueSlug: string | null;
  portalSlug: string;
  priceText: string | null;   // Pre-formatted (e.g., "$25 – $45" or "Free")
  agePolicy: string | null;   // e.g., "21+", "All Ages"
  /** "card" = vertical stack for desktop rail (default).
   *  "inline" = horizontal pill row for mobile below identity. */
  variant?: "card" | "inline";
}

export function QuickFactsCard({
  date,
  venueName,
  venueSlug,
  portalSlug,
  priceText,
  agePolicy,
  variant = "card",
}: QuickFactsCardProps) {
  const facts: { icon: React.ReactNode; text: React.ReactNode }[] = [];

  facts.push({
    icon: <CalendarBlank size={14} weight="regular" />,
    text: date,
  });

  if (venueName) {
    facts.push({
      icon: <MapPin size={14} weight="regular" />,
      text: venueSlug ? (
        <Link href={`/${portalSlug}/spots/${venueSlug}`} className="hover:underline">
          {venueName}
        </Link>
      ) : venueName,
    });
  }

  if (priceText) {
    facts.push({
      icon: <Ticket size={14} weight="regular" />,
      text: priceText,
    });
  }

  if (agePolicy) {
    facts.push({
      icon: <IdentificationBadge size={14} weight="regular" />,
      text: agePolicy,
    });
  }

  if (facts.length === 0) return null;

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
        {facts.map((fact, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="flex-shrink-0 text-[var(--soft)]">{fact.icon}</span>
            <span>{fact.text}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 p-3.5 flex flex-col gap-2.5">
      {facts.map((fact, i) => (
        <div key={i} className="flex items-start gap-2.5 text-xs text-[var(--muted)]">
          <span className="mt-0.5 flex-shrink-0 text-[var(--soft)]">{fact.icon}</span>
          <span>{fact.text}</span>
        </div>
      ))}
    </div>
  );
}

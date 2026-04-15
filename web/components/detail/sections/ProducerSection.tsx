"use client";

import SmartImage from "@/components/SmartImage";
import { Buildings } from "@phosphor-icons/react";
import type { SectionProps } from "@/lib/detail/types";

export function ProducerSection({ data, portalSlug }: SectionProps) {
  let producer: {
    id: string;
    name: string;
    slug: string;
    org_type?: string | null;
    logo_url?: string | null;
    website?: string | null;
  } | null = null;

  if (data.entityType === "event") {
    producer = data.payload.event.producer;
  }
  // Festival: no direct producer in payload — skip for now
  if (!producer) return null;

  const href = `/${portalSlug}?org=${producer.slug}`;

  return (
    <a
      href={href}
      className="flex items-center gap-3 w-full p-4 bg-[var(--night)] rounded-card border border-[var(--twilight)] hover:border-[var(--coral)]/40 transition-colors group focus-ring"
    >
      {/* Logo */}
      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--dusk)] flex items-center justify-center border border-[var(--twilight)]">
        {producer.logo_url ? (
          <SmartImage
            src={producer.logo_url}
            alt={producer.name}
            width={40}
            height={40}
            className="object-cover w-full h-full"
            fallback={
              <Buildings size={20} weight="duotone" className="text-[var(--muted)]" />
            }
          />
        ) : (
          <Buildings size={20} weight="duotone" className="text-[var(--muted)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--muted)] mb-0.5">
          Presented by
        </p>
        <p className="text-sm font-semibold text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
          {producer.name}
        </p>
        {producer.org_type && (
          <p className="text-xs text-[var(--muted)] truncate">{producer.org_type}</p>
        )}
      </div>

      <span className="text-[var(--muted)] flex-shrink-0">→</span>
    </a>
  );
}

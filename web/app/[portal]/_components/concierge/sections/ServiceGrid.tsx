"use client";

import { phoneHref } from "@/lib/concierge/concierge-types";
import type { InRoomRequest } from "@/lib/concierge/concierge-types";
import HotelSection from "../../hotel/HotelSection";

interface ServiceGridProps {
  services: InRoomRequest[];
  conciergePhone: string;
}

export default function ServiceGrid({ services, conciergePhone }: ServiceGridProps) {
  if (services.length === 0) return null;

  return (
    <HotelSection
      id="services"
      title="In-Room Services"
      subtitle="Request directly from your room"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 space-y-3"
          >
            <h3 className="font-display text-lg text-[var(--hotel-charcoal)]">{service.title}</h3>
            <p className="text-sm font-body text-[var(--hotel-stone)] leading-relaxed">{service.detail}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--hotel-stone)]">{service.etaLabel}</span>
              <a
                href={phoneHref(conciergePhone)}
                className="text-xs uppercase tracking-[0.15em] font-body text-[var(--hotel-champagne)] hover:text-[var(--hotel-brass)] transition-colors"
              >
                {service.ctaLabel} &rarr;
              </a>
            </div>
          </div>
        ))}
      </div>
    </HotelSection>
  );
}

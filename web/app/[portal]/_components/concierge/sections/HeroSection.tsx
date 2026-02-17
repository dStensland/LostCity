"use client";

import type { QuickAction } from "@/lib/concierge/concierge-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { phoneHref } from "@/lib/forth-types";

interface HeroSectionProps {
  greeting: { title: string; subtitle: string };
  quickActions: QuickAction[];
  heroPhoto: string;
  portalName: string;
  conciergePhone?: string;
}

export default function HeroSection({ greeting, quickActions, heroPhoto, portalName, conciergePhone }: HeroSectionProps) {
  const proxiedPhoto = getProxiedImageSrc(heroPhoto);
  const imgSrc = typeof proxiedPhoto === "string" ? proxiedPhoto : heroPhoto;

  return (
    <section className="relative w-full h-[40vh] max-h-[320px] md:aspect-[16/9] md:h-auto overflow-hidden rounded-2xl mb-10">
      <img
        src={imgSrc}
        alt={portalName}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
        <h1 className="font-display text-3xl md:text-4xl text-white tracking-tight mb-2">
          {greeting.title}
        </h1>
        <p className="font-body text-base text-white/80 max-w-xl mb-5">
          {greeting.subtitle}
        </p>
        <div className="flex flex-wrap gap-3">
          {conciergePhone && (
            <a
              href={phoneHref(conciergePhone)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[var(--hotel-charcoal)] text-sm font-body font-semibold hover:bg-white/90 active:bg-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Ask Concierge
            </a>
          )}
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              aria-label={`Jump to ${action.label} section`}
              onClick={() => {
                const target = document.getElementById(action.sectionId);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-sm font-body text-white hover:bg-white/25 active:bg-white/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

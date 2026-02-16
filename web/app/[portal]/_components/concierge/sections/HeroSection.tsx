"use client";

import type { QuickAction } from "@/lib/concierge/concierge-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface HeroSectionProps {
  greeting: { title: string; subtitle: string };
  quickActions: QuickAction[];
  heroPhoto: string;
  portalName: string;
}

export default function HeroSection({ greeting, quickActions, heroPhoto, portalName }: HeroSectionProps) {
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

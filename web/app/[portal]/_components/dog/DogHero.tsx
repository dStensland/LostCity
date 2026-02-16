import type { Portal } from "@/lib/portal-context";

interface Props {
  portal: Portal;
}

export default function DogHero({ portal }: Props) {
  const s = portal.settings ?? {};
  const hero = {
    headline: (s.dog_hero_headline as string) || "ROMP",
    subhead:
      (s.dog_hero_subhead as string) ||
      "Dog-friendly Atlanta. Events, parks, trails, patios — and the good stuff in between.",
    cta_text: (s.dog_hero_cta_text as string) || "Explore the map",
    cta_url: (s.dog_hero_cta_url as string) || "?view=find",
  };

  return (
    <section className="relative overflow-hidden px-4 pt-14 pb-10">
      {/* Subtle radial gradient behind the headline */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(255, 107, 53, 0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <h1
          className="dog-display text-6xl sm:text-7xl tracking-tighter"
          style={{ color: "var(--dog-charcoal)" }}
        >
          {hero.headline}
        </h1>
        <p
          className="mt-4 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
          style={{ color: "var(--dog-stone)" }}
        >
          {hero.subhead}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href={hero.cta_url} className="dog-btn-primary inline-block">
            {hero.cta_text}
          </a>
        </div>
      </div>
    </section>
  );
}

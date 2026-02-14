import Link from "next/link";
import ExpandableSection from "@/components/ExpandableSection";
import ParallaxHero from "@/components/ParallaxHero";
import ScrollHeader from "@/components/ScrollHeader";
import ScrollReveal from "@/components/ScrollReveal";
import FloatingElement from "@/components/home/FloatingElement";
import NeonDivider from "@/components/home/NeonDivider";
import GlowOrb from "@/components/home/GlowOrb";
import CategoryIcon from "@/components/CategoryIcon";
import { DEFAULT_PORTAL_SLUG, DEFAULT_PORTAL_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatCompactCount, safeJsonLd } from "@/lib/formats";
import { getSiteUrl } from "@/lib/site-url";

function formatStat(n: number): string {
  if (n >= 1000) {
    // Keep it short so it fits the 3-up stat cards on mobile (e.g. "10k+")
    return `${formatCompactCount(Math.floor(n / 100) * 100)}+`;
  }
  return n.toLocaleString();
}

async function getStats() {
  try {
    const supabase = await createClient();
    type NeighborhoodRow = { neighborhood: string | null };
    const [eventsResult, venuesResult, artistsResult] = await Promise.all([
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("start_date", new Date().toISOString().split("T")[0])
        .or("is_sensitive.eq.false,is_sensitive.is.null"),
      supabase.from("venues").select("*", { count: "exact", head: true }),
      supabase.from("artists").select("*", { count: "exact", head: true }),
    ]);
    // Distinct neighborhood count via unique values
    const { data: hoodData } = await supabase
      .from("venues")
      .select("neighborhood")
      .not("neighborhood", "is", null) as { data: { neighborhood: string }[] | null };
    const neighborhoods = new Set(
      ((hoodData as NeighborhoodRow[] | null) ?? []).map((v) => v.neighborhood).filter(Boolean)
    ).size;
    return {
      events: eventsResult.count || 0,
      venues: venuesResult.count || 0,
      artists: artistsResult.count || 0,
      neighborhoods,
    };
  } catch {
    return { events: 5000, venues: 500, artists: 500, neighborhoods: 100 };
  }
}

export default async function Home() {
  const stats = await getStats();
  const siteUrl = getSiteUrl();
  const homepageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Lost City - Find Your People",
    description: "Find your people. Discover the underground events, shows, and happenings in your city.",
    url: siteUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "Lost City",
      url: siteUrl,
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#08080c] relative overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(homepageSchema) }}
      />
      {/* Ambient glow orbs for atmosphere - hidden on mobile for performance */}
      <div className="hidden md:block">
        <GlowOrb color="cyan" size={400} top={30} left={20} blur={120} />
        <GlowOrb color="pink" size={350} top={60} left={80} blur={100} />
        <GlowOrb color="purple" size={300} top={85} left={30} blur={90} />
      </div>

      {/* Scroll-triggered header */}
      <ScrollHeader threshold={400} />

      {/* Hero */}
      <div className="relative">
        <ParallaxHero
          src="/hero-puddle.jpg"
          alt="LOST CITY neon sign reflected in a rain puddle"
          width={1920}
          height={814}
        />
        <div className="absolute inset-0 z-20 flex items-end pointer-events-none">
          <div className="w-full px-4 pb-6 md:pb-8">
            <div className="max-w-3xl mx-auto text-center">
              <p className="inline-flex items-center gap-3 md:gap-4 px-6 py-3 rounded-full bg-black/75 backdrop-blur-md border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <span className="text-[#00e5ff] text-xs md:text-sm font-bold tracking-[0.3em] uppercase">Off the screen</span>
                <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" />
                <span className="text-[#ff6b9d] text-xs md:text-sm font-bold tracking-[0.3em] uppercase">Into the world</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portal entry with parallax depth */}
      <ScrollReveal direction="up" className="px-4 pb-6 md:pb-8 relative z-10">
        <div className="max-w-lg mx-auto">
          {/* Section header */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-[#00e5ff]/40" />
            <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#00e5ff]/85">
              GO BE COMMUNITY
            </span>
            <div className="h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-[#00e5ff]/40" />
          </div>

          <FloatingElement speed={0.08} scale={0.02}>
            <Link
              href={`/${DEFAULT_PORTAL_SLUG}`}
              className="group relative block w-full h-64 md:h-80 rounded-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00e5ff]/50 focus-visible:ring-offset-4 focus-visible:ring-offset-[#08080c]"
            >
              {/* Skyline background */}
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-110 bg-[url('/portals/atlanta/jackson-st-bridge.jpg')]" />

              {/* Color grade overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(8,8,12,0.95)_0%,rgba(8,8,12,0.4)_50%,rgba(20,10,30,0.3)_100%)]" />

              {/* Animated border glow */}
              <div className="absolute inset-0 rounded-2xl border border-[#2a2a34] group-hover:border-[#00e5ff]/30 transition-colors duration-700" />
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 home-portal-glow" />

              {/* Corner accents */}
              <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-[#00e5ff]/30 rounded-tl group-hover:border-[#00e5ff] group-hover:w-8 group-hover:h-8 transition-all duration-500" />
              <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-[#ff6b9d]/30 rounded-tr group-hover:border-[#ff6b9d] group-hover:w-8 group-hover:h-8 transition-all duration-500" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-[#ff6b9d]/30 rounded-bl group-hover:border-[#ff6b9d] group-hover:w-8 group-hover:h-8 transition-all duration-500" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-[#00e5ff]/30 rounded-br group-hover:border-[#00e5ff] group-hover:w-8 group-hover:h-8 transition-all duration-500" />

              {/* Scan line effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00e5ff]/50 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
              </div>

              {/* Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                {/* City name - large and prominent */}
                <div className="text-center">
                  <span className="block text-sm uppercase tracking-[0.3em] text-[var(--cream)]/60 mb-2 group-hover:text-[#00e5ff]/80 transition-colors duration-300">
                    Explore
                  </span>
                  <div className="relative">
                    <span className="block text-4xl md:text-6xl font-bold tracking-tight text-white group-hover:opacity-0 transition-opacity duration-300">
                      {DEFAULT_PORTAL_NAME}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center text-4xl md:text-6xl font-bold tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-300 home-gradient-text-animated whitespace-nowrap">
                      {DEFAULT_PORTAL_NAME}
                    </span>
                  </div>
                </div>

                {/* Enter button */}
                <div className="mt-8 px-6 py-3 rounded-full border-2 border-[#00e5ff]/30 bg-[#00e5ff]/5 group-hover:border-[#00e5ff] group-hover:bg-[#00e5ff]/15 transition-all duration-500 shadow-lg shadow-[#00e5ff]/10">
                  <span className="text-sm font-mono tracking-[0.2em] uppercase text-[#00e5ff]/80 group-hover:text-[#00e5ff] transition-colors duration-300 flex items-center gap-2">
                    Enter Portal
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Pulse indicator */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e5ff]" />
                </span>
                <span className="text-[0.6rem] font-mono uppercase tracking-wider text-[#00e5ff] hidden md:inline">Live</span>
              </div>
            </Link>
          </FloatingElement>
        </div>
      </ScrollReveal>

      {/* Stats — staggered reveal */}
      <div className="px-4 pb-10 md:pb-14 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {[
              { value: formatStat(stats.events), label: "events", colorClass: "home-stat-cyan" },
              { value: formatStat(stats.venues), label: "venues", colorClass: "home-stat-pink" },
              { value: formatStat(stats.artists), label: "artists", colorClass: "home-stat-purple" },
              { value: formatStat(stats.neighborhoods), label: "hoods", colorClass: "home-stat-cyan" },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} direction="up" delay={i * 100}>
                <div className="text-center p-4 md:p-6 rounded-lg border border-[#1a1a24] hover:border-[#2a2a34] home-stat-card transition-all duration-300 group">
                  <div className={`text-[clamp(1.75rem,5vw,3.25rem)] font-semibold tracking-tight mb-1 leading-none tabular-nums whitespace-nowrap ${stat.colorClass}`}>
                    {stat.value}
                  </div>
                  <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-[var(--cream)]/70 group-hover:text-[var(--cream)] transition-colors">
                    {stat.label}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>

      {/* Neon divider */}
      <NeonDivider className="max-w-4xl mx-auto mb-10 md:mb-14" />

      {/* Philosophy section with staggered paragraphs */}
      <section className="px-4 pb-10 md:pb-14 relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Main pitch - each line fades in */}
          <div className="mb-8 md:mb-10 space-y-4">
            <ScrollReveal direction="up" delay={0}>
              <p className="text-base md:text-lg text-[var(--soft)] leading-relaxed">
                We&apos;re of a mind that if it&apos;s easier for people to find cool
                stuff to do, more people will go do cool stuff.
              </p>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={150}>
              <p className="text-base md:text-lg text-[var(--soft)] leading-relaxed">
                When more people go do cool stuff, other people make more cool stuff to go do.
              </p>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={300}>
              <p className="text-2xl md:text-3xl font-bold home-gradient-text-animated leading-relaxed">
                Everything gets better. It&apos;s just math.
              </p>
            </ScrollReveal>
          </div>

          {/* Details with left border accent */}
          <div className="space-y-6">
            <ScrollReveal direction="left">
              <div className="pl-6 border-l-2 border-[#00e5ff]/30 hover:border-[#00e5ff]/60 transition-colors duration-300">
                <p className="text-[var(--soft)] leading-relaxed text-sm md:text-base">
                  Lost City crawls hundreds of sources across the city — venues, promoters,
                  galleries, breweries, theaters, clubs, nonprofits — so you don&apos;t
                  have to check a dozen websites. Shows, classes, openings, pop-ups, free
                  stuff. It&apos;s all here.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={100}>
              <div className="pl-6 border-l-2 border-[#ff6b9d]/30 hover:border-[#ff6b9d]/60 transition-colors duration-300">
                <p className="text-[var(--soft)] leading-relaxed text-sm md:text-base">
                  See where your people are headed, coordinate plans without the group text
                  chaos, and discover things through people you actually trust.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="left" delay={200}>
              <div className="pl-6 border-l-2 border-[#b06bff]/30 hover:border-[#b06bff]/60 transition-colors duration-300">
                <p className="text-[var(--soft)] leading-relaxed text-sm md:text-base">
                  Not drowning you with ads. No annoying subscriptions. No algorithm trying to
                  keep you scrolling braindead forever. Just a simple way to find cool stuff
                  happening nearby so you can get off your butt, put your screens down, and
                  get out into it.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Neon divider */}
      <NeonDivider variant="pink" className="max-w-3xl mx-auto mb-10 md:mb-14" />

      {/* Categories with hover effects */}
      <ScrollReveal direction="up" className="px-4 pb-10 md:pb-14 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[var(--cream)]/70 text-xs uppercase tracking-[0.3em] mb-6">
            What&apos;s on tonight?
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 md:gap-3 mb-8">
            {[
              { label: "Music", icon: "music", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=music`, color: "cyan" },
              { label: "Comedy", icon: "comedy", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=comedy`, color: "pink" },
              { label: "Art", icon: "art", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=art`, color: "purple" },
              { label: "Theater", icon: "theater", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=theater`, color: "cyan" },
              { label: "Food & Drink", icon: "food_drink", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=food_drink`, color: "pink" },
              { label: "Nightlife", icon: "nightlife", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=nightlife`, color: "purple" },
              { label: "Sports", icon: "sports", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=sports`, color: "cyan" },
              { label: "Outdoors", icon: "outdoors", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=outdoors`, color: "pink" },
              { label: "Community", icon: "community", href: `/${DEFAULT_PORTAL_SLUG}?view=find&categories=community`, color: "purple" },
              { label: "Free", icon: "other", href: `/${DEFAULT_PORTAL_SLUG}?view=find&free=1`, color: "cyan" },
            ].map((cat, i) => (
              <ScrollReveal key={cat.label} direction="fade" delay={i * 40}>
                <Link
                  href={cat.href}
                  className={`group inline-flex items-center gap-2 px-4 py-3 md:py-2.5 text-xs font-semibold rounded-full border transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080c] ${
                    cat.color === "cyan"
                      ? "border-[#00e5ff]/20 text-[var(--soft)] hover:text-[#00e5ff] hover:border-[#00e5ff]/60 hover:bg-[#00e5ff]/10 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)] focus-visible:ring-[#00e5ff]/60"
                      : cat.color === "pink"
                      ? "border-[#ff6b9d]/20 text-[var(--soft)] hover:text-[#ff6b9d] hover:border-[#ff6b9d]/60 hover:bg-[#ff6b9d]/10 hover:shadow-[0_0_20px_rgba(255,107,157,0.15)] focus-visible:ring-[#ff6b9d]/60"
                      : "border-[#b06bff]/20 text-[var(--soft)] hover:text-[#b06bff] hover:border-[#b06bff]/60 hover:bg-[#b06bff]/10 hover:shadow-[0_0_20px_rgba(176,107,255,0.15)] focus-visible:ring-[#b06bff]/60"
                  }`}
                >
                  <CategoryIcon
                    type={cat.icon}
                    size={16}
                    glow="none"
                    className={`transition-colors duration-300 ${
                      cat.color === "cyan"
                        ? "text-[#00e5ff]/60 group-hover:text-[#00e5ff]"
                        : cat.color === "pink"
                        ? "text-[#ff6b9d]/60 group-hover:text-[#ff6b9d]"
                        : "text-[#b06bff]/60 group-hover:text-[#b06bff]"
                    }`}
                  />
                  {cat.label}
                </Link>
              </ScrollReveal>
            ))}
          </div>
          <ScrollReveal direction="up" delay={400}>
            <Link
              href={`/${DEFAULT_PORTAL_SLUG}?view=find&date=today`}
              className="inline-flex items-center gap-3 text-base font-medium transition-all duration-300 hover:gap-4 home-gradient-text-animated rounded-lg px-2 py-1 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080c]"
            >
              See what&apos;s happening today
              <span className="text-[#00e5ff] text-xl">→</span>
            </Link>
          </ScrollReveal>
        </div>
      </ScrollReveal>

      {/* Neon divider */}
      <NeonDivider variant="cyan" className="max-w-2xl mx-auto mb-8 md:mb-10" />

      {/* Fine print - cleaner with subtle reveals */}
      <div className="px-4 pb-8 md:pb-10 relative z-10">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal direction="up">
            <ExpandableSection title="About the Platform">
              <p>
                Lost City is a series of portals allowing you to explore
                what&apos;s going on in and around different locations.
              </p>
              <div>
                <p className="text-[var(--cream)] font-medium mb-3">
                  You can do things like:
                </p>
                <ul className="space-y-3 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="text-[#00e5ff] mt-0.5">◆</span>
                    <span>Find events and destinations that are worthy of checking out</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#00e5ff] mt-0.5">◆</span>
                    <span>Keep a calendar going here, link with whatever your normal one is</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#ff6b9d] mt-0.5">◆</span>
                    <span>Add your friends, invite them out, see where they&apos;re interested</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#ff6b9d] mt-0.5">◆</span>
                    <span>Follow venues and organizations that are always throwing good stuff</span>
                  </li>
                </ul>
              </div>
            </ExpandableSection>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={100}>
            <ExpandableSection title="Our Philosophy">
              <p>
                The current event discovery space isn&apos;t the best. There are
                large platforms mostly focused on ticketing, other large social
                platforms who just want you doomscrolling all day, and also just a
                ton of people off doing their own thing. We&apos;re leveraging fancy
                new tech to bring it all together.
              </p>
              <p>
                Lost City is designed as an{" "}
                <span className="text-[#00e5ff] font-medium">anti-platform</span>.
                A series of portals for cities, businesses, conferences, events
                that can share info between them or just go off and do their own thing.
              </p>
            </ExpandableSection>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200}>
            <ExpandableSection title="Why AI?">
              <p>
                AI is a dirty word in some circles. At Lost City we use AI as a{" "}
                <span className="text-[#ff6b9d] font-medium">technical enabler</span>.
                Some of the architecture we employ would frankly be quite stupid
                without modern AI capabilities when it comes to generating web crawlers.
              </p>
              <p>
                We&apos;ll continue to explore the latest tech, but always with the goal
                of celebrating true blue human creators and getting people connected
                in the real world.
              </p>
            </ExpandableSection>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={300}>
            <ExpandableSection title="Want Your City Portal?">
              <p>
                Interested in a comprehensive events platform for your city, conference,
                or big event? We can get something special going for you.
              </p>
              <div className="mt-4 font-mono">
                <a
                  href="mailto:coach@lostcity.ai"
                  className="inline-flex items-center gap-2 hover:gap-3 transition-all duration-300 home-gradient-text-animated"
                >
                  coach@lostcity.ai →
                </a>
              </div>
            </ExpandableSection>
          </ScrollReveal>
        </div>
      </div>

      {/* Contact with glow card */}
      <ScrollReveal direction="up" className="px-4 py-8 md:py-12 relative z-10">
        <FloatingElement speed={-0.03}>
          <div className="max-w-md mx-auto p-8 rounded-2xl border border-[#1a1a24] home-contact-card relative overflow-hidden">
            {/* Subtle animated gradient background */}
            <div className="absolute inset-0 opacity-30 home-contact-auras" />
            <div className="relative">
              <p className="text-[var(--muted)] leading-relaxed mb-5">
                Got ideas, questions, feedback, or just want to chat?
                We&apos;re here.
              </p>
              <div className="font-mono">
                <div className="text-[var(--cream)] font-medium mb-1">Coach</div>
                <a
                  href="mailto:coach@lostcity.ai"
                  className="text-[#00e5ff] hover:text-[#ff6b9d] transition-colors text-lg"
                >
                  coach@lostcity.ai
                </a>
              </div>
            </div>
          </div>
        </FloatingElement>
      </ScrollReveal>

      {/* Footer */}
      <div className="mt-auto px-4 py-10 text-center border-t border-[#1a1a24] relative z-10">
        <div className="flex items-center justify-center gap-6">
          <Link
            href="/privacy"
            className="font-mono text-xs text-[var(--soft)] hover:text-[#00e5ff] focus-visible:text-[#00e5ff] focus-visible:outline-none rounded px-1 transition-colors"
          >
            Privacy
          </Link>
          <span className="text-[#2a2a34]">◆</span>
          <Link
            href="/terms"
            className="font-mono text-xs text-[var(--soft)] hover:text-[#00e5ff] focus-visible:text-[#00e5ff] focus-visible:outline-none rounded px-1 transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}

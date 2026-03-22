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
import { safeJsonLd } from "@/lib/formats";
import { getSiteUrl } from "@/lib/site-url";

// Static brag stats — updated periodically, not worth blocking page render.
// Last verified: 2026-03-12 against Supabase.
// Real counts: 26,192 future events, 1,334 total sources, 5,411 venues,
// 262 neighborhoods. 659 sources active.
const STATS = [
  { value: "26k+", label: "events", colorClass: "home-stat-cyan" },
  { value: "1.3k+", label: "sources", colorClass: "home-stat-pink" },
  { value: "5.4k+", label: "venues", colorClass: "home-stat-purple" },
  { value: "260+", label: "hoods", colorClass: "home-stat-cyan" },
];

export default function Home() {
  const siteUrl = getSiteUrl();
  const homepageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Lost City - Find Your Thing and Do It",
    description: "Find your thing and do it. Events, destinations, and everything worth doing in your city.",
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
      <div className="px-4 pb-6 md:pb-8 relative z-10">
        <div className="max-w-lg mx-auto">
          {/* Section header */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-[#00e5ff]/40" />
            <span className="text-xs uppercase tracking-[0.4em] text-[#00e5ff]/85">
              FIND YOUR THING AND DO IT
            </span>
            <div className="h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-[#00e5ff]/40" />
          </div>

          <FloatingElement speed={0.08} scale={0.02}>
            <Link
              href={`/${DEFAULT_PORTAL_SLUG}`}
              prefetch
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
                <span className="text-2xs font-mono uppercase tracking-wider text-[#00e5ff] hidden md:inline">Live</span>
              </div>
            </Link>
          </FloatingElement>
        </div>
      </div>

      {/* Pillar portals — coming soon previews */}
      <div className="px-4 pb-8 md:pb-10 relative z-10">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-2 gap-3">

            {/* ── LOST CITIZEN ─────────────────────────────────────
                Editorial / newspaper. White card. Left teal bar.
                "SHOW UP." is the hero — massive ghost type behind.
                Teal rules as texture. Broadsheet energy.
            ──────────────────────────────────────────────────────── */}
            <ScrollReveal direction="up" delay={0}>
              <div
                className="relative overflow-hidden rounded-xl h-full flex flex-col"
                style={{
                  backgroundColor: "#F5F4F1",
                  borderLeft: "4px solid #2D6A4F",
                  minHeight: "220px",
                }}
              >
                {/* Ghost headline — watermark at bottom-right, doesn't compete */}
                <div
                  className="absolute bottom-2 right-2 pointer-events-none select-none overflow-hidden"
                  aria-hidden
                >
                  <span
                    className="font-[family-name:var(--font-masthead)] leading-none whitespace-nowrap"
                    style={{
                      fontSize: "clamp(2rem, 9vw, 3.5rem)",
                      color: "#2D6A4F",
                      opacity: 0.12,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    SHOW UP.
                  </span>
                </div>

                {/* Teal rule lines — editorial texture */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: "#2D6A4F" }} />
                <div className="absolute top-2 left-4 right-4 h-px" style={{ backgroundColor: "#2D6A4F", opacity: 0.15 }} />
                <div className="absolute top-4 left-4 right-4 h-px" style={{ backgroundColor: "#2D6A4F", opacity: 0.08 }} />

                {/* Content */}
                <div className="relative flex flex-col flex-1 p-3 pt-4">
                  {/* Category stamp */}
                  <div
                    className="self-start mb-3"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#2D6A4F",
                      borderBottom: "1px solid #2D6A4F",
                      paddingBottom: "2px",
                    }}
                  >
                    Civic
                  </div>

                  {/* Wordmark lockup */}
                  <div className="mb-3">
                    <div
                      className="font-[family-name:var(--font-mono)]"
                      style={{ fontSize: "7px", fontWeight: 500, letterSpacing: "0.35em", color: "#2D6A4F", textTransform: "uppercase" }}
                    >
                      Lost
                    </div>
                    <div
                      className="font-[family-name:var(--font-masthead)] leading-[0.85]"
                      style={{ fontSize: "clamp(2.2rem, 10vw, 3rem)", color: "#1A3A2A", letterSpacing: "0.02em" }}
                    >
                      CITIZEN
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div style={{ width: "24px", height: "2px", backgroundColor: "#2D6A4F" }} />
                      <span
                        className="font-[family-name:var(--font-serif)] italic"
                        style={{ fontSize: "11px", color: "#2D6A4F" }}
                      >
                        show up.
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: "10px", lineHeight: 1.55, color: "#2A2A24" }} className="flex-1">
                    Get involved and stay informed.
                  </p>

                  {/* Bottom rule + label */}
                  <div className="mt-3 pt-2 flex items-center justify-between" style={{ borderTop: "1px solid #2D6A4F40" }}>
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#2D6A4F" }}
                    >
                      Coming soon
                    </span>
                    <span style={{ color: "#2D6A4F", fontSize: "12px" }}>→</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── LOST TRACK ────────────────────────────────────────
                Nordic Brutalist. Cream bg. Heavy black border.
                Zero radius. "WANDER" bleeds off the top edge.
                Terracotta hit. Space Grotesk heavy.
            ──────────────────────────────────────────────────────── */}
            <ScrollReveal direction="up" delay={80}>
              <div
                className="relative overflow-hidden h-full flex flex-col font-[family-name:var(--font-display-alt)]"
                style={{
                  backgroundColor: "#F0EDE8",
                  border: "3px solid #1A1A1A",
                  borderRadius: "0",
                  minHeight: "220px",
                }}
              >
                {/* Terracotta top band with wordmark */}
                <div
                  className="w-full overflow-hidden relative"
                  style={{ height: "80px", backgroundColor: "#C45A3B" }}
                >
                  {/* Stacked wordmark: LOST over TRACK */}
                  <div className="absolute left-2.5 top-1.5">
                    <div
                      className="font-[family-name:var(--font-mono)]"
                      style={{ fontSize: "7px", fontWeight: 500, letterSpacing: "0.5em", color: "#F0EDE8", opacity: 0.7, textTransform: "uppercase" }}
                    >
                      Lost
                    </div>
                    <div
                      className="font-[family-name:var(--font-display-alt)] font-bold leading-[0.8]"
                      style={{ fontSize: "clamp(2.8rem, 12vw, 4rem)", color: "#F0EDE8", letterSpacing: "-0.02em" }}
                    >
                      TRACK
                    </div>
                  </div>

                  {/* Label stamp top-right */}
                  <div
                    className="absolute top-2 right-2"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#F0EDE8", opacity: 0.8 }}
                  >
                    Adventure
                  </div>
                </div>

                {/* Below the band — content sits on cream */}
                <div className="flex flex-col flex-1 px-3 pt-3 pb-3">
                  {/* Tagline */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <div style={{ width: "16px", height: "2px", backgroundColor: "#C45A3B" }} />
                    <span
                      className="font-[family-name:var(--font-display-alt)] font-semibold"
                      style={{ fontSize: "clamp(0.7rem, 3vw, 0.8rem)", letterSpacing: "0.04em", color: "#1A1A1A" }}
                    >
                      Wander out yonder.
                    </span>
                  </div>

                  <p style={{ fontSize: "10px", lineHeight: 1.55, color: "#3A3530", flex: 1 }}>
                    Trails, camps, and outdoor adventures worth the drive.
                  </p>

                  {/* Heavy border bottom label */}
                  <div
                    className="mt-3 pt-2 flex items-center justify-between"
                    style={{ borderTop: "2px solid #1A1A1A" }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1A1A1A" }}>
                      Coming soon
                    </span>
                    <span style={{ fontFamily: "var(--font-display-alt)", fontSize: "14px", fontWeight: 900, color: "#C45A3B" }}>↗</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── LOST YOUTH ────────────────────────────────────────
                Warm Saturday morning energy. Light cream surface.
                Outfit font — rounded, friendly, not condensed.
                Bright amber top band. Playful but tasteful.
                Round corners, warm and inviting.
            ──────────────────────────────────────────────────────── */}
            <ScrollReveal direction="up" delay={160}>
              <div
                className="relative overflow-hidden rounded-2xl h-full flex flex-col"
                style={{
                  backgroundColor: "#FFFBF2",
                  minHeight: "220px",
                  border: "2px solid #F0E6D2",
                }}
              >
                {/* Bright amber top band — sunshine energy */}
                <div
                  className="w-full relative"
                  style={{ height: "8px", backgroundColor: "#E8830A" }}
                />

                {/* Warm sunshine glow from top */}
                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none"
                  style={{
                    height: "80px",
                    background: "radial-gradient(ellipse at 50% 0%, #E8830A12 0%, transparent 70%)",
                  }}
                  aria-hidden
                />

                <div className="relative flex flex-col flex-1 p-3.5 pt-3">
                  {/* Small label */}
                  <div
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: "8px",
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#E8830A",
                      marginBottom: "8px",
                    }}
                  >
                    Family
                  </div>

                  {/* Wordmark: brand name big, tagline small — matches other cards */}
                  <div className="mb-3">
                    <div
                      className="font-[family-name:var(--font-outfit)] leading-[0.92]"
                      style={{ fontSize: "7px", fontWeight: 600, letterSpacing: "0.35em", color: "#E8830A", textTransform: "uppercase" }}
                    >
                      Lost
                    </div>
                    <div
                      className="font-[family-name:var(--font-outfit)] leading-[0.88]"
                      style={{ fontSize: "clamp(2.2rem, 10vw, 3rem)", fontWeight: 800, color: "#2A2017", letterSpacing: "-0.01em" }}
                    >
                      Youth
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <svg width="20" height="6" viewBox="0 0 20 6" fill="none" style={{ opacity: 0.5 }}>
                        <path d="M0 3C2 1 3 1 5 3C7 5 8 5 10 3C12 1 13 1 15 3C17 5 18 5 20 3" stroke="#E8830A" strokeWidth="1.5" fill="none" />
                      </svg>
                      <span
                        className="font-[family-name:var(--font-outfit)]"
                        style={{ fontSize: "11px", fontWeight: 600, color: "#E8830A", letterSpacing: "0.02em" }}
                      >
                        go play.
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: "10px", lineHeight: 1.55, color: "#5C5040", flex: 1 }}>
                    Explore and organize adventures and activities with your family.
                  </p>

                  <div
                    className="mt-3 pt-2 flex items-center justify-between"
                    style={{ borderTop: "1.5px solid #E8830A30" }}
                  >
                    <span style={{ fontFamily: "var(--font-outfit)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#E8830A" }}>
                      Coming soon
                    </span>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "#E8830A",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        color: "#FFFBF2",
                        fontWeight: 900,
                      }}
                    >
                      →
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── LOST ARTS ─────────────────────────────────────────
                Gallery opening. Near-black canvas. Copper hairline.
                "Lost Arts" in MASSIVE italic serif — type AS art.
                Copper stroke label box. JetBrains mono metadata.
                Zero radius, no gradients. The art IS the space.
            ──────────────────────────────────────────────────────── */}
            <ScrollReveal direction="up" delay={240}>
              <div
                className="relative overflow-hidden h-full flex flex-col"
                style={{
                  backgroundColor: "#0E0C0A",
                  border: "1px solid #C9874F",
                  borderRadius: "2px",
                  minHeight: "220px",
                }}
              >
                {/* Corner registration marks — gallery aesthetic */}
                <div className="absolute top-2 left-2 pointer-events-none" aria-hidden>
                  <div style={{ width: "12px", height: "1px", backgroundColor: "#C9874F", opacity: 0.5 }} />
                  <div style={{ width: "1px", height: "12px", backgroundColor: "#C9874F", opacity: 0.5, marginTop: "-1px" }} />
                </div>
                <div className="absolute top-2 right-2 pointer-events-none" aria-hidden>
                  <div style={{ width: "12px", height: "1px", backgroundColor: "#C9874F", opacity: 0.5, marginLeft: "auto" }} />
                  <div style={{ width: "1px", height: "12px", backgroundColor: "#C9874F", opacity: 0.5, marginTop: "-1px", marginLeft: "11px" }} />
                </div>
                <div className="absolute bottom-2 left-2 pointer-events-none" aria-hidden>
                  <div style={{ width: "1px", height: "12px", backgroundColor: "#C9874F", opacity: 0.5 }} />
                  <div style={{ width: "12px", height: "1px", backgroundColor: "#C9874F", opacity: 0.5 }} />
                </div>

                <div className="relative flex flex-col flex-1 p-3 pt-5">
                  {/* Stroke-only label */}
                  <div
                    className="self-start mb-4"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      fontWeight: 500,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "#C9874F",
                      border: "1px solid #C9874F",
                      padding: "2px 5px",
                    }}
                  >
                    Creative
                  </div>

                  {/* Wordmark: // lost prefix + massive italic Arts */}
                  <div className="flex-1 flex flex-col justify-center">
                    <div
                      className="font-[family-name:var(--font-mono)]"
                      style={{ fontSize: "9px", color: "#C9874F", opacity: 0.5, letterSpacing: "0.1em" }}
                    >
                      // lost
                    </div>
                    <div
                      className="font-[family-name:var(--font-serif)] italic leading-[0.8]"
                      style={{
                        fontSize: "clamp(3.5rem, 16vw, 5rem)",
                        color: "#F0EBE3",
                        letterSpacing: "-0.03em",
                        marginTop: "-2px",
                      }}
                    >
                      Arts
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div style={{ width: "20px", height: "1px", backgroundColor: "#C9874F", opacity: 0.5 }} />
                      <span
                        className="font-[family-name:var(--font-mono)]"
                        style={{ fontSize: "9px", color: "#C9874F", letterSpacing: "0.08em" }}
                      >
                        scene, surfaced.
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: "10px", lineHeight: 1.55, color: "#9A8F84", marginBottom: "10px" }}>
                    Exhibitions, open calls, and support for local artists.
                  </p>

                  {/* Bottom copper rule + label */}
                  <div
                    className="flex items-center justify-between pt-2"
                    style={{ borderTop: "1px solid #C9874F", opacity: 0.6 }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#C9874F", opacity: 1 }}>
                      Coming soon
                    </span>
                    <span style={{ color: "#C9874F", fontSize: "11px", fontFamily: "var(--font-mono)" }}>_</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── LOST SEASON ───────────────────────────────────────
                Stadium navy. Yellow LED tick strip at top.
                Font-mono wordmark. No-fuss sports energy.
                Heavy left edge. Electric yellow accent.
            ──────────────────────────────────────────────────────── */}
            <ScrollReveal direction="up" delay={320}>
              <div
                className="overflow-hidden h-full flex flex-col"
                style={{
                  backgroundColor: "#0A0E1A",
                  border: "1px solid rgba(245,230,66,0.25)",
                  borderLeft: "3px solid rgba(245,230,66,0.7)",
                  borderRadius: "4px",
                  minHeight: "220px",
                }}
              >
                {/* LED tick strip */}
                <div
                  className="relative flex-shrink-0"
                  style={{ height: "16px", backgroundColor: "#0A0E1A" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: "4px",
                          height: "6px",
                          backgroundColor: "#F5E642",
                          opacity: i % 3 === 0 ? 0.8 : 0.12,
                          borderRadius: "0.5px",
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-3 pt-2">
                  {/* Category stamp */}
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#F5E642",
                      marginBottom: "12px",
                    }}
                  >
                    Sports
                  </div>

                  {/* Wordmark */}
                  <div className="mb-2">
                    <div
                      className="font-[family-name:var(--font-mono)]"
                      style={{ fontSize: "7px", fontWeight: 500, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(245,230,66,0.6)" }}
                    >
                      Lost
                    </div>
                    <div
                      className="font-[family-name:var(--font-masthead)] leading-[0.85]"
                      style={{ fontSize: "clamp(2.8rem, 12vw, 4rem)", color: "#F0F0EC", letterSpacing: "-0.01em" }}
                    >
                      SEASON
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div style={{ width: "20px", height: "2px", backgroundColor: "#F5E642" }} />
                      <span
                        className="font-[family-name:var(--font-mono)]"
                        style={{ fontSize: "9px", color: "#F5E642", letterSpacing: "0.06em" }}
                      >
                        in the game.
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: "10px", lineHeight: 1.55, color: "#8A8FA8", flex: 1 }}>
                    Every team, every league, every game day in Atlanta.
                  </p>

                  {/* Bottom bar */}
                  <div
                    className="mt-3 pt-2 flex items-center justify-between"
                    style={{ borderTop: "1px solid rgba(245,230,66,0.2)" }}
                  >
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#F5E642" }}
                    >
                      Coming soon
                    </span>
                    <span
                      className="font-[family-name:var(--font-masthead)]"
                      style={{ fontSize: "14px", color: "#F5E642" }}
                    >
                      01
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* ── LOST TRADES ───────────────────────────────────────
                Warm off-black. Ghost business card decoration.
                Slate blue accents. IBM Plex Mono + italic serif.
                Stroke box label. Professional but not stuffy.
            ──────────────────────────────────────────────────────── */}
            <ScrollReveal direction="up" delay={400}>
              <div
                className="relative overflow-hidden h-full flex flex-col"
                style={{
                  backgroundColor: "#111009",
                  border: "1px solid rgba(79,124,172,0.35)",
                  borderRadius: "8px",
                  minHeight: "220px",
                }}
              >
                {/* Ghost business card decoration */}
                <div
                  className="absolute pointer-events-none"
                  aria-hidden
                  style={{
                    bottom: "8px",
                    right: "8px",
                    zIndex: 0,
                    width: "80px",
                    height: "50px",
                    transform: "rotate(-8deg)",
                    border: "1px solid rgba(79,124,172,0.35)",
                    backgroundColor: "rgba(79,124,172,0.06)",
                    borderRadius: "2px",
                  }}
                >
                  {/* Horizontal rules inside ghost card */}
                  <div style={{ position: "absolute", top: "30%", left: "8px", right: "8px", height: "1px", backgroundColor: "rgba(79,124,172,0.2)" }} />
                  <div style={{ position: "absolute", top: "65%", left: "8px", right: "8px", height: "1px", backgroundColor: "rgba(79,124,172,0.2)" }} />
                  {/* 3×3 dot grid bottom-right */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "6px",
                      right: "6px",
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 2px)",
                      gap: "2px",
                    }}
                  >
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        style={{ width: "2px", height: "2px", borderRadius: "50%", backgroundColor: "rgba(79,124,172,0.2)" }}
                      />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="relative flex flex-col flex-1 p-3 pt-5" style={{ zIndex: 10 }}>
                  {/* Stroke-only label */}
                  <div
                    className="self-start mb-2"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      fontWeight: 500,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "#4F7CAC",
                      border: "1px solid #4F7CAC",
                      padding: "2px 5px",
                    }}
                  >
                    Professional
                  </div>

                  {/* Wordmark */}
                  <div className="mb-3 flex-1 flex flex-col justify-center">
                    <div
                      className="font-[family-name:var(--font-mono)]"
                      style={{ fontSize: "9px", color: "#4F7CAC", opacity: 0.5, letterSpacing: "0.1em" }}
                    >
                      // lost
                    </div>
                    <div
                      className="font-[family-name:var(--font-serif)] italic leading-[0.85]"
                      style={{ fontSize: "clamp(3rem, 14vw, 4.2rem)", color: "#F0EBE2", letterSpacing: "-0.02em", marginTop: "-2px" }}
                    >
                      Trades
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div style={{ width: "20px", height: "1px", backgroundColor: "#4F7CAC", opacity: 0.5 }} />
                      <span
                        className="font-[family-name:var(--font-mono)]"
                        style={{ fontSize: "9px", color: "#4F7CAC", letterSpacing: "0.06em" }}
                      >
                        where work gets interesting.
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: "10px", lineHeight: 1.55, color: "#7A7268", marginBottom: "10px" }}>
                    Conferences, networking, and career events worth showing up for.
                  </p>

                  {/* Bottom bar */}
                  <div
                    className="flex items-center justify-between pt-2"
                    style={{ borderTop: "1px solid rgba(79,124,172,0.25)", opacity: 0.6 }}
                  >
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#4F7CAC", opacity: 1 }}
                    >
                      Coming soon
                    </span>
                    {/* 3×3 micro dot grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1.5px)", gap: "2px" }}>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div
                          key={i}
                          style={{ width: "1.5px", height: "1.5px", borderRadius: "50%", backgroundColor: "rgba(79,124,172,0.4)" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </div>

      {/* Stats — staggered reveal */}
      <div className="px-4 pb-10 md:pb-14 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {STATS.map((stat, i) => (
              <ScrollReveal key={stat.label} direction="up" delay={i * 100}>
                <div className="text-center p-4 md:p-6 rounded-lg border border-[#1a1a24] hover:border-[#2a2a34] home-stat-card transition-all duration-300 group overflow-hidden">
                  <div className={`text-[clamp(1.5rem,4.5vw,3.25rem)] font-semibold tracking-tight mb-1 leading-none tabular-nums ${stat.colorClass}`}>
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
                Your city is full of places to go and things to do. We show you
                all of it — events, destinations, spots worth checking out — so
                you can find your thing and go do it.
              </p>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={150}>
              <p className="text-base md:text-lg text-[var(--soft)] leading-relaxed">
                When it&apos;s easy to find cool stuff, more people go do cool stuff.
                When more people show up, more cool stuff gets made.
              </p>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={300}>
              <p className="text-2xl md:text-3xl font-bold text-[var(--cream)] leading-relaxed">
                Everything gets better. It&apos;s just math.
              </p>
            </ScrollReveal>
          </div>

          {/* Details with left border accent */}
          <div className="space-y-6">
            <ScrollReveal direction="left">
              <div className="pl-6 border-l-2 border-[#00e5ff]/30 hover:border-[#00e5ff]/60 transition-colors duration-300">
                <p className="text-[var(--soft)] leading-relaxed text-sm md:text-base">
                  Lost City crawls hundreds of sources across the city — venues,
                  promoters, galleries, breweries, parks, theaters, escape rooms,
                  nonprofits — so you don&apos;t have to check a dozen websites.
                  Shows, tours, classes, pop-ups, places to eat, things to do. It&apos;s
                  all here.
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
                  No ads. No subscriptions. No algorithm trying to keep you
                  scrolling braindead forever. Just everything going on in your
                  city, organized so you can find your thing and go do it.
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
            What are you into?
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 md:gap-3 mb-8">
            {[
              { label: "Music", icon: "music", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=music`, color: "cyan" },
              { label: "Comedy", icon: "comedy", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=comedy`, color: "pink" },
              { label: "Art", icon: "art", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=art`, color: "purple" },
              { label: "Theater", icon: "theater", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=theater`, color: "cyan" },
              { label: "Food & Drink", icon: "food_drink", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=food_drink`, color: "pink" },
              { label: "Nightlife", icon: "nightlife", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=nightlife`, color: "purple" },
              { label: "Sports", icon: "sports", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=sports`, color: "cyan" },
              { label: "Outdoors", icon: "outdoors", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=outdoors`, color: "pink" },
              { label: "Community", icon: "community", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&categories=community`, color: "purple" },
              { label: "Free", icon: "other", href: `/${DEFAULT_PORTAL_SLUG}?view=happening&free=1`, color: "cyan" },
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
              href={`/${DEFAULT_PORTAL_SLUG}?view=happening&date=today`}
              className="inline-flex items-center gap-3 text-base font-medium text-[var(--cream)] transition-all duration-300 hover:gap-4 hover:text-[#00e5ff] rounded-lg px-2 py-1 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080c]"
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
                Lost City is a network of city portals — each one a complete
                picture of what&apos;s going on. Events, destinations, places
                worth going, things worth doing. We crawl hundreds of sources
                so you get everything in one place instead of checking a dozen
                apps and websites.
              </p>
              <div>
                <p className="text-[var(--cream)] font-medium mb-3">
                  What you can do:
                </p>
                <ul className="space-y-3 ml-4">
                  <li className="flex items-start gap-3">
                    <span className="text-[#00e5ff] mt-0.5">◆</span>
                    <span>See everything happening in your city — shows, classes, openings, pop-ups, free stuff, places to explore</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#00e5ff] mt-0.5">◆</span>
                    <span>Discover destinations worth visiting — not just events, but the places themselves</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#ff6b9d] mt-0.5">◆</span>
                    <span>Add your friends, see where they&apos;re headed, make plans without the group text chaos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#ff6b9d] mt-0.5">◆</span>
                    <span>Follow the venues and orgs that consistently do great stuff</span>
                  </li>
                </ul>
              </div>
            </ExpandableSection>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={100}>
            <ExpandableSection title="Our Philosophy">
              <p>
                The way people find things to do is broken. Ticketing platforms
                only show you what they sell tickets to. Social platforms want
                you scrolling, not going. And the best stuff in any city is
                scattered across hundreds of small websites nobody checks.
              </p>
              <p>
                Lost City is an{" "}
                <span className="text-[#00e5ff] font-medium">access layer</span>,
                not a recommendation engine. We don&apos;t decide what you should do —
                we show you everything that&apos;s going on and let you figure it out.
                Your city, your call.
              </p>
            </ExpandableSection>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200}>
            <ExpandableSection title="Why AI?">
              <p>
                We use AI to crawl and organize the city at a scale that would
                be impossible by hand — hundreds of sources, thousands of events
                and places, updated constantly. The computers do what computers
                are good at: reading websites, matching data, keeping things
                current.
              </p>
              <p>
                That frees us up to focus on what actually matters:{" "}
                <span className="text-[#ff6b9d] font-medium">
                  getting people connected in the real world
                </span>
                . Leave the computers to the computers.{" "}
                <span className="text-[var(--cream)] font-medium">
                  The cities belong to us.
                </span>
              </p>
            </ExpandableSection>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={300}>
            <ExpandableSection title="Want a Portal?">
              <p>
                Hotels, conferences, neighborhoods, cities, niche communities —
                if your people need to know what&apos;s going on, we can build you
                a portal. White-labeled or branded, with data tailored to your
                audience.
              </p>
              <p>
                Already running portals for hotels, civic organizations, and
                vertical communities. Same platform, different lens.
              </p>
              <div className="mt-4 font-mono">
                <a
                  href="mailto:info@lostcity.ai"
                  className="inline-flex items-center gap-2 hover:gap-3 transition-all duration-300 home-gradient-text-animated"
                >
                  info@lostcity.ai →
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

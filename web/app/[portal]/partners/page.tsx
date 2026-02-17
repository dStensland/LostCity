import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import FilmPortalNav from "../_components/film/FilmPortalNav";

type Props = {
  params: Promise<{ portal: string }>;
};

const packages = [
  {
    title: "Presenting Partner",
    body: "Hero-level placement linked to showtime and festival traffic.",
    includes: ["Homepage hero feature", "Dedicated partner profile", "Festival week spotlight"],
  },
  {
    title: "Membership Campaign",
    body: "Brand storytelling integrated into program and venue destinations.",
    includes: ["Program page placement", "Membership call-to-action", "Seasonal partner highlights"],
  },
  {
    title: "Community Spotlight",
    body: "Support local groups and screenings without interruptive ad patterns.",
    includes: ["Community feature placement", "Partner week spotlight", "Co-branded support story"],
  },
];

const strategyTrack = [
  {
    phase: "Phase 1",
    focus: "Boutique Hotels",
    detail: "Fastest close cycle and clear guest-experience ROI (30-60 day sales motion).",
  },
  {
    phase: "Phase 2",
    focus: "Hospital Systems via Gozio",
    detail: "Strategic scale path through patient and family experience integrations (90-180 day motion).",
  },
  {
    phase: "Phase 3",
    focus: "Film and Cultural Institutions",
    detail: "Year-round audience and sponsor value for festivals, cinemas, and community programs.",
  },
];

const tractionSignals = [
  {
    metric: "11,000+",
    label: "Upcoming events indexed",
    context: "Sales enablement benchmark (Atlanta metro, Feb 2025).",
  },
  {
    metric: "2,300+",
    label: "Destinations mapped",
    context: "Venue and destination footprint used in vendor placement planning.",
  },
  {
    metric: "500+",
    label: "Source crawlers active",
    context: "Coverage moat across major institutions and long-tail neighborhood venues.",
  },
  {
    metric: "99.99%",
    label: "Title quality in production data",
    context: "54,000+ event audit result (Data Quality Report, Feb 16, 2026).",
  },
];

export default async function FilmPartnersPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal || getPortalVertical(portal) !== "film") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} backLink={{ label: "Home", fallbackHref: `/${portal.slug}` }} hideNav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-6">
        <FilmPortalNav portalSlug={portal.slug} />
        <header>
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="mt-1 font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Partner Programs</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#b8c7e3]">
            Partnerships are designed as native storytelling placements that support Atlanta&apos;s film culture and vendor outcomes.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {packages.map((pkg) => (
            <article key={pkg.title} className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
              <h2 className="font-[var(--font-film-editorial)] text-2xl leading-tight text-[#f7f7fb]">{pkg.title}</h2>
              <p className="mt-2 text-sm text-[#c8d5eb]">{pkg.body}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-[#aebedf]">
                {pkg.includes.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4 md:p-5">
          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#9ab0d8]">Lost City Strategy Track</p>
          <h2 className="mt-1 font-[var(--font-film-editorial)] text-2xl text-[#f7f7fb]">How we sequence growth</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {strategyTrack.map((item) => (
              <article key={item.phase} className="rounded-xl border border-[#32405f] bg-[#0f182c] p-3">
                <p className="text-[0.62rem] uppercase tracking-[0.13em] text-[#b9c9ea]">{item.phase}</p>
                <h3 className="mt-1 text-sm font-semibold text-[#e5edff]">{item.focus}</h3>
                <p className="mt-1.5 text-xs text-[#b3c4e4]">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#9ab0d8]">Sales Traction Signals</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-2xl text-[#f7f7fb]">Current proof for interested vendors</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tractionSignals.map((signal) => (
              <article key={signal.label} className="rounded-xl border border-[#2e3a57] bg-[#0d1426] p-3.5">
                <p className="text-xl font-semibold text-[#ecf2ff]">{signal.metric}</p>
                <p className="mt-1 text-sm text-[#d3def3]">{signal.label}</p>
                <p className="mt-1.5 text-[0.66rem] leading-relaxed text-[#9fb1d4]">{signal.context}</p>
              </article>
            ))}
          </div>
        </section>

        <Link
          href={`mailto:coach@lostcity.ai?subject=${encodeURIComponent(`${portal.name} - Partnership Inquiry`)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[#8da8ea66] bg-[#121b2f] px-4 py-2 text-xs uppercase tracking-[0.13em] text-[#d9e4ff] hover:border-[#8da8ea]"
        >
          Start Vendor Conversation
          <ArrowRight size={12} />
        </Link>
      </main>
    </div>
  );
}

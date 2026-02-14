import Link from "next/link";
import { Bebas_Neue, Fraunces, Space_Grotesk } from "next/font/google";
import { CalendarBlank, FilmSlate, MapPin, Sparkle, Ticket, UsersThree } from "@phosphor-icons/react/dist/ssr";

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-comp-display",
  display: "swap",
});

const editorial = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-comp-editorial",
  display: "swap",
});

const modern = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-comp-modern",
  display: "swap",
});

const heroStats = [
  { label: "Titles Tonight", value: "32" },
  { label: "Screenings", value: "91" },
  { label: "Cinema Partners", value: "12" },
];

const nowShowing = [
  { title: "Blue Velvet (35mm)", venue: "Plaza Theatre", times: "6:45 PM • 9:20 PM" },
  { title: "Southern Gothic Revival", venue: "Tara Theater", times: "7:10 PM • 10:00 PM" },
  { title: "Outsider Lens: Vol. 4", venue: "Landmark Midtown", times: "5:30 PM • 8:15 PM" },
];

const dateRail = ["Fri Feb 13", "Sat Feb 14", "Sun Feb 15", "Mon Feb 16", "Tue Feb 17", "Wed Feb 18", "Thu Feb 19"];

const venuePulse = [
  "Plaza Theatre · 11 screenings",
  "Tara Theater · 8 screenings",
  "Starlight Drive-In · 7 screenings",
  "Landmark Midtown · 6 screenings",
];

const programCards = [
  { title: "Curated Programs", body: "Editor-led picks with repertory context and filmmaker notes." },
  { title: "Festivals + Series", body: "ATLFF calendars, special runs, and recurring screening programs." },
  { title: "Film Community", body: "Clubs, classes, filmmaker groups, and independent collectives." },
];

const sponsorCards = [
  "Presenting Partner: ATLFF Opening Week",
  "Membership Spotlight: Plaza Annual Pass",
  "Community Spotlight: Indie Lens Collective",
];

function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-current/30 px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.16em]">
      {children}
    </span>
  );
}

function DesktopFrame({ children, tone }: { children: React.ReactNode; tone: "dark" | "paper" }) {
  const frameClass =
    tone === "dark"
      ? "rounded-[2rem] border border-[#2d3650] bg-[#0a111f] text-[#f6f7fb]"
      : "rounded-[2rem] border border-[#d8cfbf] bg-[#f8f3e8] text-[#1f1912]";

  return (
    <div className={`${frameClass} overflow-hidden p-4 sm:p-5 lg:p-6`}>
      {children}
    </div>
  );
}

function MobileFrame({ children, tone }: { children: React.ReactNode; tone: "dark" | "paper" }) {
  const frameClass =
    tone === "dark"
      ? "rounded-[2rem] border border-[#394264] bg-[#0a111f] text-[#f6f7fb]"
      : "rounded-[2rem] border border-[#d8cfbf] bg-[#f8f3e8] text-[#1f1912]";

  return (
    <div className="mx-auto w-[320px] rounded-[2.4rem] border border-[#495579] bg-[#070a11] p-2.5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      <div className={`${frameClass} min-h-[620px] overflow-hidden p-3`}>
        {children}
      </div>
    </div>
  );
}

export default function AtlantaFilmCompDeckPage() {
  return (
    <main className={`${display.variable} ${editorial.variable} ${modern.variable} bg-[radial-gradient(140%_160%_at_0%_0%,#1a1d2f_0%,#090b11_54%),linear-gradient(180deg,#07080c_0%,#090a0f_100%)] text-[#f7f5ef]`}>
      <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-[#2c3043] bg-[#0d1220]/85 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-[var(--font-comp-modern)] text-[0.68rem] uppercase tracking-[0.22em] text-[#f6c056]">
                Atlanta Film Portal Reset
              </p>
              <h1 className="mt-1 font-[var(--font-comp-editorial)] text-2xl text-[#f9f8f5] sm:text-3xl">
                Comp Sprint: 2 Directions, Desktop + Mobile
              </h1>
              <p className="mt-2 max-w-2xl font-[var(--font-comp-modern)] text-sm text-[#b5c1dc]">
                Locked IA in both comps: hero, tonight engine, date rail, venue pulse, programs, festivals, community, sponsor modules.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 font-[var(--font-comp-modern)] text-xs uppercase tracking-[0.14em]">
              <a href="#comp-a" className="rounded-full border border-[#3a415b] px-3 py-1.5 hover:border-[#f6b11e]">Comp A</a>
              <a href="#comp-b" className="rounded-full border border-[#3a415b] px-3 py-1.5 hover:border-[#f6b11e]">Comp B</a>
              <Link href="/atlanta-film" className="rounded-full border border-[#3a415b] px-3 py-1.5 hover:border-[#f6b11e]">
                Live Portal
              </Link>
            </div>
          </div>
        </header>

        <section id="comp-a" className="mb-10 rounded-3xl border border-[#2c3248] bg-[#0a0e1a] p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-[var(--font-comp-modern)] text-[0.62rem] uppercase tracking-[0.2em] text-[#98a8c7]">
                Comp A
              </p>
              <h2 className="font-[var(--font-comp-editorial)] text-3xl text-[#f8f7f3]">Festival-Forward Premium</h2>
            </div>
            <div className="flex gap-2 text-[#f7ce7a]">
              <SectionPill>Cinematic Dark</SectionPill>
              <SectionPill>High Contrast CTA</SectionPill>
              <SectionPill>Sponsor Native</SectionPill>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <DesktopFrame tone="dark">
              <div className="rounded-3xl border border-[#313a57] bg-[radial-gradient(120%_160%_at_0%_0%,rgba(246,177,30,0.24),rgba(10,17,31,0.95)_42%),linear-gradient(160deg,#0a111f_0%,#121c31_64%,#0c1323_100%)] p-5">
                <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full border border-[#f6b11e66] bg-[#f6b11e1c] px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[#f8ce74]">
                      <FilmSlate size={12} />
                      Atlanta Film Live
                    </p>
                    <h3 className="mt-4 font-[var(--font-comp-display)] text-6xl uppercase leading-[0.88] text-[#f5f7fb]">
                      Film Culture
                      <br />
                      In Motion
                    </h3>
                    <p className="mt-3 max-w-lg font-[var(--font-comp-modern)] text-sm text-[#d0daed]">
                      Premium city operating layer for showtimes, repertory programs, indie nights, and festival discovery.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 font-[var(--font-comp-modern)] text-xs uppercase tracking-[0.12em]">
                      <span className="inline-flex items-center gap-1 rounded-xl bg-[#f6b11e] px-3.5 py-2 font-semibold text-[#18120a]">
                        <Ticket size={13} />
                        Showtimes
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-xl border border-[#f6b11e66] bg-[#0f1628] px-3.5 py-2 text-[#f4f7fb]">
                        <CalendarBlank size={13} />
                        Calendar
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {heroStats.map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-[#33405e] bg-[#0f172bcc] p-2.5">
                          <p className="text-[0.58rem] uppercase tracking-[0.14em] text-[#9caecc]">{stat.label}</p>
                          <p className="mt-1 font-[var(--font-comp-editorial)] text-xl">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-[#364060] bg-[#0d1529cc] p-3.5">
                    <p className="text-[0.6rem] uppercase tracking-[0.16em] text-[#98abc9]">Tonight Engine</p>
                    <div className="mt-2 space-y-2.5">
                      {nowShowing.map((film, index) => (
                        <article key={film.title} className="rounded-lg border border-[#3b4566] bg-[#111b31] p-2.5">
                          <div className="flex gap-2.5">
                            <div className={`h-14 w-10 rounded-[3px] bg-gradient-to-br ${index % 2 === 0 ? "from-amber-300 to-orange-500" : "from-fuchsia-300 to-rose-500"}`} />
                            <div>
                              <p className="font-[var(--font-comp-modern)] text-sm font-semibold text-[#f3f6fb]">{film.title}</p>
                              <p className="mt-1 inline-flex items-center gap-1 text-[0.66rem] text-[#a9b8d5]"><MapPin size={10} />{film.venue}</p>
                              <p className="mt-1 text-[0.64rem] uppercase tracking-[0.1em] text-[#d9e3f7]">{film.times}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </aside>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#2f3953] bg-[#0d1425] px-3 py-2 font-[var(--font-comp-modern)] text-[0.64rem] uppercase tracking-[0.14em] text-[#9fb1d2]">
                Trust Layer: Verified 2h ago • 8 source feeds • Confidence: High
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                <div className="rounded-xl border border-[#2f3953] bg-[#0d1425] p-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.16em] text-[#95a8c8]">Date Rail</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dateRail.slice(0, 5).map((date, index) => (
                      <span key={date} className={`rounded-full border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] ${index === 0 ? "border-[#f6b11e66] bg-[#f6b11e1a] text-[#f7d07d]" : "border-[#36415f] text-[#a4b5d3]"}`}>
                        {date}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#2f3953] bg-[#0d1425] p-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.16em] text-[#95a8c8]">Venue Pulse</p>
                  <div className="mt-2 space-y-1.5 text-[0.68rem] text-[#cfdbf2]">
                    {venuePulse.slice(0, 3).map((venue) => (
                      <p key={venue}>{venue}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {programCards.map((card) => (
                  <article key={card.title} className="rounded-xl border border-[#2f3953] bg-[#0d1425] p-3">
                    <p className="font-[var(--font-comp-editorial)] text-xl text-[#f7f8fc]">{card.title}</p>
                    <p className="mt-1.5 text-xs text-[#bdcbe7]">{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {sponsorCards.map((card) => (
                  <div key={card} className="rounded-lg border border-[#3b4767] bg-[#121d33] px-3 py-2 text-[0.62rem] uppercase tracking-[0.12em] text-[#d6e0f4]">
                    {card}
                  </div>
                ))}
              </div>
            </DesktopFrame>

            <MobileFrame tone="dark">
              <p className="inline-flex items-center gap-1 rounded-full border border-[#f6b11e66] bg-[#f6b11e1a] px-2 py-0.5 text-[0.56rem] uppercase tracking-[0.14em] text-[#f8cd72]">
                <Sparkle size={10} />
                Mobile
              </p>
              <h3 className="mt-2 font-[var(--font-comp-display)] text-4xl uppercase leading-[0.88]">Film Tonight</h3>
              <p className="mt-1 font-[var(--font-comp-modern)] text-xs text-[#b8c8e3]">Hero + tonight engine + trust in first screen.</p>

              <div className="mt-3 rounded-xl border border-[#34405f] bg-[#0f172a] p-2.5">
                <p className="text-[0.56rem] uppercase tracking-[0.14em] text-[#97a9ca]">Now Screening</p>
                <p className="mt-1 text-sm font-semibold">Blue Velvet (35mm)</p>
                <p className="mt-1 text-[0.62rem] text-[#a9b9d7]">Plaza Theatre • 6:45 PM</p>
              </div>

              <div className="mt-2 rounded-lg border border-[#34405f] bg-[#10192e] px-2.5 py-1.5 text-[0.56rem] uppercase tracking-[0.12em] text-[#a2b4d6]">
                Verified 2h ago • High confidence
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {dateRail.slice(0, 3).map((date, index) => (
                  <span key={date} className={`rounded-full border px-2 py-0.5 text-[0.56rem] uppercase ${index === 0 ? "border-[#f6b11e66] text-[#f8d186]" : "border-[#3a4666] text-[#a7b8d8]"}`}>
                    {date.replace("Feb ", "")}
                  </span>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {programCards.slice(0, 2).map((card) => (
                  <article key={`mobile-a-${card.title}`} className="rounded-lg border border-[#34405f] bg-[#111a2f] p-2.5">
                    <p className="font-[var(--font-comp-editorial)] text-lg">{card.title}</p>
                    <p className="text-[0.68rem] text-[#b8c8e3]">{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-[#3a4666] bg-[#121e35] p-2.5">
                <p className="text-[0.56rem] uppercase tracking-[0.14em] text-[#95a8ca]">Partner Module</p>
                <p className="mt-1 text-sm">ATLFF Opening Week Presented Row</p>
              </div>
            </MobileFrame>
          </div>
        </section>

        <section id="comp-b" className="rounded-3xl border border-[#d7cfbf] bg-[#f0ebde] p-4 text-[#1f1912] sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-[var(--font-comp-modern)] text-[0.62rem] uppercase tracking-[0.2em] text-[#76674f]">
                Comp B
              </p>
              <h2 className="font-[var(--font-comp-editorial)] text-3xl">Editorial Cinema Journal</h2>
            </div>
            <div className="flex gap-2 text-[#7f6a48]">
              <SectionPill>Literary Tone</SectionPill>
              <SectionPill>Museum-Style Grid</SectionPill>
              <SectionPill>Sponsor as Patron</SectionPill>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <DesktopFrame tone="paper">
              <div className="rounded-3xl border border-[#d8cfbe] bg-[#fbf8f1] p-5">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#8b7758]">Atlanta Film Journal</p>
                    <h3 className="mt-2 max-w-xl font-[var(--font-comp-editorial)] text-5xl leading-[0.95]">
                      A cultural paper for people who plan their weeks around screenings.
                    </h3>
                    <p className="mt-3 max-w-xl font-[var(--font-comp-modern)] text-sm text-[#5b4d3c]">
                      The same locked IA, expressed with quieter confidence and editorial cadence.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#7b694f]">
                      <span className="rounded-full border border-[#d8cebb] px-2.5 py-1">Showtimes</span>
                      <span className="rounded-full border border-[#d8cebb] px-2.5 py-1">Calendar</span>
                      <span className="rounded-full border border-[#d8cebb] px-2.5 py-1">Festivals</span>
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-[#ddd3c3] bg-[#f6f1e5] p-3.5">
                    <p className="text-[0.6rem] uppercase tracking-[0.16em] text-[#8a795f]">Tonight Engine</p>
                    <div className="mt-2 space-y-2.5">
                      {nowShowing.map((film) => (
                        <article key={`paper-${film.title}`} className="rounded-lg border border-[#dfd6c7] bg-[#f8f3ea] p-2.5">
                          <p className="font-[var(--font-comp-editorial)] text-lg leading-tight">{film.title}</p>
                          <p className="mt-1 text-[0.67rem] text-[#6d5e4a]">{film.venue} • {film.times}</p>
                        </article>
                      ))}
                    </div>
                  </aside>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#dbd2c3] bg-[#f7f2e7] px-3 py-2 font-[var(--font-comp-modern)] text-[0.64rem] uppercase tracking-[0.14em] text-[#7f6c4f]">
                Trust Layer: Verified this afternoon • Cross-checked against venue feeds • Editor reviewed
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                <div className="rounded-xl border border-[#dbd2c3] bg-[#f7f2e7] p-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.16em] text-[#8a785d]">Date Rail</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dateRail.slice(0, 5).map((date, index) => (
                      <span key={`paper-${date}`} className={`rounded-full border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] ${index === 0 ? "border-[#c6ab76] bg-[#f2e6cb] text-[#7f6133]" : "border-[#d8cebc] text-[#836f50]"}`}>
                        {date}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#dbd2c3] bg-[#f7f2e7] p-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.16em] text-[#8a785d]">Venue Pulse</p>
                  <div className="mt-2 space-y-1.5 text-[0.68rem] text-[#5f513e]">
                    {venuePulse.slice(0, 3).map((venue) => (
                      <p key={`paper-${venue}`}>{venue}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {programCards.map((card) => (
                  <article key={`paper-${card.title}`} className="rounded-xl border border-[#dbd2c3] bg-[#f8f4ea] p-3">
                    <p className="font-[var(--font-comp-editorial)] text-xl">{card.title}</p>
                    <p className="mt-1.5 text-xs text-[#665742]">{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {sponsorCards.map((card) => (
                  <div key={`paper-${card}`} className="rounded-lg border border-[#d8cfbf] bg-[#f6f1e6] px-3 py-2 text-[0.62rem] uppercase tracking-[0.12em] text-[#6b5a42]">
                    {card}
                  </div>
                ))}
              </div>
            </DesktopFrame>

            <MobileFrame tone="paper">
              <p className="inline-flex items-center gap-1 rounded-full border border-[#d9cfbf] bg-[#f7f2e7] px-2 py-0.5 text-[0.56rem] uppercase tracking-[0.14em] text-[#7f6b4c]">
                <Sparkle size={10} />
                Mobile
              </p>
              <h3 className="mt-2 font-[var(--font-comp-editorial)] text-[1.65rem] leading-[1.02]">Editorial film brief for tonight.</h3>
              <p className="mt-1 font-[var(--font-comp-modern)] text-xs text-[#6e5e49]">Cleaner serif hierarchy, same IA and sponsor/trust behavior.</p>

              <div className="mt-3 rounded-xl border border-[#dbd2c3] bg-[#f8f3e9] p-2.5">
                <p className="text-[0.56rem] uppercase tracking-[0.14em] text-[#867456]">Now Screening</p>
                <p className="mt-1 text-sm font-semibold">Southern Gothic Revival</p>
                <p className="mt-1 text-[0.62rem] text-[#72624d]">Tara Theater • 7:10 PM</p>
              </div>

              <div className="mt-2 rounded-lg border border-[#dbd2c3] bg-[#f7f2e7] px-2.5 py-1.5 text-[0.56rem] uppercase tracking-[0.12em] text-[#7a684e]">
                Verified this afternoon • Editor reviewed
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {dateRail.slice(0, 3).map((date, index) => (
                  <span key={`mobile-paper-${date}`} className={`rounded-full border px-2 py-0.5 text-[0.56rem] uppercase ${index === 0 ? "border-[#c9ae7b] text-[#7c5f32]" : "border-[#d8cfbf] text-[#7c6a4e]"}`}>
                    {date.replace("Feb ", "")}
                  </span>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {programCards.slice(0, 2).map((card) => (
                  <article key={`mobile-b-${card.title}`} className="rounded-lg border border-[#dbd2c3] bg-[#f8f3e9] p-2.5">
                    <p className="font-[var(--font-comp-editorial)] text-lg">{card.title}</p>
                    <p className="text-[0.68rem] text-[#6f5f4a]">{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-[#d8cfbf] bg-[#f6f1e6] p-2.5">
                <p className="text-[0.56rem] uppercase tracking-[0.14em] text-[#857357]">Patron Module</p>
                <p className="mt-1 text-sm">Plaza Membership Week presented feature</p>
              </div>
            </MobileFrame>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#313852] bg-[#0c1120] px-4 py-3 font-[var(--font-comp-modern)] text-xs uppercase tracking-[0.12em] text-[#a5b3cf]">
          <span>Next step: pick Comp A or Comp B, then I will implement it 1:1 in `/atlanta-film`.</span>
          <span className="inline-flex items-center gap-2 text-[#f7d07f]">
            <UsersThree size={13} />
            Sponsor-ready modules included in both concepts
          </span>
        </footer>
      </div>
    </main>
  );
}

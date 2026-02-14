import Link from "next/link";

type Moodboard = {
  id: string;
  name: string;
  route: string;
  intensity: string;
  summary: string;
  tokens: string[];
  gradients: {
    shell: string;
    glowA: string;
    glowB: string;
  };
  notes: [string, string, string];
};

const moodboards: Moodboard[] = [
  {
    id: "M1",
    name: "Neon Hush",
    route: "/atlanta-test-mood-1",
    intensity: "Intense / 01",
    summary: "Dark and secretive with tight amber punctuation and controlled electric blue rain.",
    tokens: ["#040611", "#121D45", "#7A90EF", "#E9AE54", "#D97536"],
    gradients: {
      shell: "from-[#03050f] via-[#0a1230] to-[#040611]",
      glowA: "from-[#7a90ef]/35 to-transparent",
      glowB: "from-[#e9ae54]/28 to-transparent",
    },
    notes: ["Covert", "After-hours", "Disciplined highlights"],
  },
  {
    id: "M2",
    name: "Backroom Voltage",
    route: "/atlanta-test-mood-2",
    intensity: "Intense / 02",
    summary: "Higher contrast and brighter edge-lighting while staying grounded in rain-soaked noir.",
    tokens: ["#03040F", "#131D47", "#8EA4FF", "#F1B45A", "#F07E3B"],
    gradients: {
      shell: "from-[#02030c] via-[#0b1537] to-[#03040f]",
      glowA: "from-[#8ea4ff]/45 to-transparent",
      glowB: "from-[#f1b45a]/35 to-transparent",
    },
    notes: ["Electric", "Sharper contrast", "Premium grit"],
  },
  {
    id: "M3",
    name: "Midnight Siren",
    route: "/atlanta-test-mood-3",
    intensity: "Intense / 03",
    summary: "Maximum glow pressure: deep indigo void with sodium-lamp flare and clashing electric city lights.",
    tokens: ["#02030B", "#1E1956", "#9AAFFF", "#FFC166", "#FF8F45"],
    gradients: {
      shell: "from-[#010208] via-[#120b2f] to-[#02030b]",
      glowA: "from-[#9aafff]/55 to-transparent",
      glowB: "from-[#ffc166]/42 to-transparent",
    },
    notes: ["Most theatrical", "Hero-forward", "Night pulse"],
  },
];

export default function AtlantaMoodboardsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(120%_140%_at_0%_0%,#12183a_0%,#060912_52%),linear-gradient(180deg,#04050b_0%,#080a14_100%)] text-[#e9eeff]">
      <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-[#2b356d]/70 bg-[#0a0f27]/78 p-5 backdrop-blur-md sm:p-6">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[#f1b45a]">Atlanta Main Feed Moodboards</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#f3f6ff] sm:text-4xl">
            Rain Noir Direction, 3 Intensity Steps
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[#b6c2ec] sm:text-base">
            These are live-theme variants on the same feed. Each step increases glow pressure, color contrast, and visual drama while preserving the deep purple-blue storm identity.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em] text-[#b8c5ef]">
            <span className="rounded-full border border-[#2d3b7a] bg-[#111a42]/70 px-3 py-1">Primary Font: Space Grotesk</span>
            <span className="rounded-full border border-[#2d3b7a] bg-[#111a42]/70 px-3 py-1">Body Font: Inter</span>
            <Link
              href="/atlanta-test"
              className="rounded-full border border-[#f1b45a]/45 bg-[#f1b45a]/12 px-3 py-1 text-[#ffd591] hover:bg-[#f1b45a]/18"
            >
              Baseline Nocturne
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {moodboards.map((board) => (
            <article key={board.id} className="rounded-3xl border border-[#2a356a]/70 bg-[#0a1027]/78 p-4 backdrop-blur-md sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.64rem] uppercase tracking-[0.22em] text-[#f1b45a]">{board.id}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[#f4f7ff]">{board.name}</h2>
                </div>
                <span className="rounded-full border border-[#4154a8]/70 bg-[#111a42] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-[#b8c6f4]">
                  {board.intensity}
                </span>
              </div>

              <div className={`relative mt-4 h-44 overflow-hidden rounded-2xl border border-[#354488]/70 bg-gradient-to-br ${board.gradients.shell}`}>
                <div className={`absolute -left-8 -top-10 h-44 w-44 rounded-full bg-gradient-to-br blur-2xl ${board.gradients.glowA}`} />
                <div className={`absolute -bottom-8 right-0 h-40 w-40 rounded-full bg-gradient-to-tr blur-2xl ${board.gradients.glowB}`} />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(-64deg,transparent_0,transparent_11px,rgba(145,168,255,0.16)_11px,rgba(145,168,255,0.16)_13px)] opacity-70" />
                <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_130%,rgba(0,0,0,0.52)_0%,transparent_56%)]" />
                <div className="absolute left-4 top-4 rounded-full border border-[#f3bf67]/50 bg-[#f3bf67]/14 px-3 py-1 text-[0.58rem] uppercase tracking-[0.18em] text-[#ffd595]">
                  {board.name}
                </div>
              </div>

              <p className="mt-4 text-sm text-[#c0cbed]">{board.summary}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {board.notes.map((note) => (
                  <span key={note} className="rounded-full border border-[#34417f]/80 bg-[#121b45]/65 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.12em] text-[#aebeef]">
                    {note}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {board.tokens.map((token) => (
                  <div key={token} className="space-y-1">
                    <div className="h-8 rounded-md border border-white/10" style={{ backgroundColor: token }} />
                    <p className="text-[0.56rem] uppercase tracking-[0.12em] text-[#9fb0e3]">{token}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <Link
                  href={board.route}
                  className="rounded-full border border-[#f1b45a]/45 bg-[#f1b45a]/14 px-3.5 py-1.5 text-xs uppercase tracking-[0.14em] text-[#ffd591] transition hover:bg-[#f1b45a]/22"
                >
                  Open Live Feed
                </Link>
                <p className="text-[0.62rem] uppercase tracking-[0.14em] text-[#9fb0e3]">{board.route}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

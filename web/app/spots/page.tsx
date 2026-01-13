import { getSpotsWithEventCounts } from "@/lib/spots";
import SpotCard from "@/components/SpotCard";
import ModeToggle from "@/components/ModeToggle";
import CategoryIcon, { CATEGORY_CONFIG, getCategoryLabel } from "@/components/CategoryIcon";
import Link from "next/link";

export const revalidate = 60;

// Spot types to show in filter
const SPOT_TYPE_KEYS = [
  "music_venue",
  "theater",
  "comedy_club",
  "bar",
  "restaurant",
  "coffee_shop",
  "brewery",
  "gallery",
  "club",
  "arena",
] as const;

type Props = {
  searchParams: Promise<{
    type?: string;
  }>;
};

export default async function SpotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedType = params.type || "all";

  const spots = await getSpotsWithEventCounts(selectedType);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="gradient-text text-xl font-bold tracking-tight">
            Lost City
          </Link>
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex gap-4 sm:gap-6">
          <Link href="/spots?view=map" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Map
          </Link>
          <a href="mailto:hello@lostcity.ai" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Submit
          </a>
        </nav>
      </header>

      {/* Mode Toggle + Tagline */}
      <section className="py-4 sm:py-6 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <ModeToggle />
            <p className="hidden sm:block font-serif text-[var(--soft)]">
              Bars, venues, and hidden gems worth knowing
            </p>
          </div>
        </div>
      </section>

      {/* Type Filter */}
      <section className="sticky top-0 z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <Link
              href="/spots"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-colors ${
                selectedType === "all"
                  ? "bg-[var(--cream)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              All
            </Link>
            {SPOT_TYPE_KEYS.map((type) => (
              <Link
                key={type}
                href={`/spots?type=${type}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedType === type
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                <CategoryIcon
                  type={type}
                  size={14}
                  style={{ color: selectedType === type ? "var(--void)" : CATEGORY_CONFIG[type]?.color }}
                />
                {getCategoryLabel(type)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Spot count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{spots.length}</span>{" "}
          {selectedType !== "all" ? `${getCategoryLabel(selectedType).toLowerCase()}s` : "spots"}
        </p>
      </div>

      {/* Spots List */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
        {spots.length > 0 ? (
          <div>
            {spots.map((spot, index) => (
              <SpotCard key={spot.id} spot={spot} index={index} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-[var(--muted)]">No spots found</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <div className="gradient-text text-lg font-bold">Lost City</div>
          <p className="font-serif text-[var(--muted)] mt-1">
            The real Atlanta, found
          </p>
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-4 opacity-60">
            AI-powered · Updated continuously
          </p>
        </div>
      </footer>
    </div>
  );
}

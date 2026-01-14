import { Suspense } from "react";
import { getSpotsWithEventCounts } from "@/lib/spots";
import SpotCard from "@/components/SpotCard";
import ModeToggle from "@/components/ModeToggle";
import SpotFilters from "@/components/SpotFilters";
import { getCategoryLabel } from "@/components/CategoryIcon";
import Link from "next/link";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{
    type?: string;
    hood?: string;
  }>;
};

export default async function SpotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedType = params.type || "all";
  const selectedHood = params.hood || "all";

  const spots = await getSpotsWithEventCounts(selectedType, undefined, selectedHood);

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

      {/* Filters */}
      <Suspense fallback={<div className="h-24 bg-[var(--night)]" />}>
        <SpotFilters />
      </Suspense>

      {/* Results Count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{spots.length}</span>{" "}
          {selectedType !== "all" ? `${getCategoryLabel(selectedType).toLowerCase()}s` : "spots"}
          {selectedHood !== "all" && ` in ${selectedHood}`}
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
            <Link
              href="/spots"
              className="inline-block mt-4 font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
            >
              Clear filters
            </Link>
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

import { Suspense } from "react";
import { getSpotsWithEventCounts } from "@/lib/spots";
import SpotCard from "@/components/SpotCard";
import ModeToggle from "@/components/ModeToggle";
import SpotFilters from "@/components/SpotFilters";
import SpotSearchBar from "@/components/SpotSearchBar";
import { getCategoryLabel } from "@/components/CategoryIcon";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import Link from "next/link";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{
    type?: string;
    hood?: string;
    vibe?: string;
    search?: string;
  }>;
};

export default async function SpotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedType = params.type || "all";
  const selectedHood = params.hood || "all";
  const selectedVibe = params.vibe || "";
  const searchQuery = params.search || "";

  const spots = await getSpotsWithEventCounts(selectedType, selectedVibe, selectedHood, searchQuery);

  return (
    <div className="min-h-screen">
      <PageHeader showEvents showSubmit />

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

      {/* Search Bar */}
      <section className="py-4 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-lg animate-pulse" />}>
            <SpotSearchBar />
          </Suspense>
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
          {searchQuery && ` matching "${searchQuery}"`}
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

      <PageFooter />
    </div>
  );
}

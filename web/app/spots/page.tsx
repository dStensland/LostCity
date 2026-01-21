import { Suspense } from "react";
import { getSpotsWithEventCounts } from "@/lib/spots";
import GlassHeader from "@/components/GlassHeader";
import MainNav from "@/components/MainNav";
import PageFooter from "@/components/PageFooter";
import SpotsContent from "./SpotsContent";

export const revalidate = 60;

export type SortOption = "alpha" | "events" | "closest";

type Props = {
  searchParams: Promise<{
    type?: string;
    hood?: string;
    vibe?: string;
    search?: string;
    view?: string;
    sort?: string;
  }>;
};

export default async function SpotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedTypes = params.type?.split(",").filter(Boolean) || [];
  const selectedHoods = params.hood?.split(",").filter(Boolean) || [];
  const searchQuery = params.search || "";
  const viewMode = (params.view as "list" | "type" | "neighborhood") || "type";
  const sortBy = (params.sort as SortOption) || "events";

  // Fetch spots with all selected filters
  const spots = await getSpotsWithEventCounts(
    selectedTypes.length > 0 ? selectedTypes.join(",") : "all",
    params.vibe || "",
    selectedHoods.length > 0 ? selectedHoods.join(",") : "all",
    searchQuery
  );

  return (
    <div className="min-h-screen">
      <GlassHeader />

      <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
        <MainNav />
      </Suspense>

      <Suspense fallback={<div className="h-12 bg-[var(--night)]" />}>
        <SpotsContent
          spots={spots}
          viewMode={viewMode}
          sortBy={sortBy}
          selectedTypes={selectedTypes}
          selectedHoods={selectedHoods}
          searchQuery={searchQuery}
        />
      </Suspense>

      <PageFooter />
    </div>
  );
}

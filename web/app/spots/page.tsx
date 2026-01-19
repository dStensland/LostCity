import { Suspense } from "react";
import { getSpotsWithEventCounts } from "@/lib/spots";
import GlassHeader from "@/components/GlassHeader";
import MainNav from "@/components/MainNav";
import PageFooter from "@/components/PageFooter";
import SpotsContent from "./SpotsContent";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{
    type?: string;
    hood?: string;
    vibe?: string;
    search?: string;
    group?: string;
  }>;
};

export default async function SpotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedTypes = params.type?.split(",").filter(Boolean) || [];
  const selectedHoods = params.hood?.split(",").filter(Boolean) || [];
  const selectedVibes = params.vibe?.split(",").filter(Boolean) || [];
  const searchQuery = params.search || "";
  const groupBy = (params.group as "none" | "category" | "neighborhood") || "none";

  // For now, pass first type/vibe/hood to the existing function
  const spots = await getSpotsWithEventCounts(
    selectedTypes[0] || "all",
    selectedVibes.join(","),
    selectedHoods[0] || "all",
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
          initialGroupBy={groupBy}
          selectedTypes={selectedTypes}
          selectedHoods={selectedHoods}
          searchQuery={searchQuery}
        />
      </Suspense>

      <PageFooter />
    </div>
  );
}

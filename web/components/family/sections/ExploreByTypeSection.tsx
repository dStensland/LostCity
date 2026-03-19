"use client";

import { ExploreByTypeGrid } from "../ExploreByTypeGrid";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { SectionLabel } from "./_shared";

const AMBER = FAMILY_TOKENS.amber;

// ---- ExploreByTypeSectionWrapper -------------------------------------------

export function ExploreByTypeSection({ portalSlug }: { portalSlug: string }) {
  return (
    <section>
      <SectionLabel text="Explore by Type" color={AMBER} />
      <ExploreByTypeGrid portalSlug={portalSlug} />
    </section>
  );
}

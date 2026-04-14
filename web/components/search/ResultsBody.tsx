"use client";

import { useSearchStore } from "@/lib/search/store";
import { TopMatchesStrip } from "@/components/search/TopMatchesStrip";
import { GroupedResultSection } from "@/components/search/GroupedResultSection";
import { EmptyState } from "@/components/search/EmptyState";

export function ResultsBody({ portalSlug }: { portalSlug: string }) {
  const results = useSearchStore((s) => s.results);
  const status = useSearchStore((s) => s.status);
  const error = useSearchStore((s) => s.error);
  const raw = useSearchStore((s) => s.raw);

  if (status === "error") {
    return <EmptyState kind="error" query={raw} message={error ?? undefined} portalSlug={portalSlug} />;
  }
  if (status === "fetching" && !results) {
    return <EmptyState kind="loading" query={raw} portalSlug={portalSlug} />;
  }
  if (!results) return null;

  const hasAny = results.topMatches.length > 0 || results.sections.length > 0;
  if (!hasAny) {
    return <EmptyState kind="zero" query={raw} portalSlug={portalSlug} />;
  }

  return (
    <div className="space-y-6">
      <TopMatchesStrip items={results.topMatches} />
      {results.sections.map((section) => (
        <GroupedResultSection
          key={section.type}
          type={section.type}
          title={section.title}
          items={section.items}
          total={section.total}
        />
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import { StudiosDirectory } from "@/components/arts/StudiosDirectory";
import { ArtsSecondaryNav } from "@/components/arts/ArtsSecondaryNav";

export const metadata: Metadata = {
  title: "Studios & Workspaces | Lost Arts",
  description:
    "Find artist studios, makerspaces, and creative workspaces across Atlanta. Private studios, co-ops, residencies, and shared spaces.",
};

export default async function StudiosPage({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal: portalSlug } = await params;

  return (
    <>
      <ArtsSecondaryNav portalSlug={portalSlug} />
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 pb-28 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--action-primary)]">
          {"// studios & workspaces"}
        </h1>
        <p className="font-mono text-sm text-[var(--muted)] leading-relaxed">
          Atlanta&apos;s artist studios, makerspaces, and creative workspaces.
          Private rentals, co-ops, residency programs, and shared facilities.
        </p>
      </div>

      {/* Directory */}
      <StudiosDirectory portalSlug={portalSlug} />
    </main>
    </>
  );
}

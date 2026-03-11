import Link from "next/link";
import { ArrowRight, Lifebuoy } from "@phosphor-icons/react";
import { isHelpAtlSupportDirectoryEnabled } from "@/lib/helpatl-support";

export default function SupportResourcesCard({
  portalSlug,
}: {
  portalSlug: string;
}) {
  if (!isHelpAtlSupportDirectoryEnabled(portalSlug)) {
    return null;
  }

  return (
    <section className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{
            backgroundColor: "color-mix(in srgb, var(--action-primary) 12%, transparent)",
          }}
        >
          <Lifebuoy weight="duotone" className="h-3.5 w-3.5 text-[var(--action-primary)]" />
        </div>
        <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[var(--cream)]">
          Support Resources
        </span>
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-sm leading-6 text-[var(--soft)]">
          Find trusted Atlanta organizations for food, housing, legal aid, public health, family support,
          and crisis pathways.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-2xs text-[var(--muted)]">
          <span className="rounded-full border border-[var(--twilight)]/70 px-2 py-1">Food</span>
          <span className="rounded-full border border-[var(--twilight)]/70 px-2 py-1">Housing</span>
          <span className="rounded-full border border-[var(--twilight)]/70 px-2 py-1">Legal aid</span>
          <span className="rounded-full border border-[var(--twilight)]/70 px-2 py-1">Health</span>
          <span className="rounded-full border border-[var(--twilight)]/70 px-2 py-1">Family</span>
        </div>

        <Link
          href={`/${portalSlug}/support`}
          className="mt-4 inline-flex items-center gap-1 rounded-md border border-[var(--twilight)]/80 px-3 py-1.5 text-xs font-medium text-[var(--cream)] transition-colors hover:border-[var(--action-primary)]/35 hover:text-[var(--action-primary)]"
        >
          Browse directory
          <ArrowRight weight="bold" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

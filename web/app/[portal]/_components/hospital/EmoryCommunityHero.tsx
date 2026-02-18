import { hospitalDisplayFont } from "@/lib/hospital-art";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";

type EmoryCommunityHeroProps = {
  mode: HospitalAudienceMode;
  stats: { eventsThisWeek: number; organizations: number };
  portalSlug: string;
  heroTitle?: string;
  subhead?: string;
  chipLabels?: { events: string; orgs: string };
};

const MODE_SUBHEADS: Record<HospitalAudienceMode, string> = {
  visitor: "Programs and resources near Emory",
  treatment: "Support for your care journey",
  urgent: "Find help right now",
  staff: "Community resources near your shift",
};

export default function EmoryCommunityHero({
  mode,
  stats,
  heroTitle,
  subhead,
  chipLabels,
}: EmoryCommunityHeroProps) {
  const displayTitle = heroTitle || "How can we help today?";
  const displaySubhead = subhead || MODE_SUBHEADS[mode];
  const eventsLabel = chipLabels?.events.replace("{count}", String(stats.eventsThisWeek)) || `${stats.eventsThisWeek} Events This Week`;
  const orgsLabel = chipLabels?.orgs.replace("{count}", String(stats.organizations)) || `${stats.organizations} Organizations`;

  return (
    <section className="emory-warm-hero p-5 sm:p-7">
      <h1
        className={`${hospitalDisplayFont.className} text-[clamp(2.2rem,4vw,3.2rem)] leading-[0.94] text-[var(--cream)]`}
      >
        {displayTitle}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{displaySubhead}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="emory-chip">{eventsLabel}</span>
        <span className="emory-chip">{orgsLabel}</span>
      </div>
    </section>
  );
}

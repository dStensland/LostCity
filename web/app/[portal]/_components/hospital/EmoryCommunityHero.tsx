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
    <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#002f6c] via-[#003a7c] to-[#0b4a9e] p-6 sm:p-8">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8ed585]">Community Hub</p>
        <h1
          className={`${hospitalDisplayFont.className} mt-2 text-[clamp(1.6rem,3.2vw,2.4rem)] leading-[1.08] text-white`}
        >
          {displayTitle}
        </h1>
        <p className="mt-2.5 text-sm sm:text-[15px] text-white/70 max-w-[48ch] leading-relaxed">{displaySubhead}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.03em] text-white/90">{eventsLabel}</span>
          <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.03em] text-white/90">{orgsLabel}</span>
        </div>
      </div>
    </section>
  );
}

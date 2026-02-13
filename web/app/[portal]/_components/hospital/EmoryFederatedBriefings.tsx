import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { getEmoryPersonaProfile, type EmoryPersonaKey } from "@/lib/emory-personas";
import {
  EMORY_EXCLUSION_POLICY,
  EMORY_FEDERATED_SOURCES,
  getEmoryBriefings,
} from "@/lib/emory-demo-content";

type Props = {
  portalSlug: string;
  mode: HospitalAudienceMode;
  persona: EmoryPersonaKey;
  hospitalSlug?: string;
};

export default function EmoryFederatedBriefings({ portalSlug, mode, persona, hospitalSlug }: Props) {
  const briefings = getEmoryBriefings(mode);
  const sourcePills = EMORY_FEDERATED_SOURCES.slice(0, 6);
  const personaProfile = getEmoryPersonaProfile(persona);

  return (
    <section id="federated-health-network" className="emory-panel rounded-[28px] p-6 sm:p-7 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="emory-kicker">Federated Health Network</p>
          <h2 className="mt-1 text-[clamp(1.2rem,2.5vw,1.9rem)] font-semibold text-[var(--cream)]">
            Emory-tailored source briefings
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">
            Tailored for {personaProfile.label.toLowerCase()}: practical, non-clinical support from hospital operations,
            public agencies, and nonprofit partners with strict provenance on every recommendation.
          </p>
        </div>
        <span className="emory-chip">
          {EMORY_EXCLUSION_POLICY}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sourcePills.map((source) => (
          <span key={source.id} className="emory-chip">
            {source.name} · {source.trustTier}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {briefings.map((briefing) => {
          const findHref = `/${portalSlug}?view=find&type=events&mode=${mode}&persona=${persona}&search=${encodeURIComponent(briefing.searchQuery)}`;
          return (
            <article key={briefing.id} className="emory-panel-subtle rounded-2xl p-4">
              <p className="emory-kicker">Active Briefing</p>
              <h3 className="mt-1 text-base font-semibold text-[var(--cream)]">{briefing.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{briefing.summary}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">Source: {briefing.sourceLabel}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {briefing.chips.map((chip) => (
                  <span key={chip} className="emory-chip">
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <HospitalTrackedLink
                  href={findHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug,
                    hospitalSlug,
                    modeContext: mode,
                    sectionKey: "federated_briefings",
                    targetKind: "briefing_find",
                    targetId: briefing.id,
                    targetLabel: briefing.title,
                    targetUrl: findHref,
                  }}
                  className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Open in Emory Feed
                </HospitalTrackedLink>
                <HospitalTrackedLink
                  href={briefing.sourceUrl}
                  external
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug,
                    hospitalSlug,
                    modeContext: mode,
                    sectionKey: "federated_briefings",
                    targetKind: "briefing_source",
                    targetId: briefing.id,
                    targetLabel: briefing.sourceLabel,
                    targetUrl: briefing.sourceUrl,
                  }}
                  className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Source
                </HospitalTrackedLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

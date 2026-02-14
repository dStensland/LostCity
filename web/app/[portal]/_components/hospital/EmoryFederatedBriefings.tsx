import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { getEmoryPersonaProfile, type EmoryPersonaKey } from "@/lib/emory-personas";
import {
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
  const personaProfile = getEmoryPersonaProfile(persona);

  return (
    <section id="federated-health-network" className="emory-panel rounded-[28px] p-6 sm:p-7 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="emory-kicker">Community Briefings</p>
          <h2 className="mt-1 text-[clamp(1.2rem,2.5vw,1.9rem)] font-semibold text-[var(--cream)]">
            Emory-tailored support briefings
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">
            Tailored for {personaProfile.label.toLowerCase()}: practical, non-clinical support from hospital operations,
            public agencies, and nonprofit partners.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {briefings.map((briefing) => {
          const communityHref = `/${portalSlug}?view=community&mode=${mode}&persona=${persona}`;
          return (
            <article key={briefing.id} className="emory-panel-subtle rounded-2xl p-4">
              <p className="emory-kicker">Active Briefing</p>
              <h3 className="mt-1 text-base font-semibold text-[var(--cream)]">{briefing.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{briefing.summary}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {briefing.chips.map((chip) => (
                  <span key={chip} className="emory-chip">
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <HospitalTrackedLink
                  href={communityHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug,
                    hospitalSlug,
                    modeContext: mode,
                    sectionKey: "federated_briefings",
                    targetKind: "briefing_hub",
                    targetId: briefing.id,
                    targetLabel: briefing.title,
                    targetUrl: communityHref,
                  }}
                  className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Open Community Hub
                </HospitalTrackedLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

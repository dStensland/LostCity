"use client";

import { useEffect, useState, useCallback } from "react";
import type { Portal } from "@/lib/portal-context";
import type {
  Pillar,
  ConciergeConfig,
  ConciergePillarData,
  AmbientContext,
  AgentNarrative,
} from "@/lib/concierge/concierge-types";
import type { PortalPreferences } from "@/lib/onboarding-utils";
import { usePortalPreferences } from "@/lib/hooks/usePortalPreferences";
import PortalOnboarding from "@/components/onboarding/PortalOnboarding";
import HotelHeader from "../hotel/HotelHeader";
import ConciergePillarNav from "./ConciergePillarNav";
import ConciergeAmbientBar from "./ConciergeAmbientBar";
import ServicesPillar from "./pillars/ServicesPillar";
import AroundYouPillar from "./pillars/AroundYouPillar";
import PlannerPillar from "./pillars/PlannerPillar";
import AgentFooter from "./sections/AgentFooter";

interface ConciergeShellProps {
  portal: Portal;
  config: ConciergeConfig;
  pillarData: ConciergePillarData;
  ambient: AmbientContext;
  agentNarrative: AgentNarrative | null;
  initialPillar?: Pillar;
}

export default function ConciergeShell({
  portal,
  config,
  pillarData,
  ambient,
  agentNarrative,
  initialPillar,
}: ConciergeShellProps) {
  const [activePillar, setActivePillar] = useState<Pillar>(
    initialPillar || config.defaultPillar
  );
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const { needsOnboarding, completeOnboarding } = usePortalPreferences(portal.id, portal.slug);
  const logoUrl = portal.branding?.logo_url as string | null | undefined;
  const cityName = portal.filters?.city || undefined;
  const showOnboarding = needsOnboarding && !config.skipOnboarding && !onboardingDismissed;

  // Sync pillar to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activePillar === config.defaultPillar) {
      url.searchParams.delete("pillar");
    } else {
      url.searchParams.set("pillar", activePillar);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activePillar, config.defaultPillar]);

  // Mark body with data attribute for concierge-specific CSS
  useEffect(() => {
    document.body.dataset.forthExperience = "true";
    document.body.dataset.conciergeExperience = "true";
    return () => {
      delete document.body.dataset.forthExperience;
      delete document.body.dataset.conciergeExperience;
    };
  }, []);

  const handlePillarChange = useCallback((pillar: Pillar) => {
    setActivePillar(pillar);
    // Scroll to top on pillar switch
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleOnboardingComplete = useCallback(
    (prefs: PortalPreferences) => {
      completeOnboarding(prefs);
      setOnboardingDismissed(true);
    },
    [completeOnboarding]
  );

  // Compute dynamic badge for specials
  const pillarsWithBadges = config.pillars.map((p) => {
    if (p.id === "around" && pillarData.around.specialsMeta) {
      const liveCount = pillarData.around.specialsMeta.active_now;
      if (liveCount > 0) {
        return { ...p, badge: `${liveCount} live` };
      }
    }
    return p;
  });

  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <HotelHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        logoUrl={logoUrl}
        hideNav
        conciergePhone={config.conciergePhone}
      />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-4">
        {/* Ambient context bar */}
        <ConciergeAmbientBar ambient={ambient} cityName={cityName} />

        {/* Pillar navigation tabs */}
        <ConciergePillarNav
          pillars={pillarsWithBadges}
          activePillar={activePillar}
          onPillarChange={handlePillarChange}
        />

        {/* Pillar content */}
        <div key={activePillar} className="mt-8 space-y-12 animate-fade-in">
          {activePillar === "services" && (
            <div role="tabpanel" id="pillar-panel-services">
              <ServicesPillar
                data={pillarData.services}
                portalName={portal.name}
              />
            </div>
          )}

          {activePillar === "around" && (
            <div role="tabpanel" id="pillar-panel-around">
              <AroundYouPillar
                data={pillarData.around}
                portalId={portal.id}
                ambient={ambient}
                portalSlug={portal.slug}
                portalName={portal.name}
                conciergePhone={config.conciergePhone}
              />
            </div>
          )}

          {activePillar === "planner" && (
            <div role="tabpanel" id="pillar-panel-planner">
              <PlannerPillar
                data={pillarData.planner}
                portal={portal}
                conciergePhone={config.conciergePhone}
              />
            </div>
          )}
        </div>

        {/* Agent footer - always visible */}
        <AgentFooter
          narrative={agentNarrative}
          conciergePhone={config.conciergePhone}
        />
      </main>

      {/* Onboarding modal */}
      {showOnboarding && (
        <PortalOnboarding
          portalName={portal.name}
          onComplete={handleOnboardingComplete}
          onDismiss={() => setOnboardingDismissed(true)}
        />
      )}
    </div>
  );
}

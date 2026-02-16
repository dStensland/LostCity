import type { Portal } from "@/lib/portal-context";
import type { Pillar } from "@/lib/concierge/concierge-types";
import { getConciergeExperienceData } from "@/lib/concierge/concierge-data";
import ConciergeShell from "./ConciergeShell";

interface ConciergeExperienceProps {
  portal: Portal;
  initialPillar?: Pillar;
}

/**
 * Server component that fetches all concierge data in parallel
 * and passes it to the client shell.
 */
export default async function ConciergeExperience({
  portal,
  initialPillar,
}: ConciergeExperienceProps) {
  const { config, pillarData, ambient, agentNarrative } = await getConciergeExperienceData(portal);

  return (
    <ConciergeShell
      portal={portal}
      config={config}
      pillarData={pillarData}
      ambient={ambient}
      agentNarrative={agentNarrative}
      initialPillar={initialPillar}
    />
  );
}

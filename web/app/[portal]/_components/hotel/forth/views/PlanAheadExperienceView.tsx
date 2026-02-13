"use client";

import type { Portal } from "@/lib/portal-context";
import ForthConciergeExperience from "../../ForthConciergeExperience";

interface PlanAheadExperienceViewProps {
  portal: Portal;
}

export default function PlanAheadExperienceView({ portal }: PlanAheadExperienceViewProps) {
  return <ForthConciergeExperience portal={portal} routeIntent="plan" />;
}

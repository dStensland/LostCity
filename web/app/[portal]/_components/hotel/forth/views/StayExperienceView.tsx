"use client";

import type { Portal } from "@/lib/portal-context";
import ForthConciergeExperience from "../../ForthConciergeExperience";

interface StayExperienceViewProps {
  portal: Portal;
}

export default function StayExperienceView({ portal }: StayExperienceViewProps) {
  return <ForthConciergeExperience portal={portal} mode="stay" routeIntent="tonight" />;
}

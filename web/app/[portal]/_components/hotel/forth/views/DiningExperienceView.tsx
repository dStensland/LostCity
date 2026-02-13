"use client";

import type { Portal } from "@/lib/portal-context";
import ForthConciergeExperience from "../../ForthConciergeExperience";

interface DiningExperienceViewProps {
  portal: Portal;
}

export default function DiningExperienceView({ portal }: DiningExperienceViewProps) {
  return <ForthConciergeExperience portal={portal} routeIntent="dining" />;
}

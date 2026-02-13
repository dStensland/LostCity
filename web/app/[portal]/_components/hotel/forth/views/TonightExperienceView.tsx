"use client";

import type { Portal } from "@/lib/portal-context";
import ForthConciergeExperience from "../../ForthConciergeExperience";

interface TonightExperienceViewProps {
  portal: Portal;
}

export default function TonightExperienceView({ portal }: TonightExperienceViewProps) {
  return <ForthConciergeExperience portal={portal} routeIntent="tonight" />;
}

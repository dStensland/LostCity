"use client";

import type { Portal } from "@/lib/portal-context";
import ForthConciergeExperience from "../../ForthConciergeExperience";

interface ClubExperienceViewProps {
  portal: Portal;
}

export default function ClubExperienceView({ portal }: ClubExperienceViewProps) {
  return <ForthConciergeExperience portal={portal} routeIntent="club" />;
}

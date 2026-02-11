import type { Portal } from "@/lib/portal-context";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import HospitalPortalExperience from "../_components/hospital/HospitalPortalExperience";

type FeedTab = "curated" | "foryou";

interface HospitalTemplateProps {
  portal: Portal;
  feedTab: FeedTab;
  mode: HospitalAudienceMode;
}

/**
 * Hospital template - keeps general portal feed while surfacing per-hospital landing pages.
 */
export async function HospitalTemplate({ portal, feedTab, mode }: HospitalTemplateProps) {
  return <HospitalPortalExperience portal={portal} feedTab={feedTab} mode={mode} />;
}

export type { HospitalTemplateProps };

"use client";

import { useEffect, useRef } from "react";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

export function VolunteerDetailTracker({
  portalSlug,
  opportunityId,
  opportunitySlug,
}: {
  portalSlug: string;
  opportunityId: string;
  opportunitySlug: string;
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    trackPortalAction(portalSlug, {
      action_type: "resource_clicked",
      page_type: "community",
      section_key: "volunteer_detail",
      target_kind: "volunteer_detail_view",
      target_id: opportunityId,
      target_label: opportunitySlug,
      metadata: {
        surface: "volunteer_detail",
        opportunity_slug: opportunitySlug,
      },
    });
  }, [opportunityId, opportunitySlug, portalSlug]);

  return null;
}

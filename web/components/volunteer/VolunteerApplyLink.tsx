"use client";

import type { ReactNode } from "react";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

export function VolunteerApplyLink({
  portalSlug,
  opportunityId,
  opportunitySlug,
  href,
  sectionKey,
  className,
  children,
}: {
  portalSlug: string;
  opportunityId: string;
  opportunitySlug: string;
  href: string;
  sectionKey: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        trackPortalAction(portalSlug, {
          action_type: "resource_clicked",
          page_type: "community",
          section_key: sectionKey,
          target_kind: "volunteer_apply",
          target_id: opportunityId,
          target_label: opportunitySlug,
          target_url: href,
          metadata: {
            surface: sectionKey,
            opportunity_slug: opportunitySlug,
          },
        });
      }}
    >
      {children}
    </a>
  );
}

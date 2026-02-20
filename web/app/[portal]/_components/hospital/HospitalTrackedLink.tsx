"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { trackPortalAction, type PortalActionType } from "@/lib/analytics/portal-action-tracker";

type TrackingContext = {
  actionType: PortalActionType;
  portalSlug: string;
  pageType?: "hospital" | "feed" | "find" | "community";
  hospitalSlug?: string;
  modeContext?: HospitalAudienceMode;
  sectionKey?: string;
  targetKind?: string;
  targetId?: string;
  targetLabel?: string;
  targetUrl?: string;
  metadata?: Record<string, unknown>;
};

type Props = {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  external?: boolean;
  tracking: TrackingContext;
};

export default function HospitalTrackedLink({
  href,
  className,
  style,
  children,
  external = false,
  tracking,
}: Props) {
  const onClick = () => {
    trackPortalAction(tracking.portalSlug, {
      action_type: tracking.actionType,
      page_type: tracking.pageType || "hospital",
      hospital_slug: tracking.hospitalSlug,
      mode_context: tracking.modeContext,
      section_key: tracking.sectionKey,
      target_kind: tracking.targetKind,
      target_id: tracking.targetId,
      target_label: tracking.targetLabel,
      target_url: tracking.targetUrl || href,
      metadata: tracking.metadata,
    });
  };

  if (external) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noreferrer" onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}

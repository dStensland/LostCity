"use client";

import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";

export type EmoryActionRailAction = {
  key: string;
  label: string;
  href: string;
  external?: boolean;
  actionType: "resource_clicked" | "wayfinding_opened";
  targetKind: string;
  targetId?: string;
  targetLabel?: string;
  targetUrl?: string;
};

type EmoryActionRailProps = {
  portalSlug: string;
  mode: HospitalAudienceMode;
  sectionKey: string;
  hospitalSlug?: string;
  actions: EmoryActionRailAction[];
};

export default function EmoryActionRail({
  portalSlug,
  mode,
  sectionKey,
  hospitalSlug,
  actions,
}: EmoryActionRailProps) {
  if (actions.length === 0) return null;

  return (
    <section data-emory-action-rail className="mt-5">
      <div className="rounded-2xl border border-[var(--line-strong)]/70 bg-[color:color-mix(in_srgb,var(--card-bg)_92%,white_8%)] p-2 shadow-[0_10px_24px_rgba(3,43,100,0.12)]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {actions.map((action, index) => (
            <HospitalTrackedLink
              key={action.key}
              href={action.href}
              external={action.external}
              tracking={{
                actionType: action.actionType,
                portalSlug,
                hospitalSlug,
                modeContext: mode,
                sectionKey,
                targetKind: action.targetKind,
                targetId: action.targetId || action.key,
                targetLabel: action.targetLabel || action.label,
                targetUrl: action.targetUrl || action.href,
              }}
              className={`inline-flex min-h-10 items-center justify-center px-3 py-2 text-center text-xs sm:text-sm ${
                index === 0 ? "emory-primary-btn" : "emory-secondary-btn"
              }`}
            >
              {action.label}
            </HospitalTrackedLink>
          ))}
        </div>
      </div>
    </section>
  );
}

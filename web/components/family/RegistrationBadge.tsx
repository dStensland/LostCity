"use client";

import { memo } from "react";
import {
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUS_COLORS,
  type RegistrationStatus,
} from "@/lib/types/programs";

interface RegistrationBadgeProps {
  status: RegistrationStatus;
  className?: string;
}

export const RegistrationBadge = memo(function RegistrationBadge({
  status,
  className = "",
}: RegistrationBadgeProps) {
  const colorClass = REGISTRATION_STATUS_COLORS[status];
  const label = REGISTRATION_STATUS_LABELS[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
});

export type { RegistrationBadgeProps };

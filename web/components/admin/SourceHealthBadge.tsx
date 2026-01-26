"use client";

type Props = {
  isActive: boolean;
  successRate: number;
  lastRun: string | null;
  lastStatus: string | null;
  size?: "sm" | "md";
};

export type HealthStatus = "healthy" | "warning" | "failing" | "inactive" | "unknown";

export function getHealthStatus(
  isActive: boolean,
  successRate: number,
  lastRun: string | null,
  lastStatus: string | null
): HealthStatus {
  if (!isActive) return "inactive";
  if (!lastRun) return "unknown";
  if (lastStatus === "error" || successRate === 0) return "failing";
  if (successRate < 80) return "warning";
  return "healthy";
}

export default function SourceHealthBadge({
  isActive,
  successRate,
  lastRun,
  lastStatus,
  size = "md",
}: Props) {
  const status = getHealthStatus(isActive, successRate, lastRun, lastStatus);

  const colors: Record<HealthStatus, string> = {
    healthy: "bg-green-500",
    warning: "bg-yellow-500",
    failing: "bg-red-500",
    inactive: "bg-[var(--muted)]",
    unknown: "bg-[var(--twilight)]",
  };

  const labels: Record<HealthStatus, string> = {
    healthy: "Healthy",
    warning: "Warning",
    failing: "Failing",
    inactive: "Inactive",
    unknown: "Never Run",
  };

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
  };

  return (
    <div className="flex items-center gap-2" title={labels[status]}>
      <span className={`${sizeClasses[size]} rounded-full ${colors[status]}`} />
      {size === "md" && (
        <span className="font-mono text-xs text-[var(--muted)]">
          {labels[status]}
        </span>
      )}
    </div>
  );
}

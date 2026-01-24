"use client";

type Props = {
  label: string;
  value: number | string;
  trend?: number; // Percentage change
  trendLabel?: string;
  format?: "number" | "percentage" | "currency";
  size?: "small" | "medium" | "large";
};

export default function AnalyticsKPICard({
  label,
  value,
  trend,
  trendLabel = "vs last period",
  format = "number",
  size = "medium",
}: Props) {
  const formatValue = (val: number | string): string => {
    if (typeof val === "string") return val;

    switch (format) {
      case "percentage":
        return `${val.toFixed(1)}%`;
      case "currency":
        return `$${val.toLocaleString()}`;
      default:
        return val.toLocaleString();
    }
  };

  const sizeClasses = {
    small: "p-3",
    medium: "p-4",
    large: "p-6",
  };

  const valueSizes = {
    small: "text-xl",
    medium: "text-3xl",
    large: "text-4xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg`}
    >
      <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`font-mono ${valueSizes[size]} font-bold text-[var(--coral)]`}>
        {formatValue(value)}
      </p>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className={`font-mono text-xs font-medium ${
              trend > 0
                ? "text-green-400"
                : trend < 0
                ? "text-red-400"
                : "text-[var(--muted)]"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
          <span className="font-mono text-[0.65rem] text-[var(--muted)]">
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}

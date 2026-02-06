"use client";

import { useMemo } from "react";

type DataPoint = {
  date: string;
  value: number;
};

type Props = {
  data: DataPoint[];
  title: string;
  color?: string;
  height?: number;
  showLabels?: boolean;
  format?: "number" | "percentage";
};

const HEIGHT_CLASS_MAP: Record<number, { outer: string; inner: string }> = {
  160: { outer: "h-[160px]", inner: "h-[100px]" },
  180: { outer: "h-[180px]", inner: "h-[120px]" },
  200: { outer: "h-[200px]", inner: "h-[140px]" },
  220: { outer: "h-[220px]", inner: "h-[160px]" },
  240: { outer: "h-[240px]", inner: "h-[180px]" },
  260: { outer: "h-[260px]", inner: "h-[200px]" },
  280: { outer: "h-[280px]", inner: "h-[220px]" },
  300: { outer: "h-[300px]", inner: "h-[240px]" },
  320: { outer: "h-[320px]", inner: "h-[260px]" },
};

export default function AnalyticsChart({
  data,
  title,
  color = "var(--coral)",
  height = 200,
  showLabels = true,
  format = "number",
}: Props) {
  const { points, maxValue, minValue, labels } = useMemo(() => {
    if (data.length === 0) {
      return { points: "", maxValue: 0, minValue: 0, labels: [] };
    }

    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const padding = 40;
    const chartHeight = height - padding;

    const pointsArray = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = chartHeight - ((d.value - min) / range) * chartHeight + padding / 2;
      return `${x},${y}`;
    });

    // Get first, middle, and last date labels
    const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];
    const labelPositions: Record<number, "start" | "center" | "end"> = {};
    labelIndices.forEach((idx, positionIndex) => {
      if (idx >= data.length) return;
      if (labelPositions[idx]) return;
      if (positionIndex === 0) labelPositions[idx] = "start";
      if (positionIndex === 1) labelPositions[idx] = "center";
      if (positionIndex === 2) labelPositions[idx] = "end";
    });
    const dateLabels = Object.entries(labelPositions).map(([idx, position]) => ({
      position,
      date: formatDate(data[Number(idx)].date),
    }));

    return {
      points: pointsArray.join(" "),
      maxValue: max,
      minValue: min,
      labels: dateLabels,
    };
  }, [data, height]);

  const formatValue = (val: number): string => {
    if (format === "percentage") return `${val.toFixed(0)}%`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toFixed(0);
  };

  const heightKeys = Object.keys(HEIGHT_CLASS_MAP).map((key) => Number(key));
  const resolvedHeight = heightKeys.reduce((closest, candidate) => (
    Math.abs(candidate - height) < Math.abs(closest - height) ? candidate : closest
  ), heightKeys[0]);
  const heightClasses = HEIGHT_CLASS_MAP[resolvedHeight];

  if (data.length === 0) {
    return (
      <div
        className={`bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4 ${heightClasses.outer}`}
      >
        <p className="font-mono text-xs text-[var(--muted)] uppercase mb-2">{title}</p>
        <div className="flex items-center justify-center h-full text-[var(--muted)] font-mono text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-xs text-[var(--muted)] uppercase">{title}</p>
        <p className="font-mono text-sm text-[var(--cream)]">
          {formatValue(data[data.length - 1]?.value || 0)}
        </p>
      </div>

      <div className={`relative ${heightClasses.inner}`}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-right pr-2">
          <span className="font-mono text-[0.6rem] text-[var(--muted)]">
            {formatValue(maxValue)}
          </span>
          <span className="font-mono text-[0.6rem] text-[var(--muted)]">
            {formatValue(minValue)}
          </span>
        </div>

        {/* Chart area */}
        <svg
          className="absolute left-8 right-0 top-0 bottom-0 w-[calc(100%-32px)] h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1="25"
            x2="100"
            y2="25"
            stroke="var(--twilight)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="var(--twilight)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <line
            x1="0"
            y1="75"
            x2="100"
            y2="75"
            stroke="var(--twilight)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />

          {/* Area fill */}
          <polygon
            points={`0,100 ${points} 100,100`}
            fill={color}
            fillOpacity="0.1"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* X-axis labels */}
      {showLabels && labels.length > 0 && (
        <div className="grid grid-cols-3 h-4 ml-8 font-mono text-[0.6rem] text-[var(--muted)]">
          <span className="text-left whitespace-nowrap">
            {labels.find((label) => label.position === "start")?.date || ""}
          </span>
          <span className="text-center whitespace-nowrap">
            {labels.find((label) => label.position === "center")?.date || ""}
          </span>
          <span className="text-right whitespace-nowrap">
            {labels.find((label) => label.position === "end")?.date || ""}
          </span>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

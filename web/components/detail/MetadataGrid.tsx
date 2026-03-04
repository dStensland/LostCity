export interface MetadataItem {
  label: string;
  value: string;
  color?: string;
}

export interface MetadataGridProps {
  items: MetadataItem[];
  className?: string;
}

const COLOR_CLASS_MAP: Record<string, string> = {
  "var(--neon-green)": "text-[var(--neon-green)]",
  "var(--gold)": "text-[var(--gold)]",
  "var(--coral)": "text-[var(--coral)]",
  "var(--neon-magenta)": "text-[var(--neon-magenta)]",
  "var(--neon-cyan)": "text-[var(--neon-cyan)]",
  "var(--muted)": "text-[var(--muted)]",
  "var(--soft)": "text-[var(--soft)]",
  "var(--cream)": "text-[var(--cream)]",
};

export function MetadataGrid({ items, className = "" }: MetadataGridProps) {
  if (items.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-baseline gap-x-5 gap-y-2 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex items-baseline gap-1.5">
          <span className="font-mono text-xs uppercase tracking-[0.13em] text-[var(--muted)]">
            {item.label}
          </span>
          <span
            className={`text-sm font-semibold leading-snug ${
              (item.color && COLOR_CLASS_MAP[item.color]) || "text-[var(--cream)]"
            }`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

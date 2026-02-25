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
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--muted)]">
            {item.label}
          </span>
          <span
            className={`text-base font-medium ${
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

export interface MetadataItem {
  label: string;
  value: string;
  color?: string;
}

export interface MetadataGridProps {
  items: MetadataItem[];
  className?: string;
}

export function MetadataGrid({ items, className = "" }: MetadataGridProps) {
  if (items.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--muted)]">
            {item.label}
          </span>
          <span
            className="text-base font-medium"
            style={{ color: item.color || "var(--cream)" }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

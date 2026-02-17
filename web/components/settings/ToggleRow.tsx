"use client";

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}

export default function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
      <div className="pr-4">
        <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
          {label}
        </h3>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          {description}
        </p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
          value ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
        }`}
        aria-label={`${label} ${value ? "enabled" : "disabled"}`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            value ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

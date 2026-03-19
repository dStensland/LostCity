import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export interface NeonBackButtonProps {
  onClose: () => void;
  /** Absolute-positioned over a hero image (default) vs inline in document flow */
  floating?: boolean;
}

/**
 * Back button with elevation shadow.
 * Solid surface, border, and shadow-card-sm — no glassmorphism or backdrop-blur.
 *
 * - `floating` (default): absolute top-left over a hero image
 * - `floating={false}`: inline with bottom margin (e.g. OrgDetailView)
 */
export default function NeonBackButton({ onClose, floating = true }: NeonBackButtonProps) {
  return (
    <button
      onClick={onClose}
      aria-label="Go back"
      className={`group flex items-center gap-2 px-3.5 min-h-[44px] rounded-full font-mono text-xs font-semibold tracking-wider uppercase transition-all duration-300 bg-[var(--night)] border border-[var(--twilight)] shadow-card-sm hover:border-[var(--soft)] hover:shadow-card-md focus-ring ${
        floating ? "absolute top-3 left-3 z-10" : "mb-4"
      }`}
    >
      <ArrowLeft
        size={16}
        weight="bold"
        className="transition-transform duration-300 group-hover:-translate-x-0.5 text-[var(--soft)] group-hover:text-[var(--cream)]"
      />
      <span className="text-[var(--soft)] group-hover:text-[var(--cream)] transition-colors duration-300">
        Back
      </span>
    </button>
  );
}

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export interface NeonBackButtonProps {
  onClose: () => void;
  /** Absolute-positioned over a hero image (default) vs inline in document flow */
  floating?: boolean;
}

/**
 * Glassmorphic back button with neon hover glow.
 * Styles defined in globals.css (.neon-back-btn, .neon-back-icon, .neon-back-text).
 *
 * - `floating` (default): absolute top-left over a hero image
 * - `floating={false}`: inline with bottom margin (e.g. OrgDetailView)
 */
export default function NeonBackButton({ onClose, floating = true }: NeonBackButtonProps) {
  return (
    <button
      onClick={onClose}
      aria-label="Go back"
      className={`group flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold tracking-wider uppercase transition-all duration-300 hover:scale-105 neon-back-btn focus-ring ${
        floating ? "absolute top-3 left-3 z-10" : "mb-4"
      }`}
    >
      <ArrowLeft
        size={16}
        weight="bold"
        className="transition-transform duration-300 group-hover:-translate-x-0.5 neon-back-icon"
      />
      <span className="transition-all duration-300 group-hover:text-[var(--coral)] neon-back-text">
        Back
      </span>
    </button>
  );
}

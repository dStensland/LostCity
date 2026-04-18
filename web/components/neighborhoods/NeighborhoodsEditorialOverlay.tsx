import {
  generateNeighborhoodsOverlay,
  type NeighborhoodsOverlayContext,
} from "@/lib/editorial-templates";

/**
 * Editorial overlay that sits on top of the neighborhoods index map.
 *
 * Renders one of two variants:
 *   - alive_tonight: "ALIVE TONIGHT" + "N neighborhoods have events starting soon"
 *   - week_scope:    "THIS WEEK" + "Across {cityName}"
 * Both counts zero: renders nothing (no zero-state placeholder copy).
 *
 * String literals are locked in `lib/editorial-templates.ts`. Do not
 * inline-concatenate in this component.
 */
interface NeighborhoodsEditorialOverlayProps extends NeighborhoodsOverlayContext {
  className?: string;
}

export default function NeighborhoodsEditorialOverlay({
  className,
  ...ctx
}: NeighborhoodsEditorialOverlayProps) {
  const overlay = generateNeighborhoodsOverlay(ctx);
  if (overlay.kind === "none" || !overlay.kicker || !overlay.headline) {
    return null;
  }

  const kickerColor =
    overlay.kind === "alive_tonight" ? "var(--coral)" : "var(--muted)";

  return (
    <div
      className={`pointer-events-none flex flex-col gap-1 ${className ?? ""}`}
    >
      <p
        className="font-mono text-2xs font-bold uppercase tracking-[0.14em]"
        style={{ color: kickerColor }}
      >
        {overlay.kicker}
      </p>
      <p className="text-base font-medium text-[var(--cream)]">
        {overlay.headline}
      </p>
    </div>
  );
}

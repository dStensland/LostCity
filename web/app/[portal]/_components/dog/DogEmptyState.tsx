interface Props {
  emoji?: string;
  headline: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function DogEmptyState({
  emoji,
  headline,
  body,
  ctaLabel,
  ctaHref,
}: Props) {
  return (
    <div className="text-center py-12 px-4">
      {emoji && <p className="text-3xl mb-3">{emoji}</p>}
      <p
        className="dog-display text-base font-bold"
        style={{ color: "var(--dog-charcoal)" }}
      >
        {headline}
      </p>
      {body && (
        <p className="mt-1 text-sm" style={{ color: "var(--dog-stone)" }}>
          {body}
        </p>
      )}
      {ctaLabel && ctaHref && (
        <a href={ctaHref} className="dog-btn-secondary inline-block mt-4 text-sm">
          {ctaLabel}
        </a>
      )}
    </div>
  );
}

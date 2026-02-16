import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  seeAllHref?: string | null;
  seeAllCount?: number;
  portalSlug: string;
}

export default function DogSectionHeader({
  title,
  subtitle,
  seeAllHref,
  seeAllCount,
  portalSlug,
}: Props) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h2 className="dog-section-title">{title}</h2>
        {subtitle && (
          <p
            className="text-xs -mt-1 mb-2"
            style={{ color: "var(--dog-stone)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {seeAllHref && (
        <Link
          href={`/${portalSlug}${seeAllHref}`}
          className="text-sm font-semibold whitespace-nowrap flex-shrink-0 mt-1"
          style={{ color: "var(--dog-orange)" }}
        >
          See all{seeAllCount != null ? ` (${seeAllCount})` : ""} &rarr;
        </Link>
      )}
    </div>
  );
}

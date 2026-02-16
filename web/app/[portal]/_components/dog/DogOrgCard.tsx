import Link from "next/link";
import Image from "next/image";
import type { DogOrg } from "@/lib/dog-data";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface Props {
  org: DogOrg;
  portalSlug: string;
}

export default function DogOrgCard({ org, portalSlug }: Props) {
  return (
    <Link
      href={`/${portalSlug}/spots/${org.slug}`}
      className="dog-card p-4 flex items-start gap-3 group"
    >
      {org.logo_url ? (
        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={getProxiedImageSrc(org.logo_url)}
            alt={org.name}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(232, 121, 160, 0.15)" }}
        >
          <span className="text-base">&#10084;&#65039;</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3
          className="font-bold text-sm"
          style={{ color: "var(--dog-charcoal)" }}
        >
          {org.name}
        </h3>
        {org.description && (
          <p
            className="text-xs line-clamp-1 mt-0.5"
            style={{ color: "var(--dog-stone)" }}
          >
            {org.description}
          </p>
        )}
        <p className="text-xs mt-0.5" style={{ color: "var(--dog-stone)" }}>
          {org.org_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
      </div>
      {org.website && (
        <span
          className="text-xs font-semibold flex-shrink-0"
          style={{ color: "var(--dog-orange)" }}
        >
          Visit &rarr;
        </span>
      )}
    </Link>
  );
}

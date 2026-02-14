import Image from "next/image";
import Link from "next/link";
import type { PCMTenant } from "@/lib/marketplace-data";
import {
  classifyTenant,
  TENANT_CATEGORY_LABELS,
  type TenantCategory,
} from "@/lib/marketplace-art";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface MarketplaceTenantCardProps {
  tenant: PCMTenant;
  portalSlug: string;
}

const CATEGORY_COLORS: Record<TenantCategory, string> = {
  coffee: "bg-[#C8944A]/10 text-[#9B7032]",
  lunch: "bg-[#B5674A]/10 text-[#8F4E36]",
  dinner: "bg-[#7A8A94]/10 text-[#5C6B74]",
  drinks: "bg-[#B5674A]/10 text-[#8F4E36]",
  shopping: "bg-[#6B7FA3]/10 text-[#4E6283]",
  wellness: "bg-[#5A8C5F]/10 text-[#3D6B42]",
  entertainment: "bg-[#C8944A]/10 text-[#9B7032]",
};

export default function MarketplaceTenantCard({
  tenant,
  portalSlug,
}: MarketplaceTenantCardProps) {
  const category = classifyTenant(tenant.venue_type, tenant.vibes);
  const label = TENANT_CATEGORY_LABELS[category];
  const colorClass = CATEGORY_COLORS[category];

  const href = `/${portalSlug}?spot=${tenant.slug}`;
  const description = tenant.description
    ? tenant.description.length > 80
      ? tenant.description.slice(0, 77) + "..."
      : tenant.description
    : null;

  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl border border-[var(--mkt-sand)] bg-white p-3 transition-all hover:border-[var(--mkt-brick)]/30 hover:shadow-[var(--mkt-shadow-medium)]"
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--mkt-cream)]">
        {tenant.image_url ? (
          <Image
            src={getProxiedImageSrc(tenant.image_url)}
            alt={tenant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--mkt-steel)] text-lg font-display">
            {tenant.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-body text-sm font-semibold text-[var(--mkt-charcoal)] truncate group-hover:text-[var(--mkt-brick)] transition-colors">
            {tenant.name}
          </h3>
        </div>
        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-label uppercase tracking-[0.08em] ${colorClass}`}>
          {label}
        </span>
        {description && (
          <p className="mt-1 text-xs text-[var(--mkt-steel)] leading-relaxed line-clamp-1">
            {description}
          </p>
        )}
      </div>
    </Link>
  );
}

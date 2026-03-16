import Link from "next/link";
import { ADV } from "@/lib/adventure-tokens";

export interface SectionHeaderProps {
  label: string;
  icon?: React.ElementType;
  seeAllHref?: string;
  seeAllLabel?: string;
}

export function SectionHeader({ label, icon: Icon, seeAllHref, seeAllLabel = "See all" }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} weight="bold" color={ADV.STONE} />}
        <span
          className="text-xs font-bold uppercase"
          style={{ letterSpacing: "0.12em", color: ADV.DARK }}
        >
          {label}
        </span>
      </div>
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="text-xs font-bold uppercase hover:underline"
          style={{ letterSpacing: "0.1em", color: ADV.TERRACOTTA }}
        >
          {seeAllLabel}
        </Link>
      )}
    </div>
  );
}

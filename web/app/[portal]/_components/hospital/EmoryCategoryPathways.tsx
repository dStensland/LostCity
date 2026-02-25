import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  Heart,
  Carrot,
  UsersThree,
  Baby,
  Lifebuoy,
  ShieldCheck,
  Stethoscope,
} from "@phosphor-icons/react/dist/ssr";
import { hospitalDisplayFont } from "@/lib/hospital-art";

const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  Heart,
  Carrot,
  UsersThree,
  Baby,
  Lifebuoy,
  ShieldCheck,
  Stethoscope,
};

type PathwayCard = {
  key: string;
  title: string;
  blurb: string;
  iconName: string;
  orgCount: number;
  highlightOrgs: string[];
  filterHref: string;
};

type Props = {
  cards: PathwayCard[];
};

export default function EmoryCategoryPathways({ cards }: Props) {
  return (
    <section className="px-4 sm:px-6">
      <h2 className={`${hospitalDisplayFont.className} text-[clamp(1.2rem,2.2vw,1.6rem)] leading-[1.1] text-[var(--cream)] mb-4`}>
        Explore by category
      </h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none sm:pb-0 lg:grid-cols-3 lg:gap-4">
        {cards.map((card) => {
          const Icon = ICON_MAP[card.iconName];
          return (
            <a
              key={card.key}
              href={card.filterHref}
              className="emory-category-card group block no-underline shrink-0 snap-start w-[280px] sm:w-auto"
            >
              <div className="flex items-start gap-3.5">
                {Icon && (
                  <div className="shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--portal-accent)]/8">
                    <Icon
                      size={22}
                      weight="duotone"
                      className="text-[var(--portal-accent)]"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--cream)] leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mt-1 line-clamp-2">
                    {card.blurb}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-[var(--portal-accent)]/10 px-2.5 py-0.5 text-[11px] font-bold text-[var(--portal-accent)]">
                      {card.orgCount} organizations
                    </span>
                    {card.highlightOrgs.length > 0 ? (
                      <span className="text-[11px] text-[var(--muted)] truncate">
                        {card.highlightOrgs.join(", ")}
                      </span>
                    ) : card.orgCount > 0 ? (
                      <span className="text-[11px] italic text-[var(--muted)]">
                        Confidential resources available
                      </span>
                    ) : null}
                  </div>
                  <span className="inline-block mt-3 text-xs font-semibold text-[var(--portal-accent)] group-hover:underline">
                    Explore &rarr;
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

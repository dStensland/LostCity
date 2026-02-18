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
  portalSlug: string;
};

export default function EmoryCategoryPathways({ cards }: Props) {
  return (
    <section className="px-4 sm:px-5">
      <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
        Find what you need
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = ICON_MAP[card.iconName];
          return (
            <a
              key={card.key}
              href={card.filterHref}
              className="emory-category-card block no-underline"
            >
              <div className="flex items-start gap-3">
                {Icon && (
                  <Icon
                    size={24}
                    weight="duotone"
                    className="text-[var(--portal-accent)] shrink-0 mt-0.5"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--charcoal)] leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-snug mt-0.5 line-clamp-1">
                    {card.blurb}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-[var(--portal-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--portal-accent)]">
                      {card.orgCount} orgs
                    </span>
                    {card.highlightOrgs.length > 0 && (
                      <span className="text-xs text-[var(--muted)] truncate">
                        {card.highlightOrgs.join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="inline-block mt-2 text-xs font-medium text-[var(--portal-accent)]">
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

import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";
import type { SectionModule, EntityData } from "@/lib/detail/types";

interface SectionWrapperProps {
  module: SectionModule;
  data: EntityData;
  children: ReactNode;
}

export function SectionWrapper({ module, data, children }: SectionWrapperProps) {
  const count = module.getCount?.(data) ?? null;

  return (
    <section className="border-t border-[var(--twilight)]">
      <div className="px-4 lg:px-8 pt-5 pb-1">
        <SectionHeader label={module.label} count={count} icon={module.icon} />
      </div>
      <div className="px-4 lg:px-8 pb-5">{children}</div>
    </section>
  );
}

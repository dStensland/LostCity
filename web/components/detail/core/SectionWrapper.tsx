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
    <section>
      <div className="w-full h-2 bg-[var(--night)]" />
      <div className="px-4 lg:px-8 py-4 flex flex-col gap-3">
        <SectionHeader label={module.label} count={count} icon={module.icon} />
        <div>{children}</div>
      </div>
    </section>
  );
}

import LinkifyText from "@/components/LinkifyText";
import type { SectionProps } from "@/lib/detail/types";

export function AboutSection({ data }: SectionProps) {
  let description: string | null = null;

  switch (data.entityType) {
    case "event":
      description = data.payload.event.display_description || data.payload.event.description;
      break;
    case "place":
      description = (data.payload.spot as Record<string, unknown>).description as string | null;
      break;
    case "series":
      description = data.payload.series.description;
      break;
    case "festival":
      description = data.payload.festival.description;
      break;
    case "org":
      description = data.payload.organization.description ?? null;
      break;
  }

  if (!description) return null;

  return (
    <div className="text-sm text-[var(--soft)] leading-relaxed">
      <LinkifyText text={description} />
    </div>
  );
}

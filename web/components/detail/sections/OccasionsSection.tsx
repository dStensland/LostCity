import type { SectionProps } from "@/lib/detail/types";
import Badge from "@/components/ui/Badge";

const OCCASION_LABELS: Record<string, string> = {
  date_night: "Date Night",
  groups: "Groups",
  solo: "Solo",
  outdoor_dining: "Outdoor Dining",
  late_night: "Late Night",
  quick_bite: "Quick Bite",
  special_occasion: "Special Occasion",
  beltline: "BeltLine",
  pre_game: "Pre-Game",
  brunch: "Brunch",
  family_friendly: "Family Friendly",
  dog_friendly: "Dog Friendly",
  live_music: "Live Music",
  dancing: "Dancing",
};

export function OccasionsSection({ data }: SectionProps) {
  if (data.entityType !== "place") return null;

  const occasions = data.payload.occasions;
  if (!occasions || occasions.length === 0) return null;

  const spot = data.payload.spot as Record<string, unknown>;
  const spotType = (spot.place_type || spot.spot_type) as string | null;
  const MUSEUM_EXCLUDED = new Set(["brunch", "late_night", "quick_bite", "dancing", "pre_game"]);
  const isMuseumType = ["museum", "gallery", "historic_site", "garden"].includes(spotType ?? "");

  const filtered = isMuseumType
    ? occasions.filter((o) => !MUSEUM_EXCLUDED.has(o.occasion))
    : occasions;

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {filtered.slice(0, 6).map((o) => (
        <Badge key={o.occasion} variant="accent" accentColor="var(--gold)" size="sm">
          {OCCASION_LABELS[o.occasion] || o.occasion.replace(/_/g, " ")}
        </Badge>
      ))}
    </div>
  );
}

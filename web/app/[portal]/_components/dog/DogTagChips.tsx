import { getTagDisplayInfo } from "@/lib/dog-tags";

interface Props {
  vibes: string[] | null;
  maxTags?: number;
}

export default function DogTagChips({ vibes, maxTags = 3 }: Props) {
  if (!vibes || vibes.length === 0) return null;

  const dogTags = vibes
    .map((v) => getTagDisplayInfo(v))
    .filter(Boolean)
    .slice(0, maxTags);

  if (dogTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {dogTags.map((tag) => (
        <span
          key={tag!.machineKey}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{
            background: "rgba(253, 232, 138, 0.5)",
            color: "var(--dog-charcoal)",
          }}
        >
          {tag!.icon} {tag!.label}
        </span>
      ))}
    </div>
  );
}

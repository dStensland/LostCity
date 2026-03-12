"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Image from "@/components/SmartImage";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import Badge from "@/components/ui/Badge";
import { Binoculars, ArrowRight } from "@phosphor-icons/react";

type Props = {
  portalSlug: string;
};

type Quest = {
  id: string;
  title: string;
  subtitle: string;
};

type ArtifactCard = {
  id: string;
  title: string;
  artifactType: string;
  relationshipKind: "standalone_spot" | "parent_destination" | "child_landmark";
  summary: string;
  questIds: string[];
  spot: {
    id: number;
    slug: string;
    name: string;
    venueType: string | null;
    city: string | null;
    neighborhood: string | null;
    imageUrl: string | null;
    shortDescription: string | null;
  };
  parentSpot: {
    slug: string;
    name: string;
  } | null;
  guideMention: {
    sourceKey: string;
    articleTitle: string;
    articleUrl: string;
  } | null;
};

const GUIDE_LABELS: Record<string, string> = {
  atlas_obscura: "Seen in Atlas Obscura",
  atlanta_trails: "Guide: Atlanta Trails",
  explore_georgia: "Hidden Gem: Explore Georgia",
  eater_atlanta: "Also spotted by Eater",
};

const TYPE_LABELS: Record<string, string> = {
  waterfall: "Waterfall",
  summit: "Summit",
  fire_tower: "Fire Tower",
  oddity: "Oddity",
  hidden_green_space: "Hidden Green Space",
  river_access: "River Access",
  starter: "Starter Win",
};

function getRelationshipLabel(artifact: ArtifactCard): string | null {
  if (artifact.relationshipKind === "child_landmark" && artifact.parentSpot) {
    return `Inside ${artifact.parentSpot.name}`;
  }
  if (artifact.relationshipKind === "parent_destination") {
    return `Via ${artifact.spot.name}`;
  }
  return null;
}

export default function YonderArtifactQuestsSection({ portalSlug }: Props) {
  const { data, isLoading } = useQuery<{ quests: Quest[]; artifacts: ArtifactCard[] }>({
    queryKey: ["yonder-artifact-quests", portalSlug],
    queryFn: async () => {
      const res = await fetch(`/api/portals/${portalSlug}/yonder/artifacts`);
      if (!res.ok) {
        throw new Error(`Yonder artifacts fetch failed: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const quests = useMemo(() => data?.quests ?? [], [data?.quests]);
  const artifacts = useMemo(() => data?.artifacts ?? [], [data?.artifacts]);

  const defaultQuestId = quests[0]?.id ?? null;
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(defaultQuestId);

  const activeQuestId = selectedQuestId ?? defaultQuestId;
  const selectedQuest = quests.find((quest) => quest.id === activeQuestId) ?? quests[0] ?? null;

  const visibleArtifacts = useMemo(() => {
    if (!activeQuestId) return artifacts.slice(0, 6);
    return artifacts
      .filter((artifact) => artifact.questIds.includes(activeQuestId))
      .slice(0, 6);
  }, [artifacts, activeQuestId]);

  if (!isLoading && quests.length === 0) return null;

  return (
    <section className="mt-8">
      <FeedSectionHeader
        title="Quest-Worthy Finds"
        subtitle={
          selectedQuest?.subtitle ??
          "A launch-tier artifact shelf built from the strongest current Yonder quest lanes."
        }
        priority="secondary"
        accentColor="var(--gold)"
        icon={<Binoculars weight="duotone" className="w-5 h-5" />}
        badge="Curated"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {quests.map((quest) => {
          const isActive = quest.id === activeQuestId;
          return (
            <button
              key={quest.id}
              type="button"
              onClick={() => setSelectedQuestId(quest.id)}
              className={`px-3 py-1.5 rounded-full border text-xs font-mono transition-colors ${
                isActive
                  ? "bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)]"
                  : "bg-[var(--night)] border-[var(--twilight)]/40 text-[var(--soft)] hover:text-[var(--cream)]"
              }`}
            >
              {quest.title}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleArtifacts.map((artifact) => (
          <Link
            key={artifact.id}
            href={`/${portalSlug}/spots/${artifact.spot.slug}`}
            className="group overflow-hidden rounded-3xl border border-[var(--twilight)]/40 bg-[var(--night)] hover:border-[var(--gold)]/35 transition-colors"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[var(--dusk)]">
              {artifact.spot.imageUrl ? (
                <Image
                  src={artifact.spot.imageUrl}
                  alt={artifact.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/30 to-transparent" />
              <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-3">
                <div>
                  <Badge variant="neutral" size="sm">
                    {TYPE_LABELS[artifact.artifactType] ?? artifact.artifactType}
                  </Badge>
                  <h3 className="mt-2 text-base font-semibold text-[var(--cream)] leading-tight">
                    {artifact.title}
                  </h3>
                </div>
                <ArrowRight
                  className="shrink-0 text-[var(--soft)] group-hover:text-[var(--cream)] transition-colors"
                  size={18}
                  weight="bold"
                />
              </div>
            </div>

            <div className="p-4 space-y-2">
              <p className="text-sm text-[var(--soft)] leading-relaxed">
                {artifact.summary}
              </p>

              {artifact.guideMention ? (
                <div className="text-xs font-mono text-[var(--gold)]">
                  {GUIDE_LABELS[artifact.guideMention.sourceKey] ??
                    artifact.guideMention.sourceKey}
                </div>
              ) : null}

              {getRelationshipLabel(artifact) ? (
                <div className="text-xs font-mono text-[var(--muted)]">
                  {getRelationshipLabel(artifact)}
                </div>
              ) : null}

              <div className="text-xs text-[var(--muted)]">
                {artifact.spot.neighborhood || artifact.spot.city || artifact.spot.name}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

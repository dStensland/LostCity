"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Image from "@/components/SmartImage";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import Badge from "@/components/ui/Badge";
import { Binoculars, ArrowRight } from "@phosphor-icons/react";
import {
  type DestinationNodeIdentityTier,
  getDestinationNodeRelationshipLabel,
  type DestinationNodeRelationshipKind,
} from "@/lib/destination-graph";

type Props = {
  portalSlug: string;
};

type Quest = {
  id: string;
  title: string;
  subtitle: string;
};

type DestinationNodeCard = {
  id: string;
  title: string;
  destinationNodeType: string;
  artifactType?: string;
  relationshipKind: DestinationNodeRelationshipKind;
  identityTier: DestinationNodeIdentityTier;
  launchPriority: number;
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

const IDENTITY_TIER_LABELS: Record<DestinationNodeIdentityTier, string> = {
  standalone_destination: "Destination",
  attached_child: "Inside Destination",
};

export default function YonderDestinationNodeQuestsSection({
  portalSlug,
}: Props) {
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    quests: Quest[];
    destinationNodes: DestinationNodeCard[];
    artifacts: DestinationNodeCard[];
  }>({
    queryKey: ["yonder-destination-node-quests", portalSlug, selectedQuestId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedQuestId) {
        params.set("quest_id", selectedQuestId);
      }
      params.set("limit", "6");
      const queryString = params.toString();
      const res = await fetch(
        `/api/portals/${portalSlug}/yonder/destination-nodes${
          queryString ? `?${queryString}` : ""
        }`,
      );
      if (!res.ok) {
        throw new Error(`Yonder destination nodes fetch failed: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const quests = useMemo(() => data?.quests ?? [], [data?.quests]);
  const destinationNodes = useMemo(
    () => data?.destinationNodes ?? data?.artifacts ?? [],
    [data?.destinationNodes, data?.artifacts],
  );

  const defaultQuestId = quests[0]?.id ?? null;
  const activeQuestId = selectedQuestId ?? defaultQuestId;
  const selectedQuest =
    quests.find((quest) => quest.id === activeQuestId) ?? quests[0] ?? null;

  const visibleDestinationNodes = useMemo(
    () => destinationNodes.slice(0, 6),
    [destinationNodes],
  );

  const getRelationshipLabel = (
    destinationNode: DestinationNodeCard,
  ): string | null =>
    getDestinationNodeRelationshipLabel({
      relationshipKind: destinationNode.relationshipKind,
      spotName: destinationNode.spot.name,
      parentName: destinationNode.parentSpot?.name ?? null,
    });

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
        {visibleDestinationNodes.map((destinationNode) => (
          <Link
            key={destinationNode.id}
            href={`/${portalSlug}/spots/${destinationNode.spot.slug}`}
            className="group overflow-hidden rounded-3xl border border-[var(--twilight)]/40 bg-[var(--night)] hover:border-[var(--gold)]/35 transition-colors"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[var(--dusk)]">
              {destinationNode.spot.imageUrl ? (
                <Image
                  src={destinationNode.spot.imageUrl}
                  alt={destinationNode.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/30 to-transparent" />
              <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral" size="sm">
                      {TYPE_LABELS[destinationNode.destinationNodeType] ??
                        destinationNode.destinationNodeType}
                    </Badge>
                    {destinationNode.identityTier === "attached_child" ? (
                      <Badge variant="info" size="sm">
                        {IDENTITY_TIER_LABELS[destinationNode.identityTier]}
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-[var(--cream)] leading-tight">
                    {destinationNode.title}
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
                {destinationNode.summary}
              </p>

              {destinationNode.guideMention ? (
                <div className="text-xs font-mono text-[var(--gold)]">
                  {GUIDE_LABELS[destinationNode.guideMention.sourceKey] ??
                    destinationNode.guideMention.sourceKey}
                </div>
              ) : null}

              {getRelationshipLabel(destinationNode) ? (
                <div className="text-xs font-mono text-[var(--muted)]">
                  {getRelationshipLabel(destinationNode)}
                </div>
              ) : null}

              <div className="text-xs text-[var(--muted)]">
                {destinationNode.spot.neighborhood ||
                  destinationNode.spot.city ||
                  destinationNode.spot.name}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

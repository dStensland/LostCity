"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { Compass, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { QuestProgressCard } from "./QuestProgressCard";
import { SectionHeader } from "./SectionHeader";
import { useAdventureProgress } from "@/lib/hooks/useAdventureProgress";
import {
  YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
} from "@/config/yonder-launch-destination-nodes";
import type { DestinationNodeRelationshipKind } from "@/lib/destination-graph";
import { ADV } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export interface QuestsViewProps {
  portalSlug: string;
}

type DestinationNodeCard = {
  id: string;
  title: string;
  destinationNodeType: string;
  relationshipKind: DestinationNodeRelationshipKind;
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
  };
  parentSpot: { slug: string; name: string } | null;
};

type Quest = {
  id: string;
  title: string;
  subtitle: string;
};

// ---- Destination node row ------------------------------------------------

function DestinationNodeRow({
  node,
  portalSlug,
  isVisited,
  onMarkVisited,
}: {
  node: DestinationNodeCard;
  portalSlug: string;
  isVisited: boolean;
  onMarkVisited: (slug: string) => void;
}) {
  return (
    <div
      className="flex items-start gap-3 p-3"
      style={{
        borderBottom: `1px solid ${ADV.DARK}20`,
        backgroundColor: ADV.CARD,
      }}
    >
      {/* Small image or placeholder */}
      <Link
        href={`/${portalSlug}/spots/${node.spot.slug}`}
        className="flex-shrink-0 relative overflow-hidden"
        style={{ width: 56, height: 56, border: `2px solid ${ADV.DARK}`, borderRadius: 0 }}
      >
        {node.spot.imageUrl ? (
          <Image
            src={node.spot.imageUrl}
            alt={node.title}
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: `${ADV.STONE}18` }} />
        )}
        {isVisited && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: `${ADV.OLIVE}CC` }}
          >
            <CheckCircle size={20} weight="fill" color="#FFFFFF" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/${portalSlug}/spots/${node.spot.slug}`}
          className="block font-bold leading-tight hover:underline"
          style={{
            fontSize: "0.9375rem",
            color: ADV.DARK,
          }}
        >
          {node.title}
        </Link>
        <p
          className="mt-0.5 text-sm leading-snug line-clamp-2"
          style={{ color: ADV.STONE }}
        >
          {node.summary}
        </p>
        {node.spot.city && (
          <p
            className="mt-1 text-xs font-bold uppercase"
            style={{
              letterSpacing: "0.1em",
              color: `${ADV.STONE}90`,
            }}
          >
            {node.spot.city}
          </p>
        )}
      </div>

      {/* Visit toggle */}
      <button
        type="button"
        onClick={() => onMarkVisited(node.spot.slug)}
        className="flex-shrink-0 p-1 transition-opacity hover:opacity-70"
        aria-label={isVisited ? "Mark as unvisited" : "Mark as visited"}
        style={{ color: isVisited ? ADV.OLIVE : `${ADV.STONE}60` }}
      >
        <CheckCircle size={20} weight={isVisited ? "fill" : "regular"} />
      </button>
    </div>
  );
}

// ---- Quest section -------------------------------------------------------

function QuestSection({
  quest,
  nodes,
  portalSlug,
  isVisited,
  onMarkVisited,
  getVisitedCount,
}: {
  quest: Quest;
  nodes: DestinationNodeCard[];
  portalSlug: string;
  isVisited: (slug: string) => boolean;
  onMarkVisited: (slug: string) => void;
  getVisitedCount: (slugs: string[]) => number;
}) {
  const [expanded, setExpanded] = useState(false);
  const nodeSlugs = nodes.map((n) => n.spot.slug);
  const visitedCount = getVisitedCount(nodeSlugs);

  return (
    <div className="mb-6">
      {/* Quest progress header */}
      <QuestProgressCard
        questId={quest.id}
        title={quest.title}
        subtitle={quest.subtitle}
        totalNodes={nodes.length}
        visitedCount={visitedCount}
        portalSlug={portalSlug}
      />

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase transition-opacity hover:opacity-70"
        style={{
          letterSpacing: "0.1em",
          border: `2px solid ${ADV.DARK}20`,
          borderTop: "none",
          borderRadius: 0,
          backgroundColor: `${ADV.DARK}04`,
          color: ADV.STONE,
        }}
      >
        <span>{expanded ? "Hide" : "Show"} destinations ({nodes.length})</span>
        <ArrowRight
          size={12}
          weight="bold"
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 200ms",
          }}
        />
      </button>

      {/* Node list */}
      {expanded && (
        <div
          style={{
            border: `2px solid ${ADV.DARK}`,
            borderTop: "none",
            borderRadius: 0,
          }}
        >
          {nodes.map((node) => (
            <DestinationNodeRow
              key={node.id}
              node={node}
              portalSlug={portalSlug}
              isVisited={isVisited(node.spot.slug)}
              onMarkVisited={onMarkVisited}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export function QuestsView({ portalSlug }: QuestsViewProps) {
  const { isVisited, markVisited, unmarkVisited, getVisitedCount } = useAdventureProgress();

  const { data, isLoading } = useQuery<{
    quests: Quest[];
    destinationNodes: DestinationNodeCard[];
  }>({
    queryKey: ["adventure-destination-nodes", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/yonder/destination-nodes`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Destination nodes fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const quests = data?.quests ?? [];
  const nodes = useMemo(() => data?.destinationNodes ?? [], [data?.destinationNodes]);

  // Build a map from questId → nodes for that quest
  const nodesByQuestId = useMemo(() => {
    const map = new Map<string, DestinationNodeCard[]>();
    for (const quest of YONDER_LAUNCH_DESTINATION_NODE_QUESTS) {
      const questNodes = nodes
        .filter((n) => n.questIds.includes(quest.id))
        .sort((a, b) => b.launchPriority - a.launchPriority);
      if (questNodes.length > 0) {
        map.set(quest.id, questNodes);
      }
    }
    return map;
  }, [nodes]);

  // Toggle visited (mark if unvisited, unmark if already visited)
  const handleToggleVisited = (slug: string) => {
    if (isVisited(slug)) {
      unmarkVisited(slug);
    } else {
      markVisited(slug);
    }
  };

  const sectionHeader = <SectionHeader label="Quest Lines" icon={Compass} />;

  if (isLoading) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0">
        {sectionHeader}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24"
              style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: `${ADV.STONE}12` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (quests.length === 0 && nodes.length === 0) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0">
        {sectionHeader}
        <div
          className="p-8 text-center"
          style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: ADV.CARD }}
        >
          <p
            className="text-sm font-bold uppercase"
            style={{
              letterSpacing: "0.1em",
              color: ADV.STONE,
            }}
          >
            No quests available
          </p>
        </div>
      </div>
    );
  }

  // Use static quest definitions to drive sections (always shows structure even if API is slow)
  const questsToShow = YONDER_LAUNCH_DESTINATION_NODE_QUESTS.filter(
    (q) => nodesByQuestId.has(q.id),
  );

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0">
      {sectionHeader}
      {questsToShow.map((quest) => {
        const questNodes = nodesByQuestId.get(quest.id) ?? [];
        return (
          <QuestSection
            key={quest.id}
            quest={quest}
            nodes={questNodes}
            portalSlug={portalSlug}
            isVisited={isVisited}
            onMarkVisited={handleToggleVisited}
            getVisitedCount={(slugs) => getVisitedCount(slugs)}
          />
        );
      })}
    </div>
  );
}

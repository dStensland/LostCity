"use client";

import { useState, useEffect } from "react";
import { TagVoteChip } from "./TagVoteChip";

interface EntityTag {
  tag_id: string;
  tag_slug: string;
  tag_label: string;
  tag_group: string;
  confirm_count: number;
  deny_count: number;
  score: number;
  user_vote: "confirm" | "deny" | null;
}

interface NeedsTagListProps {
  entityType: "venue" | "event" | "series" | "festival";
  entityId: number;
  title?: string;
  tagGroups?: string[];
}

const DEFAULT_TAG_GROUPS = ["accessibility", "dietary", "family"];

/**
 * NeedsTagList - Display community-verified needs tags
 *
 * Shows accessibility, dietary, and family needs tags with vote counts.
 * These are the most defensible data in the system (PRD 004 Section 8.1).
 *
 * Usage:
 * <NeedsTagList entityType="venue" entityId={123} />
 */
export function NeedsTagList({
  entityType,
  entityId,
  title = "Accessibility & Needs",
  tagGroups = DEFAULT_TAG_GROUPS,
}: NeedsTagListProps) {
  const [tags, setTags] = useState<EntityTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const queryParams = new URLSearchParams({
          entity_type: entityType,
          entity_id: entityId.toString(),
        });

        const res = await fetch(`/api/tags/vote?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch tags");

        const data = await res.json();
        // Filter to only needs tags
        const needsTags = (data.tags || []).filter((tag: EntityTag) =>
          tagGroups.includes(tag.tag_group)
        );
        setTags(needsTags);
      } catch (err) {
        console.error("Error fetching needs tags:", err);
        setError("Failed to load tags");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [entityType, entityId, tagGroups]);

  const handleVoteChange = (tagSlug: string) => {
    // Optimistically refetch tags after vote
    const refetchTags = async () => {
      try {
        const queryParams = new URLSearchParams({
          entity_type: entityType,
          entity_id: entityId.toString(),
        });

        const res = await fetch(`/api/tags/vote?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const needsTags = (data.tags || []).filter((tag: EntityTag) =>
            tagGroups.includes(tag.tag_group)
          );
          setTags(needsTags);
        }
      } catch (err) {
        console.error("Error refetching tags:", err);
      }
    };

    refetchTags();
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="flex gap-2 flex-wrap">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Fail silently - this is supplemental data
  }

  // Only show if there are tags with votes
  if (tags.length === 0) {
    return null;
  }

  // Group tags by category for better display
  const groupedTags = tags.reduce((acc, tag) => {
    if (!acc[tag.tag_group]) {
      acc[tag.tag_group] = [];
    }
    acc[tag.tag_group].push(tag);
    return acc;
  }, {} as Record<string, EntityTag[]>);

  const groupLabels: Record<string, string> = {
    accessibility: "Accessibility",
    dietary: "Dietary Options",
    family: "Family Friendly",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>

      {Object.entries(groupedTags).map(([group, groupTags]) => (
        <div key={group} className="space-y-2">
          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            {groupLabels[group] || group}
          </h4>
          <div className="flex flex-wrap gap-2">
            {groupTags
              .sort((a, b) => b.score - a.score) // Sort by score (most confirmed first)
              .map((tag) => (
                <TagVoteChip
                  key={tag.tag_id}
                  entityType={entityType}
                  entityId={entityId}
                  tagSlug={tag.tag_slug}
                  tagLabel={tag.tag_label}
                  confirmCount={tag.confirm_count}
                  denyCount={tag.deny_count}
                  userVote={tag.user_vote}
                  onVoteChange={() => handleVoteChange(tag.tag_slug)}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

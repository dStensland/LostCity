"use client";

import { memo, useState } from "react";
import { Users, Plus } from "@phosphor-icons/react";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import { useMyGroups } from "@/lib/hooks/useGroups";
import { GroupCard } from "./GroupCard";
import { CreateGroupModal } from "./CreateGroupModal";

export const MyGroupsSection = memo(function MyGroupsSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!ENABLE_GROUPS_V1) return null;

  return (
    <>
      <MyGroupsSectionInner onCreateClick={() => setIsModalOpen(true)} />
      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
});

// Inner component reads the hook — split so the feature flag gate above avoids
// calling hooks conditionally.
const MyGroupsSectionInner = memo(function MyGroupsSectionInner({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  const { data, isLoading } = useMyGroups();
  const groups = data?.groups ?? [];

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users weight="duotone" className="w-3.5 h-3.5 text-[var(--vibe)]" />
          <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--vibe)]">
            My Groups
          </h2>
          {groups.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--vibe)]/10 text-2xs font-mono font-bold text-[var(--vibe)]">
              {groups.length}
            </span>
          )}
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--vibe)]/10 border border-[var(--vibe)]/20 text-xs font-mono font-medium text-[var(--vibe)] hover:bg-[var(--vibe)]/20 transition-colors active:scale-95"
        >
          <Plus weight="bold" className="w-3 h-3" />
          New
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-[var(--night)] border border-[var(--twilight)] animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--twilight)]/60 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-28 bg-[var(--twilight)]/60 rounded" />
                  <div className="h-3 w-16 bg-[var(--twilight)]/40 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groups list */}
      {!isLoading && groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups.length === 0 && (
        <div className="p-5 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--vibe)]/10 flex items-center justify-center">
            <Users weight="duotone" className="w-6 h-6 text-[var(--vibe)]" />
          </div>
          <p className="text-sm text-[var(--soft)] mb-3">
            Start a group with your crew
          </p>
          <button
            onClick={onCreateClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--vibe)] text-[var(--void)] font-mono text-sm font-medium hover:opacity-90 transition-opacity active:scale-95"
          >
            <Plus weight="bold" className="w-3.5 h-3.5" />
            Create a Group
          </button>
        </div>
      )}
    </section>
  );
});

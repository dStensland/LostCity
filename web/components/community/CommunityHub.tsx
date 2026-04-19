"use client";

import { memo, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  MapPin,
  Plus,
  CaretRight,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { useMyPlans, useActivePlans, useCancelPlan, useUpdatePlan } from "@/lib/hooks/useUserPlans";
import { useFriendRequests } from "@/lib/hooks/useFriendRequests";
import { usePortal } from "@/lib/portal-context";

import { MyGroupsSection } from "@/components/groups/MyGroupsSection";
import { ActivePlanBanner } from "@/components/plans/ActivePlanBanner";
import { FriendsActivity } from "@/components/community/FriendsActivity";
import { FriendSearch } from "@/components/community/FriendSearch";
import { PendingRequests } from "@/components/community/PendingRequests";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { buildCommunityHubUrl } from "@/lib/find-url";
import type { Plan, PlanVisibility } from "@/lib/types/plans";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FRIENDS_SHOWN = 5;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommunityHubProps {
  portalSlug: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPlanDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ─── Active Plan Banner Wrapper (with mutations) ──────────────────────────────

function ActivePlanSection({ portalId }: { portalId: string }) {
  const { data: activePlansData } = useActivePlans(portalId);
  const activePlan = activePlansData?.plans?.[0] ?? null;

  const cancelMutation = useCancelPlan(activePlan?.id ?? "");
  const updateMutation = useUpdatePlan(activePlan?.id ?? "");

  const handleEnd = useCallback(() => {
    if (!activePlan) return;
    cancelMutation.mutate();
  }, [activePlan, cancelMutation]);

  const handleChangeVisibility = useCallback(
    (visibility: PlanVisibility) => {
      if (!activePlan) return;
      updateMutation.mutate({ visibility });
    },
    [activePlan, updateMutation]
  );

  if (!activePlan) return null;

  return (
    <ActivePlanBanner
      plan={activePlan}
      onEnd={handleEnd}
      onChangeVisibility={handleChangeVisibility}
    />
  );
}

// ─── Plans Section (Hero) ─────────────────────────────────────────────────────

function PlansSection({ portalSlug }: { portalSlug: string }) {
  const { user } = useAuth();
  const { portal } = usePortal();
  const { data: friendPlansData, isLoading: friendPlansLoading } = useMyPlans({ scope: "friends" });

  const friendPlans = friendPlansData?.plans ?? [];
  const hasPlans = friendPlans.length > 0;

  return (
    <section>
      <FeedSectionHeader
        title="Plans"
        priority="primary"
        accentColor="var(--coral)"
        icon={<CalendarPlus weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}/plans`}
      />

      <div className="space-y-3">
        {/* Active plan banner — shown when user has an active plan */}
        {portal?.id && <ActivePlanSection portalId={portal.id} />}

        {/* Create a Plan CTA — always visible */}
        <Link
          href={`/${portalSlug}/plans?action=create`}
          className="flex items-center gap-3 p-4 rounded-xl bg-[var(--coral)]/10 border border-[var(--coral)]/25 hover:bg-[var(--coral)]/15 transition-colors active:scale-[0.98] group"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--coral)]/20 flex items-center justify-center group-hover:bg-[var(--coral)]/30 transition-colors">
            <Plus weight="bold" className="w-5 h-5 text-[var(--coral)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--cream)]">
              Create a Plan
            </p>
            <p className="text-xs text-[var(--soft)] mt-0.5">
              Pick events and venues, invite friends
            </p>
          </div>
          <CaretRight weight="bold" className="w-4 h-4 text-[var(--coral)] flex-shrink-0" />
        </Link>

        {/* Friend plans */}
        {friendPlansLoading && (
          <div className="space-y-2.5">
            {[1, 2].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--twilight)]/60" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 bg-[var(--twilight)]/60 rounded" />
                    <div className="h-3 w-20 bg-[var(--twilight)]/40 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasPlans && (
          <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)] divide-y divide-[var(--twilight)]/30">
            {friendPlans.slice(0, MAX_FRIENDS_SHOWN).map((plan) => (
              <FriendPlanCard key={plan.id} plan={plan} portalSlug={portalSlug} />
            ))}
          </div>
        )}

        {/* Empty state — only when logged in with no friend plans */}
        {!friendPlansLoading && !hasPlans && user && (
          <div className="p-4 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] text-center">
            <p className="text-sm text-[var(--soft)]">
              No friend plans yet — create one and invite people
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Compact card for a friend's upcoming plan (using Plan type from plans.ts). */
const FriendPlanCard = memo(function FriendPlanCard({
  plan,
  portalSlug,
}: {
  plan: Plan;
  portalSlug: string;
}) {
  return (
    <Link
      href={`/${portalSlug}/plans/${plan.id}`}
      className="flex items-center gap-3 p-3 hover:bg-[var(--cream)]/[0.03] transition-colors group"
    >
      {/* Status indicator */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-[var(--twilight)] flex items-center justify-center">
        <MapPin weight="duotone" className="w-4 h-4 text-[var(--coral)]" />
      </div>

      {/* Plan info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
          {plan.title ?? "Untitled plan"}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-[var(--soft)]">
            {plan.anchor_type === "event" ? "Event" : plan.anchor_type === "place" ? "Place" : "Series"}
          </span>
          {plan.visibility !== "private" && (
            <>
              <span className="text-[var(--muted)] text-xs">·</span>
              <span className="text-xs text-[var(--muted)] capitalize">{plan.visibility}</span>
            </>
          )}
        </div>
      </div>

      {/* Date badge */}
      <div className="flex-shrink-0 text-right">
        <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-2xs font-mono font-bold text-[var(--gold)]">
          {formatPlanDate(plan.starts_at)}
        </span>
      </div>
    </Link>
  );
});

// ─── Activity Section (deferred) ──────────────────────────────────────────────

function ActivitySection() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section>
      <FeedSectionHeader
        title="Recent Activity"
        priority="tertiary"
        accentColor="var(--soft)"
      />
      <div ref={sentinelRef} />
      {visible ? (
        <FriendsActivity />
      ) : (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-[var(--night)] border border-[var(--twilight)]/40 rounded-xl animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--twilight)]/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 rounded bg-[var(--twilight)]/60" style={{ width: `${50 + i * 12}%` }} />
                  <div className="h-3 rounded bg-[var(--twilight)]/40" style={{ width: `${30 + i * 8}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Find Friends Section ─────────────────────────────────────────────────────

function FindFriendsSection() {
  return (
    <section>
      <FeedSectionHeader
        title="Find Friends"
        priority="tertiary"
        accentColor="var(--neon-cyan)"
        icon={<MagnifyingGlass weight="duotone" className="w-3.5 h-3.5" />}
      />
      <FriendSearch />
    </section>
  );
}

// ─── Unauthenticated State ────────────────────────────────────────────────────

function UnauthenticatedHero({ portalSlug }: { portalSlug: string }) {
  return (
    <div className="relative overflow-hidden">
      <div className="relative p-6 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--coral)]/15 flex items-center justify-center">
          <CalendarPlus weight="duotone" className="w-7 h-7 text-[var(--coral)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--cream)] mb-2">
          Plan your next outing
        </h3>
        <p className="text-sm text-[var(--soft)] mb-5 max-w-xs mx-auto">
          Build plans with friends from real events and venues across the city.
        </p>
        <Link
          href={`/auth/login?redirect=${encodeURIComponent(buildCommunityHubUrl({ portalSlug }))}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all active:scale-95 shadow-lg shadow-[var(--coral)]/20"
        >
          Sign In to Get Started
        </Link>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommunityHub({
  portalSlug,
}: CommunityHubProps) {
  const { user } = useAuth();
  const { pendingRequests } = useFriendRequests({ type: "received" });

  if (!user) {
    return (
      <div className="py-6 space-y-6">
        <UnauthenticatedHero portalSlug={portalSlug} />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-8">
      {/* 1. Pending friend requests — urgent */}
      <PendingRequests requests={pendingRequests} />

      {/* 2. Groups — feature-flag gated internally */}
      <MyGroupsSection />

      {/* 3. Plans — hero section, the differentiator */}
      <PlansSection portalSlug={portalSlug} />

      {/* 4. Recent Activity — deferred until scrolled near */}
      <ActivitySection />

      {/* 5. Find Friends — bottom, for discovery */}
      <FindFriendsSection />
    </div>
  );
}

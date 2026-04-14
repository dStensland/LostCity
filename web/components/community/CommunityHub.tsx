"use client";

import { memo, useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import {
  CalendarPlus,
  Fire,
  MapPin,
  Plus,
  CaretRight,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { useMyHangs, useFriendHangs, useHotVenues, useEndHang, useUpdateHang } from "@/lib/hooks/useHangs";
import { useFriendPlans } from "@/lib/hooks/useFriendPlans";
import { useFriendRequests } from "@/lib/hooks/useFriendRequests";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import { MyGroupsSection } from "@/components/groups/MyGroupsSection";
import { ActiveHangBanner } from "@/components/hangs/ActiveHangBanner";
import { FriendsActivity } from "@/components/community/FriendsActivity";
import { FriendSearch } from "@/components/community/FriendSearch";
import { PendingRequests } from "@/components/community/PendingRequests";
import { FriendOnboarding } from "@/components/community/FriendOnboarding";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { buildCommunityHubUrl } from "@/lib/find-url";
import type { FriendHang, HangVisibility, HotVenue } from "@/lib/types/hangs";
import type { FriendPlan } from "@/lib/hooks/useFriendPlans";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FRIENDS_SHOWN = 5;
const HOT_VENUES_LIMIT = 6;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommunityHubProps {
  portalSlug: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function venueHref(slug: string | null): string | null {
  return slug ? `/spots/${slug}` : null;
}

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

// ─── Plans Section (Hero) ─────────────────────────────────────────────────────

function PlansSection({ portalSlug }: { portalSlug: string }) {
  const { user } = useAuth();
  const { data: friendPlansData, isLoading: friendPlansLoading } = useFriendPlans();

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
        {/* Create a Plan CTA — always visible, always first */}
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
            {friendPlans.slice(0, 5).map((plan) => (
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

/** Compact card for a friend's upcoming plan. */
const FriendPlanCard = memo(function FriendPlanCard({
  plan,
  portalSlug,
}: {
  plan: FriendPlan;
  portalSlug: string;
}) {
  const creator = plan.creator;
  const name = creator?.display_name ?? creator?.username ?? "Someone";
  const items = plan.items ?? [];
  const itemCount = items.length;
  const goingCount = plan.participants?.filter((p) => p.status === "going").length ?? 0;

  // First stop preview — sorted by sort_order
  const firstItem = items.length > 0
    ? [...items].sort((a, b) => a.sort_order - b.sort_order)[0]
    : null;
  const firstVenueName = firstItem?.venue?.name ?? firstItem?.title;
  const firstTime = firstItem?.start_time
    ? new Date(`2000-01-01T${firstItem.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <Link
      href={`/${portalSlug}/plans/${plan.id}`}
      className="flex items-center gap-3 p-3 hover:bg-[var(--cream)]/[0.03] transition-colors group"
    >
      {/* Creator avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-[var(--twilight)]">
        {creator?.avatar_url ? (
          <SmartImage
            src={creator.avatar_url}
            alt={name}
            width={32}
            height={32}
            sizes="32px"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--muted)]">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Plan info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
          {plan.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-[var(--soft)]">{name}</span>
          {itemCount > 0 && (
            <>
              <span className="text-[var(--muted)] text-xs">·</span>
              <span className="text-xs text-[var(--muted)]">
                {itemCount} {itemCount === 1 ? "stop" : "stops"}
              </span>
            </>
          )}
          {goingCount > 0 && (
            <>
              <span className="text-[var(--muted)] text-xs">·</span>
              <span className="text-xs text-[var(--coral)]">
                {goingCount} going
              </span>
            </>
          )}
        </div>
        {firstVenueName && (
          <p className="text-xs text-[var(--soft)] mt-0.5 truncate">
            Starts at {firstVenueName}{firstTime ? ` · ${firstTime}` : ""}
          </p>
        )}
      </div>

      {/* Date badge */}
      <div className="flex-shrink-0 text-right">
        <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-2xs font-mono font-bold text-[var(--gold)]">
          {formatPlanDate(plan.plan_date)}
        </span>
      </div>
    </Link>
  );
});

// ─── Friends Out Now Section ──────────────────────────────────────────────────

function FriendsOutNowSection() {
  const { user } = useAuth();
  const myHangs = useMyHangs();
  const friendHangs = useFriendHangs();
  const endHang = useEndHang();
  const updateHang = useUpdateHang();

  const handleEnd = useCallback(() => {
    endHang.mutate();
  }, [endHang]);

  const handleVisibilityChange = useCallback(
    (visibility: HangVisibility) => {
      updateHang.mutate({ visibility });
    },
    [updateHang]
  );

  const activeHang = myHangs.data?.active ?? null;
  const friends = friendHangs.data?.friends ?? [];

  const isLoading = myHangs.isLoading || friendHangs.isLoading;
  const visibleFriends = friends.slice(0, MAX_FRIENDS_SHOWN);
  const overflowCount = friends.length - MAX_FRIENDS_SHOWN;
  const hasContent = activeHang !== null || friends.length > 0;

  return (
    <section>
      <FeedSectionHeader
        title="Friends Out Now"
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<MapPin weight="duotone" className="w-5 h-5" />}
        badge={friends.length > 0 ? `${friends.length} live` : undefined}
      />

      <div className="space-y-3">
        {/* Active hang banner */}
        {activeHang && (
          <ActiveHangBanner
            hang={activeHang}
            onEnd={handleEnd}
            onChangeVisibility={handleVisibilityChange}
          />
        )}

        {/* Loading state */}
        {isLoading && !activeHang && (
          <div className="p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--twilight)]/60" />
              <div className="h-3 w-32 rounded bg-[var(--twilight)]/60" />
            </div>
          </div>
        )}

        {/* Friend hangs list */}
        {visibleFriends.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
            {visibleFriends.map((item) => (
              <FriendHangRow key={item.hang.id} item={item} />
            ))}
            {overflowCount > 0 && (
              <div className="px-3 py-2 border-t border-[var(--twilight)]/30">
                <span className="text-xs font-mono text-[var(--neon-green)]">
                  +{overflowCount} more {overflowCount === 1 ? "friend" : "friends"} out
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty state — rich onboarding when no content */}
        {!isLoading && !hasContent && user && (
          <FriendOnboarding />
        )}
      </div>
    </section>
  );
}

/** Single friend hang row with "I'm Here Too" action. */
const FriendHangRow = memo(function FriendHangRow({ item }: { item: FriendHang }) {
  const { hang, profile } = item;
  const name = profile.display_name ?? profile.username ?? "Someone";
  const note = hang.note && hang.note.length > 60 ? `${hang.note.slice(0, 60).trimEnd()}…` : hang.note;
  const href = venueHref(hang.venue.slug);
  const profileHref = profile.username ? `/profile/${profile.username}` : `/user/${profile.id}`;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--cream)]/[0.03] transition-colors">
      <Link href={profileHref} className="flex-shrink-0">
        <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--twilight)] relative">
          {profile.avatar_url ? (
            <SmartImage src={profile.avatar_url} alt={name} width={24} height={24} sizes="24px" className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-2xs font-bold text-[var(--muted)]">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <Link href={profileHref} className="text-sm font-medium text-[var(--cream)] hover:text-[var(--neon-green)] transition-colors truncate">
            {name}
          </Link>
          <span className="text-xs text-[var(--soft)] flex-shrink-0">at</span>
          {href ? (
            <Link href={href} className="text-xs text-[var(--soft)] hover:text-[var(--cream)] transition-colors truncate">
              {hang.venue.name}
            </Link>
          ) : (
            <span className="text-xs text-[var(--soft)] truncate">{hang.venue.name}</span>
          )}
        </div>
        {note && <p className="text-xs text-[var(--muted)] truncate mt-0.5">{note}</p>}
      </div>
      {href ? (
        <Link
          href={`${href}?hang=true`}
          className="flex-shrink-0 px-2 py-1 rounded-md bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 text-2xs font-mono font-medium text-[var(--neon-green)] hover:bg-[var(--neon-green)]/20 transition-colors active:scale-95 whitespace-nowrap"
          title={`Check in at ${hang.venue.name}`}
        >
          I&apos;m Here Too
        </Link>
      ) : (
        <span
          className="flex-shrink-0 px-2 py-1 rounded-md bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 text-2xs font-mono font-medium text-[var(--neon-green)] whitespace-nowrap"
          title={`Check in at ${hang.venue.name}`}
        >
          I&apos;m Here Too
        </span>
      )}
    </div>
  );
});

/** Hot venue card for horizontal carousel. */
const HotVenueCard = memo(function HotVenueCard({ venue }: { venue: HotVenue }) {
  const href = venueHref(venue.venue_slug);
  const count = venue.active_count;
  const cardClass = "flex-shrink-0 w-40 snap-start rounded-xl overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift shadow-card-sm block";

  const inner = (
    <>
      <div className="relative h-24 bg-[var(--twilight)] overflow-hidden">
        {venue.venue_image_url ? (
          <SmartImage src={venue.venue_image_url} alt={venue.venue_name} fill sizes="160px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin weight="duotone" className="w-8 h-8 text-[var(--muted)]" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent pointer-events-none" />
        <span className="absolute bottom-2 left-2 text-2xs font-mono text-[var(--neon-green)] bg-[var(--neon-green)]/10 rounded-full px-1.5 py-0.5 border border-[var(--neon-green)]/20">
          {count} {count === 1 ? "person" : "people"}
        </span>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-[var(--cream)] leading-snug truncate">{venue.venue_name}</p>
        {venue.neighborhood && <p className="text-2xs text-[var(--muted)] truncate mt-0.5">{venue.neighborhood}</p>}
      </div>
    </>
  );

  if (href) {
    return <Link href={href} className={cardClass}>{inner}</Link>;
  }
  return <div className={cardClass}>{inner}</div>;
});

// ─── Hot Spots Section ───────────────────────────────────────────────────────

function HotSpotsSection({ portalSlug }: { portalSlug: string }) {
  const { data } = useHotVenues(portalSlug, HOT_VENUES_LIMIT);
  const venues = data?.venues ?? [];

  if (venues.length === 0) return null;

  return (
    <section>
      <FeedSectionHeader
        title="Hot Spots"
        priority="secondary"
        accentColor="var(--coral)"
        icon={<Fire weight="duotone" className="w-5 h-5" />}
        badge={`${venues.length} active`}
      />
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-1">
        {venues.map((venue) => (
          <HotVenueCard key={venue.venue_id} venue={venue} />
        ))}
      </div>
    </section>
  );
}

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
      {/* Sentinel div triggers loading when scrolled near */}
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

      {/* 3. Friends Out Now — secondary, requires social graph */}
      {ENABLE_HANGS_V1 && (
        <FriendsOutNowSection />
      )}

      {/* 4. Hot Spots — venues with active hangs */}
      {ENABLE_HANGS_V1 && (
        <HotSpotsSection portalSlug={portalSlug} />
      )}

      {/* 5. Recent Activity — deferred until scrolled near */}
      <ActivitySection />

      {/* 6. Find Friends — bottom, for discovery */}
      <FindFriendsSection />
    </div>
  );
}

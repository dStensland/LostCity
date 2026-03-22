"use client";

import { useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import SmartImage from "@/components/SmartImage";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  MapPin,
  UserMinus,
  SignOut,
  Link as LinkIcon,
  CheckCircle,
  ClockCounterClockwise,
  Check,
  X as XIcon,
} from "@phosphor-icons/react";
import { useGroup, useGroupSpots, useGroupActivity, useGroupHangs, useLeaveGroup } from "@/lib/hooks/useGroups";
import { useAuth } from "@/lib/auth-context";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import type { GroupActivity, GroupJoinRequest } from "@/lib/types/groups";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "activity" | "spots" | "members" | "requests";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function timeBucket(ts: string): "now" | "today" | "week" {
  const diffH = (Date.now() - new Date(ts).getTime()) / 3_600_000;
  if (diffH < 1) return "now";
  if (diffH < 24) return "today";
  return "week";
}

function venueHref(slug: string | null, id: number): string {
  return slug ? `/spots/${slug}` : `/venues/${id}`;
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  showRequests,
  pendingCount,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  showRequests?: boolean;
  pendingCount?: number;
}) {
  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "activity", label: "Activity" },
    { id: "spots", label: "Spots" },
    { id: "members", label: "Members" },
    ...(showRequests ? [{ id: "requests" as const, label: "Requests", badge: pendingCount }] : []),
  ];

  return (
    <div className="flex border-b border-[var(--twilight)] mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            active === tab.id
              ? "border-[var(--vibe)] text-[var(--vibe)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--soft)]"
          }`}
        >
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[var(--coral)] text-[var(--void)] text-2xs font-bold tabular-nums">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ groupId }: { groupId: string }) {
  const { data: activityData, isLoading: actLoading } = useGroupActivity(groupId);
  const { data: hangsData, isLoading: hangsLoading } = useGroupHangs(groupId);

  const activeHangs = hangsData?.active ?? [];
  const activity = activityData?.activity ?? [];

  const todayItems = activity.filter((a) => timeBucket(a.timestamp) === "today");
  const weekItems = activity.filter((a) => timeBucket(a.timestamp) === "week");

  if (actLoading || hangsLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--twilight)]/60" />
              <div className="h-3.5 w-48 bg-[var(--twilight)]/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isEmpty = activeHangs.length === 0 && activity.length === 0;

  if (isEmpty) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-[var(--soft)]">No activity yet.</p>
        <p className="text-xs text-[var(--muted)] mt-1">
          Check in at a venue to get things started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* NOW — active hangs */}
      {activeHangs.length > 0 && (
        <div>
          <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--neon-green)] mb-2">
            Now
          </p>
          <div className="space-y-2">
            {activeHangs.map((hang) => (
              <div
                key={hang.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--neon-green)]/30"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-[var(--twilight)]">
                  {hang.profile.avatar_url ? (
                    <SmartImage
                      src={hang.profile.avatar_url}
                      alt={hang.profile.display_name ?? ""}
                      width={32}
                      height={32}
                      sizes="32px"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--muted)]">
                      {(hang.profile.display_name ?? hang.profile.username ?? "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--cream)] truncate">
                    {hang.profile.display_name ?? hang.profile.username ?? "Someone"}
                    <span className="text-[var(--soft)] font-normal"> at </span>
                    <Link
                      href={venueHref(hang.venue.slug, hang.venue.id)}
                      className="hover:text-[var(--neon-green)] transition-colors"
                    >
                      {hang.venue.name}
                    </Link>
                  </p>
                  {hang.note && (
                    <p className="text-xs text-[var(--muted)] truncate mt-0.5">{hang.note}</p>
                  )}
                </div>
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earlier Today */}
      {todayItems.length > 0 && (
        <ActivityBucket label="Earlier Today" items={todayItems} />
      )}

      {/* This Week */}
      {weekItems.length > 0 && (
        <ActivityBucket label="This Week" items={weekItems} />
      )}
    </div>
  );
}

function ActivityBucket({
  label,
  items,
}: {
  label: string;
  items: GroupActivity[];
}) {
  return (
    <div>
      <p className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--muted)] mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item, idx) => {
          const name = item.user.display_name ?? item.user.username ?? "Someone";
          let text = "";
          if (item.type === "hang_started") {
            text = `${name} checked in${item.venue ? ` at ${item.venue.name}` : ""}`;
          } else if (item.type === "hang_planned") {
            text = `${name} planned a hang${item.venue ? ` at ${item.venue.name}` : ""}`;
          } else if (item.type === "spot_added") {
            text = `${name} added ${item.venue?.name ?? "a spot"} to group spots`;
          } else if (item.type === "member_joined") {
            text = `${name} joined the group`;
          }

          return (
            <div key={idx} className="flex items-center gap-2.5 px-3 py-2">
              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--twilight)] mt-0.5" />
              <p className="text-sm text-[var(--soft)] truncate">{text}</p>
              <span className="flex-shrink-0 text-xs text-[var(--muted)] tabular-nums">
                {formatRelativeTime(item.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Spots Tab ────────────────────────────────────────────────────────────────

function SpotsTab({ groupId }: { groupId: string }) {
  const { data, isLoading } = useGroupSpots(groupId);
  const spots = data?.spots ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (spots.length === 0) {
    return (
      <div className="py-10 text-center">
        <MapPin weight="duotone" className="w-8 h-8 mx-auto text-[var(--muted)] mb-2" />
        <p className="text-sm text-[var(--soft)]">No shared spots yet.</p>
        <p className="text-xs text-[var(--muted)] mt-1">
          Add venues you&apos;d like to bring the group to.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs text-[var(--muted)] mb-3">
        {spots.length} {spots.length === 1 ? "spot" : "spots"}
      </p>
      <div className="space-y-2">
        {spots.map((spot) => {
          if (!spot.venue) return null;
          const href = venueHref(spot.venue.slug, spot.venue.id);
          return (
            <Link
              key={spot.id}
              href={href}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 hover:border-[var(--soft)]/30 transition-colors group"
            >
              {/* Venue thumbnail */}
              <div className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-[var(--twilight)]">
                {spot.venue.image_url ? (
                  <SmartImage
                    src={spot.venue.image_url}
                    alt={spot.venue.name}
                    width={44}
                    height={44}
                    sizes="44px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin weight="duotone" className="w-5 h-5 text-[var(--muted)]" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--cream)] truncate group-hover:text-[var(--vibe)] transition-colors">
                  {spot.venue.name}
                </p>
                {spot.venue.neighborhood && (
                  <p className="text-xs text-[var(--muted)] truncate">{spot.venue.neighborhood}</p>
                )}
                {spot.note && (
                  <p className="text-xs text-[var(--soft)] italic truncate mt-0.5">{spot.note}</p>
                )}
              </div>
              <ArrowLeft
                weight="bold"
                className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0 rotate-180"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({
  groupId,
  myRole,
}: {
  groupId: string;
  myRole: "admin" | "member";
}) {
  const { data, isLoading } = useGroup(groupId);
  const { user } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const leaveGroup = useLeaveGroup();
  const router = useRouter();

  const [removingId, setRemovingId] = useState<string | null>(null);

  const members = data?.members ?? [];

  const handleRemove = useCallback(
    async (userId: string) => {
      setRemovingId(userId);
      await authFetch<{ success: boolean }>(`/api/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
        showErrorToast: true,
      });
      setRemovingId(null);
    },
    [groupId, authFetch]
  );

  const handleLeave = useCallback(async () => {
    await leaveGroup.mutateAsync(groupId);
    router.push("/");
  }, [leaveGroup, groupId, router]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--twilight)]/60" />
            <div className="h-3.5 w-32 bg-[var(--twilight)]/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Member rows */}
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)] divide-y divide-[var(--twilight)]/30">
        {members.map((member) => {
          const profile = member.profile;
          const displayName =
            profile?.display_name ?? profile?.username ?? "Unknown";
          const isMe = member.user_id === user?.id;
          const joinedDate = new Date(member.joined_at).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          return (
            <div
              key={member.user_id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-[var(--twilight)]">
                {profile?.avatar_url ? (
                  <SmartImage
                    src={profile.avatar_url}
                    alt={displayName}
                    width={36}
                    height={36}
                    sizes="36px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--muted)]">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--cream)] truncate">
                    {displayName}
                    {isMe && (
                      <span className="text-[var(--muted)] font-normal"> (you)</span>
                    )}
                  </p>
                  {member.role === "admin" && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[var(--vibe)]/10 text-2xs font-mono font-bold text-[var(--vibe)]">
                      admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">Joined {joinedDate}</p>
              </div>

              {/* Admin remove action */}
              {myRole === "admin" && !isMe && (
                <button
                  onClick={() => handleRemove(member.user_id)}
                  disabled={removingId === member.user_id}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[var(--coral)]/10 text-[var(--muted)] hover:text-[var(--coral)] transition-colors disabled:opacity-50"
                  aria-label={`Remove ${displayName}`}
                >
                  <UserMinus weight="bold" className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Leave group */}
      <button
        onClick={handleLeave}
        disabled={leaveGroup.isPending}
        className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-xl border border-[var(--coral)]/30 text-[var(--coral)] font-mono text-sm hover:bg-[var(--coral)]/5 transition-colors disabled:opacity-50"
      >
        <SignOut weight="bold" className="w-4 h-4" />
        {leaveGroup.isPending ? "Leaving..." : "Leave Group"}
      </button>
    </div>
  );
}

// ─── Requests Tab ────────────────────────────────────────────────────────────

function RequestsTab({
  groupId,
  onCountChange,
}: {
  groupId: string;
  onCountChange?: (count: number) => void;
}) {
  const { authFetch } = useAuthenticatedFetch();
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await authFetch<{ requests: GroupJoinRequest[] }>(
      `/api/groups/${groupId}/requests`,
      { showErrorToast: false }
    );
    if (data) {
      setRequests(data.requests);
      onCountChange?.(data.requests.length);
    }
    setIsLoading(false);
  }, [groupId, authFetch, onCountChange]);

  // Initial fetch
  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount only
  }, [groupId]);

  const handleDecision = useCallback(
    async (requestId: string, decision: "approved" | "denied") => {
      setProcessingId(requestId);
      const { error } = await authFetch(`/api/groups/${groupId}/requests/${requestId}`, {
        method: "PATCH",
        body: { status: decision },
        showErrorToast: true,
      });
      if (!error) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        onCountChange?.(requests.length - 1);
      }
      setProcessingId(null);
    },
    [groupId, authFetch, onCountChange, requests.length]
  );

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-10 text-center">
        <ClockCounterClockwise weight="duotone" className="w-8 h-8 mx-auto text-[var(--muted)] mb-2" />
        <p className="text-sm text-[var(--soft)]">No pending requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-[var(--muted)] mb-3">
        {requests.length} pending {requests.length === 1 ? "request" : "requests"}
      </p>
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)] divide-y divide-[var(--twilight)]/30">
        {requests.map((req) => {
          const profile = req.profile;
          const displayName = profile?.display_name ?? profile?.username ?? "Unknown";
          const isProcessing = processingId === req.id;

          return (
            <div key={req.id} className="flex items-center gap-3 px-3 py-2.5">
              {/* Avatar */}
              <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-[var(--twilight)]">
                {profile?.avatar_url ? (
                  <SmartImage
                    src={profile.avatar_url}
                    alt={displayName}
                    width={36}
                    height={36}
                    sizes="36px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--muted)]">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Name + message */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--cream)] truncate">
                  {displayName}
                </p>
                {req.message && (
                  <p className="text-xs text-[var(--soft)] truncate mt-0.5 italic">
                    &ldquo;{req.message}&rdquo;
                  </p>
                )}
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {formatRelativeTime(req.created_at)}
                </p>
              </div>

              {/* Approve / Deny buttons */}
              <div className="flex-shrink-0 flex items-center gap-1.5">
                <button
                  onClick={() => handleDecision(req.id, "approved")}
                  disabled={isProcessing}
                  className="p-1.5 rounded-lg bg-[var(--neon-green)]/10 hover:bg-[var(--neon-green)]/20 text-[var(--neon-green)] transition-colors disabled:opacity-50"
                  aria-label={`Approve ${displayName}`}
                >
                  <Check weight="bold" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDecision(req.id, "denied")}
                  disabled={isProcessing}
                  className="p-1.5 rounded-lg hover:bg-[var(--coral)]/10 text-[var(--muted)] hover:text-[var(--coral)] transition-colors disabled:opacity-50"
                  aria-label={`Deny ${displayName}`}
                >
                  <XIcon weight="bold" className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("activity");
  const [copied, setCopied] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const { data, isLoading, error } = useGroup(groupId);

  // All hooks must be declared before any conditional returns
  const inviteCode = data?.group.invite_code ?? null;
  const handleCopyInvite = useCallback(() => {
    if (!inviteCode) return;
    const url = `${window.location.origin}/groups/join/${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteCode]);

  if (!ENABLE_GROUPS_V1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)] font-mono text-sm">Groups are coming soon.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-4 pb-20">
          <div className="h-8 w-24 rounded bg-[var(--twilight)] animate-pulse mb-6" />
          <div className="h-20 rounded-xl bg-[var(--night)] border border-[var(--twilight)] animate-pulse mb-4" />
          <div className="h-8 rounded-lg bg-[var(--twilight)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[var(--soft)] mb-3">Group not found or access denied.</p>
          <button
            onClick={() => router.back()}
            className="text-[var(--vibe)] font-mono text-sm hover:opacity-80 transition-opacity"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { group, my_role } = data;
  const estDate = new Date(group.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-20">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[var(--soft)] hover:text-[var(--cream)] transition-colors mb-5 font-mono text-sm"
        >
          <ArrowLeft weight="bold" className="w-4 h-4" />
          Back
        </button>

        {/* Group header */}
        <div className="flex items-start gap-4 mb-5">
          {/* Emoji avatar */}
          <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-[var(--vibe)]/10 border border-[var(--vibe)]/20 flex items-center justify-center text-3xl leading-none">
            {group.emoji ?? "👥"}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--cream)] truncate">{group.name}</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              {/* member count pulled from detail — no meta field here, derive from members array */}
              Est. {estDate}
            </p>
            {group.description && (
              <p className="text-sm text-[var(--soft)] mt-1 line-clamp-2">{group.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex flex-col gap-2">
            {/* Invite */}
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--vibe)] text-[var(--void)] font-mono text-xs font-medium hover:opacity-90 transition-opacity active:scale-95 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <CheckCircle weight="bold" className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <LinkIcon weight="bold" className="w-3.5 h-3.5" />
                  Invite
                </>
              )}
            </button>
            {/* Check In — links to find venues via feed */}
            <Link
              href={`/?view=places`}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--neon-green)]/40 text-[var(--neon-green)] font-mono text-xs font-medium hover:bg-[var(--neon-green)]/5 transition-colors whitespace-nowrap"
            >
              <Users weight="bold" className="w-3.5 h-3.5" />
              Check In
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <TabBar
          active={activeTab}
          onChange={setActiveTab}
          showRequests={my_role === "admin" && group.join_policy === "request"}
          pendingCount={pendingRequestCount}
        />

        {/* Tab content */}
        {activeTab === "activity" && <ActivityTab groupId={groupId} />}
        {activeTab === "spots" && <SpotsTab groupId={groupId} />}
        {activeTab === "members" && (
          <MembersTab groupId={groupId} myRole={my_role} />
        )}
        {activeTab === "requests" && (
          <RequestsTab groupId={groupId} onCountChange={setPendingRequestCount} />
        )}
      </div>
    </div>
  );
}

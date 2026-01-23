"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import { useAuth } from "@/lib/auth-context";
import { usePortalSlug } from "@/lib/portal-context";
import { useToast } from "@/components/Toast";
import { formatDistanceToNow } from "date-fns";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  inviter?: Profile | null;
  invitee?: Profile | null;
};

type Tab = "requests" | "friends";

function FriendsPageContent() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const portalSlug = usePortalSlug();

  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/friend-requests?type=all");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setPendingCount(data.pendingCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      setLoading(true);
      Promise.all([fetchRequests(), fetchFriends()]).finally(() => {
        setLoading(false);
      });
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, fetchRequests, fetchFriends]);

  const handleAccept = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (res.ok) {
        showToast("Friend request accepted!");
        fetchRequests();
        fetchFriends();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to accept", "error");
      }
    } catch {
      showToast("Failed to accept request", "error");
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (res.ok) {
        showToast("Request declined");
        fetchRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to decline", "error");
      }
    } catch {
      showToast("Failed to decline request", "error");
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("Request cancelled");
        fetchRequests();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to cancel", "error");
      }
    } catch {
      showToast("Failed to cancel request", "error");
    }
  };

  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  // Not logged in
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-xl text-[var(--cream)] font-medium mb-2">Sign in to see your friends</h1>
          <p className="text-[var(--muted)] text-sm mb-6">Connect with friends to see what events they are going to</p>
          <Link
            href="/auth/login?redirect=/friends"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors font-mono text-sm font-medium"
          >
            Sign In
          </Link>
        </main>
        <PageFooter />
      </div>
    );
  }

  const pendingReceived = requests.filter((r) => r.status === "pending" && r.invitee_id === user?.id);
  const pendingSent = requests.filter((r) => r.status === "pending" && r.inviter_id === user?.id);

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl text-[var(--cream)] italic mb-6">Friends</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--twilight)]">
          <button
            onClick={() => setTab("requests")}
            className={`px-4 py-2 font-mono text-sm transition-colors relative ${
              tab === "requests"
                ? "text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Requests
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-medium">
                {pendingCount}
              </span>
            )}
            {tab === "requests" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--coral)]" />
            )}
          </button>
          <button
            onClick={() => setTab("friends")}
            className={`px-4 py-2 font-mono text-sm transition-colors relative ${
              tab === "friends"
                ? "text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            My Friends
            <span className="ml-2 text-[var(--muted)]">({friends.length})</span>
            {tab === "friends" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--coral)]" />
            )}
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full skeleton-shimmer" />
                  <div className="flex-1">
                    <div className="h-4 w-32 rounded skeleton-shimmer mb-2" />
                    <div className="h-3 w-24 rounded skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "requests" ? (
          <div className="space-y-6">
            {/* Received Requests */}
            {pendingReceived.length > 0 && (
              <section>
                <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                  Received ({pendingReceived.length})
                </h2>
                <div className="space-y-3">
                  {pendingReceived.map((request) => {
                    const otherUser = request.inviter;
                    if (!otherUser) return null;

                    return (
                      <div
                        key={request.id}
                        className="flex items-center gap-4 p-4 rounded-lg border border-[var(--twilight)] card-event-hover"
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        <Link href={`/profile/${otherUser.username}`}>
                          {otherUser.avatar_url ? (
                            <Image
                              src={otherUser.avatar_url}
                              alt={otherUser.display_name || otherUser.username}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] font-bold">
                              {getInitials(otherUser.display_name, otherUser.username)}
                            </div>
                          )}
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/profile/${otherUser.username}`}
                            className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                          >
                            {otherUser.display_name || `@${otherUser.username}`}
                          </Link>
                          <p className="text-sm text-[var(--muted)]">
                            @{otherUser.username} · {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(request.id)}
                            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg text-sm font-mono font-medium hover:bg-[var(--rose)] transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDecline(request.id)}
                            className="px-4 py-2 bg-transparent border border-[var(--muted)] text-[var(--muted)] rounded-lg text-sm font-mono font-medium hover:bg-[var(--muted)]/10 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Sent Requests */}
            {pendingSent.length > 0 && (
              <section>
                <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                  Sent ({pendingSent.length})
                </h2>
                <div className="space-y-3">
                  {pendingSent.map((request) => {
                    const otherUser = request.invitee;
                    if (!otherUser) return null;

                    return (
                      <div
                        key={request.id}
                        className="flex items-center gap-4 p-4 rounded-lg border border-[var(--twilight)]"
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        <Link href={`/profile/${otherUser.username}`}>
                          {otherUser.avatar_url ? (
                            <Image
                              src={otherUser.avatar_url}
                              alt={otherUser.display_name || otherUser.username}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[var(--twilight)] flex items-center justify-center text-[var(--muted)] font-bold">
                              {getInitials(otherUser.display_name, otherUser.username)}
                            </div>
                          )}
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/profile/${otherUser.username}`}
                            className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                          >
                            {otherUser.display_name || `@${otherUser.username}`}
                          </Link>
                          <p className="text-sm text-[var(--muted)]">
                            Pending · {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>

                        <button
                          onClick={() => handleCancel(request.id)}
                          className="px-4 py-2 bg-transparent border border-[var(--twilight)] text-[var(--muted)] rounded-lg text-sm font-mono font-medium hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Empty state */}
            {pendingReceived.length === 0 && pendingSent.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-[var(--cream)] text-lg font-medium mb-2">No pending requests</h3>
                <p className="text-[var(--muted)] text-sm mb-4">
                  Find people to connect with and see what events they are attending
                </p>
                <Link
                  href={`/${portalSlug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors font-mono text-sm"
                >
                  Discover Events
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* Friends Tab */
          <div>
            {friends.length > 0 ? (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile/${friend.username}`}
                    className="flex items-center gap-4 p-4 rounded-lg border border-[var(--twilight)] card-event-hover"
                    style={{ backgroundColor: "var(--card-bg)" }}
                  >
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt={friend.display_name || friend.username}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] font-bold">
                        {getInitials(friend.display_name, friend.username)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[var(--cream)] block truncate">
                        {friend.display_name || `@${friend.username}`}
                      </span>
                      <p className="text-sm text-[var(--muted)]">@{friend.username}</p>
                      {friend.bio && (
                        <p className="text-sm text-[var(--soft)] mt-1 line-clamp-1">{friend.bio}</p>
                      )}
                    </div>

                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] text-xs font-mono">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Friends
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-[var(--cream)] text-lg font-medium mb-2">No friends yet</h3>
                <p className="text-[var(--muted)] text-sm mb-4">
                  Add friends to see what events they are attending
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen">
        <div className="h-16 bg-[var(--void)]" />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="h-8 w-32 rounded skeleton-shimmer mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full skeleton-shimmer" />
                  <div className="flex-1">
                    <div className="h-4 w-32 rounded skeleton-shimmer mb-2" />
                    <div className="h-3 w-24 rounded skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    }>
      <FriendsPageContent />
    </Suspense>
  );
}

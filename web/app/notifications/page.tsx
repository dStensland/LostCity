"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import FriendRequestCard from "@/components/FriendRequestCard";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";

type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  inviter?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;
  invitee?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;
};

type NotificationType =
  | "new_follower"
  | "friend_rsvp"
  | "recommendation"
  | "event_reminder"
  | "friend_request"
  | "friend_request_accepted";

type Notification = {
  id: string;
  type: NotificationType;
  message: string | null;
  read_at: string | null;
  created_at: string;
  actor: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  event: {
    id: number;
    title: string;
  } | null;
  venue: {
    id: number;
    name: string;
  } | null;
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/notifications");
    }
  }, [user, authLoading, router]);

  // Load notifications and friend requests
  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        // Load both in parallel
        const [notifRes, requestsRes] = await Promise.all([
          fetch("/api/notifications?limit=50"),
          fetch("/api/friend-requests?type=received"),
        ]);

        if (notifRes.ok) {
          const data = await notifRes.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }

        if (requestsRes.ok) {
          const data = await requestsRes.json();
          const pending = (data.requests || []).filter(
            (r: FriendRequest) => r.status === "pending"
          );
          setFriendRequests(pending);
          setPendingRequestCount(data.pendingCount || 0);
        }
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  };

  const handleNotificationClick = async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen">
      <PageHeader />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Friend Requests Section */}
        {!loading && friendRequests.length > 0 && user && (
          <div className="mb-6">
            <h2 className="font-mono text-sm text-[var(--soft)] mb-3">
              Friend Requests ({pendingRequestCount})
            </h2>
            <div className="space-y-2">
              {friendRequests.map((request) => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  currentUserId={user.id}
                  onAccept={() => {
                    setFriendRequests((prev) =>
                      prev.filter((r) => r.id !== request.id)
                    );
                    setPendingRequestCount((prev) => Math.max(0, prev - 1));
                  }}
                  onDecline={() => {
                    setFriendRequests((prev) =>
                      prev.filter((r) => r.id !== request.id)
                    );
                    setPendingRequestCount((prev) => Math.max(0, prev - 1));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Notifications list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg animate-pulse"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--twilight)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--twilight)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--twilight)] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
            <svg
              className="w-12 h-12 mx-auto text-[var(--muted)] mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-[var(--soft)] font-mono text-sm">No notifications yet</p>
            <p className="text-[var(--muted)] font-mono text-xs mt-1">
              When someone follows you or interacts with you, you&apos;ll see it here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function NotificationCard({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const isUnread = !notification.read_at;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const getNotificationContent = () => {
    switch (notification.type) {
      case "new_follower":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "Someone"}
            </span>{" "}
            started following you
          </>
        );

      case "friend_rsvp":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "A friend"}
            </span>{" "}
            is going to{" "}
            <span className="font-medium text-[var(--cream)]">
              {notification.event?.title || "an event"}
            </span>
          </>
        );

      case "recommendation":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "Someone"}
            </span>{" "}
            recommended{" "}
            <span className="font-medium text-[var(--cream)]">
              {notification.event?.title || notification.venue?.name || "something"}
            </span>
          </>
        );

      case "event_reminder":
        return (
          <>
            Reminder:{" "}
            <span className="font-medium text-[var(--cream)]">
              {notification.event?.title || "An event"}
            </span>{" "}
            is coming up soon
          </>
        );

      case "friend_request":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "Someone"}
            </span>{" "}
            sent you a friend request
          </>
        );

      case "friend_request_accepted":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "Someone"}
            </span>{" "}
            accepted your friend request
          </>
        );

      default:
        return notification.message || "You have a notification";
    }
  };

  const getNotificationLink = (): string => {
    if (notification.type === "new_follower" && notification.actor) {
      return `/profile/${notification.actor.username}`;
    }
    if (notification.type === "friend_request" && notification.actor) {
      return `/notifications`; // Stay on notifications page to handle request
    }
    if (notification.type === "friend_request_accepted" && notification.actor) {
      return `/profile/${notification.actor.username}`;
    }
    if (notification.event) {
      return `/events/${notification.event.id}`;
    }
    if (notification.venue) {
      return `/spots/${notification.venue.id}`;
    }
    return "#";
  };

  return (
    <Link
      href={getNotificationLink()}
      onClick={onClick}
      className={`block p-4 rounded-lg border transition-colors ${
        isUnread
          ? "bg-[var(--night)] border-[var(--coral)]/30 hover:bg-[var(--dusk)]"
          : "bg-[var(--dusk)] border-[var(--twilight)] hover:bg-[var(--twilight)]"
      }`}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {notification.actor?.avatar_url ? (
            <Image
              src={notification.actor.avatar_url}
              alt={`${notification.actor.display_name || notification.actor.username}'s profile photo`}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover border border-[var(--twilight)]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--twilight)] flex items-center justify-center">
              <NotificationIcon type={notification.type} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--soft)]">{getNotificationContent()}</p>
          <p className="font-mono text-[0.65rem] text-[var(--muted)] mt-1">{timeAgo}</p>
        </div>

        {/* Unread indicator */}
        {isUnread && (
          <div className="flex-shrink-0 self-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--coral)]" />
          </div>
        )}
      </div>
    </Link>
  );
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const iconClasses = "w-5 h-5 text-[var(--muted)]";

  switch (type) {
    case "new_follower":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );

    case "friend_rsvp":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );

    case "recommendation":
      return (
        <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );

    case "event_reminder":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );

    case "friend_request":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );

    case "friend_request_accepted":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );

    default:
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
}

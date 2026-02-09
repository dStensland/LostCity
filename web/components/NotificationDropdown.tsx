"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { formatDistanceToNow } from "date-fns";

type NotificationType =
  | "new_follower"
  | "friend_request"
  | "friend_accepted"
  | "friend_rsvp"
  | "recommendation"
  | "event_reminder";

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
    slug: string;
  } | null;
};

export default function NotificationDropdown() {
  const { user, loading: authLoading } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    // Wait for auth to settle before fetching
    if (authLoading || !user || !isOpen) return;

    const controller = new AbortController();

    async function fetchNotifications() {
      setLoading(true);
      try {
        const res = await fetch("/api/notifications?limit=10", {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch notifications:", error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchNotifications();
    return () => controller.abort();
  }, [user, isOpen, authLoading]);

  // Poll for unread count periodically
  useEffect(() => {
    // Wait for auth to settle before starting polls
    if (authLoading || !user) return;

    const controller = new AbortController();

    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/notifications?limit=1&unread=true", {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        // Ignore abort errors (expected during unmount/navigation)
        if (err instanceof Error && err.name === "AbortError") return;
        // Silent fail for other polling errors
      }
    }

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // Poll every minute
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [user, authLoading]);

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
    // Mark single notification as read
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

  // Don't render while auth is loading or if not logged in
  if (authLoading || !user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors active:scale-95"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 max-h-96 overflow-y-auto bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-[200]">
          {/* Header */}
          <div className="p-3 border-b border-[var(--twilight)] flex items-center justify-between">
            <h3 className="font-mono text-xs font-medium text-[var(--cream)] uppercase tracking-wider">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-mono text-[0.65rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[var(--twilight)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[var(--twilight)] rounded w-3/4" />
                    <div className="h-2 bg-[var(--twilight)] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[var(--muted)] font-mono text-xs">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification.id)}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-[var(--twilight)]">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="block w-full p-2 text-center font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] rounded transition-colors"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
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

      case "friend_request":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "Someone"}
            </span>{" "}
            sent you a friend request
          </>
        );

      case "friend_accepted":
        return (
          <>
            <span className="font-medium text-[var(--cream)]">
              {notification.actor?.display_name || notification.actor?.username || "Someone"}
            </span>{" "}
            accepted your friend request
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
            is coming up
          </>
        );

      default:
        return notification.message || "You have a notification";
    }
  };

  const getNotificationLink = (): string => {
    if (notification.type === "friend_request" || notification.type === "friend_accepted") {
      // Link to community view where friend requests are managed
      return portal?.slug ? `/${portal.slug}?view=community` : "/atl?view=community";
    }
    if (notification.type === "new_follower" && notification.actor) {
      return `/profile/${notification.actor.username}`;
    }
    if (notification.event) {
      return portal?.slug ? `/${portal.slug}?event=${notification.event.id}` : `/events/${notification.event.id}`;
    }
    if (notification.venue) {
      return portal?.slug ? `/${portal.slug}?spot=${notification.venue.slug}` : `/spots/${notification.venue.slug}`;
    }
    return "#";
  };

  return (
    <Link
      href={getNotificationLink()}
      scroll={false}
      onClick={onClick}
      className={`block p-3 hover:bg-[var(--twilight)] transition-colors ${
        isUnread ? "bg-[var(--night)]/50" : ""
      }`}
    >
      <div className="flex gap-3">
        {/* Avatar or icon */}
        <div className="flex-shrink-0">
          {notification.actor?.avatar_url ? (
            <Image
              src={notification.actor.avatar_url}
              alt={`${notification.actor.display_name || notification.actor.username}'s profile photo`}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center">
              <NotificationIcon type={notification.type} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--soft)] line-clamp-2">
            {getNotificationContent()}
          </p>
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-1">{timeAgo}</p>
        </div>

        {/* Unread indicator */}
        {isUnread && (
          <div className="flex-shrink-0 self-center">
            <div className="w-2 h-2 rounded-full bg-[var(--coral)]" />
          </div>
        )}
      </div>
    </Link>
  );
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const iconClasses = "w-4 h-4 text-[var(--muted)]";

  switch (type) {
    case "new_follower":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );

    case "friend_request":
    case "friend_accepted":
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

    default:
      return (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
}

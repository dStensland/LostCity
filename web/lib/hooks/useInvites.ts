"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type EventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  image_url: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
};

export type Invite = {
  id: string;
  note: string | null;
  status: "pending" | "accepted" | "declined" | "maybe";
  created_at: string;
  responded_at: string | null;
  inviter: Profile | null;
  invitee: Profile | null;
  event: EventData | null;
};

interface UseInvitesOptions {
  type?: "received" | "sent" | "all";
  status?: "pending" | "accepted" | "declined" | "maybe";
  autoFetch?: boolean;
}

export function useInvites(options: UseInvitesOptions = {}) {
  const { type = "received", status, autoFetch = true } = options;
  const { user } = useAuth();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ type });
      if (status) {
        params.set("status", status);
      }

      const res = await fetch(`/api/invites?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to fetch invites");
      }

      const data = await res.json();
      setInvites(data.invites || []);
      setPendingCount(data.pendingCount || 0);
    } catch (err) {
      console.error("Failed to fetch invites:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch invites");
    } finally {
      setLoading(false);
    }
  }, [user, type, status]);

  useEffect(() => {
    if (autoFetch) {
      fetchInvites();
    }
  }, [autoFetch, fetchInvites]);

  const sendInvite = useCallback(
    async (eventId: number, inviteeId: string, note?: string) => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, inviteeId, note }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }

      const data = await res.json();

      // Refresh the list if we're viewing sent invites
      if (type === "sent" || type === "all") {
        fetchInvites();
      }

      return data.invite;
    },
    [user, type, fetchInvites]
  );

  const respondToInvite = useCallback(
    async (inviteId: string, responseStatus: "accepted" | "declined" | "maybe") => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: responseStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to respond to invite");
      }

      // Update local state
      setInvites((prev) =>
        prev.map((invite) =>
          invite.id === inviteId
            ? { ...invite, status: responseStatus, responded_at: new Date().toISOString() }
            : invite
        )
      );

      // Update pending count (response is never "pending")
      setPendingCount((prev) => Math.max(0, prev - 1));

      return res.json();
    },
    [user]
  );

  const cancelInvite = useCallback(
    async (inviteId: string) => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel invite");
      }

      // Remove from local state
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));

      return res.json();
    },
    [user]
  );

  return {
    invites,
    pendingCount,
    loading,
    error,
    refresh: fetchInvites,
    sendInvite,
    respondToInvite,
    cancelInvite,
  };
}

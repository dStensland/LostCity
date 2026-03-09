"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Check, Plus } from "@phosphor-icons/react";

interface GroupSubscribeButtonProps {
  channelId: string;
  portalSlug: string;
  initialSubscribed: boolean;
  initialSubscriptionId: string | null;
}

export function GroupSubscribeButton({
  channelId,
  portalSlug,
  initialSubscribed,
  initialSubscriptionId,
}: GroupSubscribeButtonProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(initialSubscriptionId);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async () => {
    if (!user) {
      const redirectPath = `${window.location.pathname}${window.location.search}`;
      router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    setIsPending(true);
    setError(null);

    // Optimistic update
    const prevSubscribed = isSubscribed;
    const prevSubId = subscriptionId;
    setIsSubscribed(!isSubscribed);

    try {
      if (isSubscribed && subscriptionId) {
        // Unsubscribe
        const response = await fetch(`/api/channels/subscriptions/${subscriptionId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error || "Failed to leave group");
        }

        setSubscriptionId(null);
      } else {
        // Subscribe
        const response = await fetch("/api/channels/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: channelId,
            delivery_mode: "feed_only",
            portal_slug: portalSlug,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error || "Failed to join group");
        }

        const data = await response.json() as { subscription?: { id: string } };
        setSubscriptionId(data.subscription?.id ?? null);
      }
    } catch (err) {
      // Rollback on error
      setIsSubscribed(prevSubscribed);
      setSubscriptionId(prevSubId);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsPending(false);
    }
  }, [channelId, isSubscribed, portalSlug, router, subscriptionId, user]);

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 border-[1.5px] ${
          isSubscribed
            ? "bg-[var(--action-primary)]/10 text-[var(--action-primary)] border-[var(--action-primary)]"
            : "bg-[var(--action-primary)] text-[var(--btn-primary-text,#fff)] border-[var(--action-primary)] hover:opacity-90"
        }`}
        aria-pressed={isSubscribed}
      >
        {isSubscribed ? (
          <>
            <Check size={15} weight="bold" />
            Joined
          </>
        ) : (
          <>
            <Plus size={15} weight="bold" />
            Join
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[var(--neon-red)]">
          {error}
        </p>
      )}
    </div>
  );
}

export type { GroupSubscribeButtonProps };

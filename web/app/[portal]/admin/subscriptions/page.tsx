"use client";

import { useState, useEffect } from "react";
import { usePortal } from "@/lib/portal-context";
import { formatDistanceToNow } from "date-fns";

type Subscription = {
  subscription: {
    id: string;
    subscriptionScope: string;
    subscribedCategories: string[] | null;
    createdAt: string;
  };
  source: {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
    ownerPortal?: {
      id: string;
      slug: string;
      name: string;
    } | null;
  };
  sharingRule: {
    shareScope: string;
    allowedCategories: string[] | null;
  } | null;
};

type AvailableSource = {
  source: {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
    ownerPortal?: {
      id: string;
      slug: string;
      name: string;
    } | null;
  };
  sharingRule: {
    shareScope: string;
    allowedCategories: string[] | null;
  };
};

export default function PortalSubscriptionsPage() {
  const { portal } = usePortal();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "available">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal.id]);

  async function loadData() {
    try {
      const res = await fetch(`/api/admin/portals/${portal.id}/subscriptions`);
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setAvailableSources(data.availableSources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(sourceId: number) {
    setSubscribing(sourceId);
    try {
      const res = await fetch(`/api/admin/portals/${portal.id}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, subscription_scope: "all" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to subscribe");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setSubscribing(null);
    }
  }

  async function handleUnsubscribe(subscriptionId: string) {
    try {
      const res = await fetch(
        `/api/admin/portals/${portal.id}/subscriptions?subscription_id=${subscriptionId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to unsubscribe");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsubscribe");
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">Subscriptions</h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          Subscribe to sources shared by other portals
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
            activeTab === "active"
              ? "bg-[var(--coral)] text-[var(--void)]"
              : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
          }`}
        >
          Active ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("available")}
          className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
            activeTab === "available"
              ? "bg-[var(--coral)] text-[var(--void)]"
              : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
          }`}
        >
          Available ({availableSources.length})
        </button>
      </div>

      {/* Active Subscriptions */}
      {activeTab === "active" && (
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
          {subscriptions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-mono text-sm text-[var(--muted)] mb-4">
                You haven&apos;t subscribed to any sources yet.
              </p>
              <button
                onClick={() => setActiveTab("available")}
                className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm"
              >
                Browse Available Sources
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--twilight)]">
              {subscriptions.map(({ subscription, source, sharingRule }) => (
                <div
                  key={subscription.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        source.isActive ? "bg-green-400" : "bg-[var(--muted)]"
                      }`}
                    />
                    <div>
                      <p className="font-mono text-sm text-[var(--cream)]">{source.name}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        From {source.ownerPortal?.name || "Unknown"}
                        {" • "}
                        Subscribed {formatDistanceToNow(new Date(subscription.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sharingRule && (
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[0.6rem] uppercase ${
                          sharingRule.shareScope === "all"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {sharingRule.shareScope === "all"
                          ? "All categories"
                          : `${sharingRule.allowedCategories?.length || 0} categories`}
                      </span>
                    )}
                    <button
                      onClick={() => handleUnsubscribe(subscription.id)}
                      className="px-3 py-1 bg-red-500/20 text-red-400 rounded font-mono text-xs hover:bg-red-500/30"
                    >
                      Unsubscribe
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Available Sources */}
      {activeTab === "available" && (
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
          {availableSources.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-mono text-sm text-[var(--muted)]">
                No additional sources are available to subscribe to.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--twilight)]">
              {availableSources.map(({ source, sharingRule }) => (
                <div
                  key={source.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        source.isActive ? "bg-green-400" : "bg-[var(--muted)]"
                      }`}
                    />
                    <div>
                      <p className="font-mono text-sm text-[var(--cream)]">{source.name}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        From {source.ownerPortal?.name || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[0.6rem] uppercase ${
                        sharingRule.shareScope === "all"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {sharingRule.shareScope === "all"
                        ? "All categories"
                        : `${sharingRule.allowedCategories?.length || 0} categories`}
                    </span>
                    <button
                      onClick={() => handleSubscribe(source.id)}
                      disabled={subscribing === source.id}
                      className="px-3 py-1 bg-[var(--coral)] text-[var(--void)] rounded font-mono text-xs hover:opacity-90 disabled:opacity-50"
                    >
                      {subscribing === source.id ? "..." : "Subscribe"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-8 p-4 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
        <h3 className="font-mono text-sm text-[var(--coral)] mb-2">About Subscriptions</h3>
        <p className="font-mono text-xs text-[var(--muted)] leading-relaxed">
          Subscribing to a source allows events from that source to appear in your portal.
          When you subscribe, you receive events based on the sharing rules set by the source owner.
          Some sources share all categories, while others only share specific event types.
        </p>
      </div>
    </div>
  );
}

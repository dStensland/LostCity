"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

type Portal = {
  id: string;
  slug: string;
  name: string;
};

type Source = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  sharingRule?: {
    shareScope: string;
    allowedCategories: string[] | null;
  } | null;
  subscriberCount?: number;
};

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

export default function PortalSourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [portal, setPortal] = useState<Portal | null>(null);
  const [ownedSources, setOwnedSources] = useState<Source[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);
  const [activeTab, setActiveTab] = useState<"owned" | "subscribed" | "available">("owned");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Load portal info
        const portalRes = await fetch(`/api/admin/portals/${id}`);
        if (!portalRes.ok) throw new Error("Failed to fetch portal");
        const portalData = await portalRes.json();
        setPortal(portalData.portal);

        // Load subscriptions and available sources
        const subsRes = await fetch(`/api/admin/portals/${id}/subscriptions`);
        if (subsRes.ok) {
          const subsData = await subsRes.json();
          setSubscriptions(subsData.subscriptions || []);
          setAvailableSources(subsData.availableSources || []);
        }

        // Load federation stats to get owned sources
        const fedRes = await fetch("/api/admin/federation/stats");
        if (fedRes.ok) {
          const fedData = await fedRes.json();
          const owned = (fedData.sources || []).filter(
            (s: { ownerPortalId: string | null }) => s.ownerPortalId === id
          );
          setOwnedSources(owned);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleSubscribe(sourceId: number) {
    setSubscribing(sourceId);
    try {
      const res = await fetch(`/api/admin/portals/${id}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, subscription_scope: "all" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to subscribe");
      }

      // Reload subscriptions
      const subsRes = await fetch(`/api/admin/portals/${id}/subscriptions`);
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData.subscriptions || []);
        setAvailableSources(subsData.availableSources || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setSubscribing(null);
    }
  }

  async function handleUnsubscribe(subscriptionId: string) {
    try {
      const res = await fetch(
        `/api/admin/portals/${id}/subscriptions?subscription_id=${subscriptionId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to unsubscribe");
      }

      // Reload subscriptions
      const subsRes = await fetch(`/api/admin/portals/${id}/subscriptions`);
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData.subscriptions || []);
        setAvailableSources(subsData.availableSources || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsubscribe");
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
        <Link href="/admin/portals" className="hover:text-[var(--cream)]">
          Portals
        </Link>
        <span>/</span>
        <Link href={`/admin/portals/${id}`} className="hover:text-[var(--cream)]">
          {portal?.name || "Portal"}
        </Link>
        <span>/</span>
        <span className="text-[var(--cream)]">Sources</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">
          {portal?.name} Sources
        </h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          Manage owned sources and subscriptions for this portal
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["owned", "subscribed", "available"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
              activeTab === tab
                ? "bg-[var(--coral)] text-[var(--void)]"
                : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {tab === "owned" && `Owned (${ownedSources.length})`}
            {tab === "subscribed" && `Subscribed (${subscriptions.length})`}
            {tab === "available" && `Available (${availableSources.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        {activeTab === "owned" && (
          <div className="divide-y divide-[var(--twilight)]">
            {ownedSources.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-mono text-sm text-[var(--muted)]">
                  This portal doesn&apos;t own any sources yet.
                </p>
                <Link
                  href="/admin/sources"
                  className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm"
                >
                  Manage Sources
                </Link>
              </div>
            ) : (
              ownedSources.map((source) => (
                <Link
                  key={source.id}
                  href={`/admin/sources/${source.id}`}
                  className="p-4 flex items-center justify-between hover:bg-[var(--night)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        source.isActive ? "bg-green-400" : "bg-[var(--muted)]"
                      }`}
                    />
                    <div>
                      <p className="font-mono text-sm text-[var(--cream)]">{source.name}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">{source.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {source.sharingRule && (
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[0.6rem] uppercase ${
                          source.sharingRule.shareScope === "all"
                            ? "bg-green-500/20 text-green-400"
                            : source.sharingRule.shareScope === "selected"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-[var(--twilight)] text-[var(--muted)]"
                        }`}
                      >
                        {source.sharingRule.shareScope}
                      </span>
                    )}
                    {(source.subscriberCount ?? 0) > 0 && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-mono text-[0.6rem]">
                        {source.subscriberCount} subscriber{(source.subscriberCount ?? 0) !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === "subscribed" && (
          <div className="divide-y divide-[var(--twilight)]">
            {subscriptions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-mono text-sm text-[var(--muted)]">
                  This portal hasn&apos;t subscribed to any sources yet.
                </p>
                <button
                  onClick={() => setActiveTab("available")}
                  className="mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm"
                >
                  Browse Available Sources
                </button>
              </div>
            ) : (
              subscriptions.map(({ subscription, source, sharingRule }) => (
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
                        {subscription.subscriptionScope === "all"
                          ? "All categories"
                          : `${subscription.subscribedCategories?.length || 0} categories`}
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
                          ? "All shared"
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
              ))
            )}
          </div>
        )}

        {activeTab === "available" && (
          <div className="divide-y divide-[var(--twilight)]">
            {availableSources.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-mono text-sm text-[var(--muted)]">
                  No additional sources are available to subscribe to.
                </p>
              </div>
            ) : (
              availableSources.map(({ source, sharingRule }) => (
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
                        {" • "}
                        {sharingRule.shareScope === "all"
                          ? "All categories"
                          : `${sharingRule.allowedCategories?.length || 0} categories`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSubscribe(source.id)}
                    disabled={subscribing === source.id}
                    className="px-3 py-1 bg-[var(--coral)] text-[var(--void)] rounded font-mono text-xs hover:opacity-90 disabled:opacity-50"
                  >
                    {subscribing === source.id ? "Subscribing..." : "Subscribe"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

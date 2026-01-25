"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

type ApiKey = {
  id: string;
  key_prefix: string;
  name: string;
  portal_id: string | null;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  portal?: { id: string; name: string; slug: string } | null;
  creator?: { id: string; username: string } | null;
};

type Portal = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  portals?: Portal[];
};

export default function APIKeyManager({ portals = [] }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPortal, setNewKeyPortal] = useState<string>("");
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("90");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const res = await fetch("/api/admin/analytics/api-keys");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/analytics/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          portal_id: newKeyPortal || null,
          expires_in_days: newKeyExpiry ? parseInt(newKeyExpiry, 10) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create key");
      }

      const data = await res.json();
      setCreatedKey(data.api_key);
      setKeys((prev) => [data.key, ...prev]);
      setNewKeyName("");
      setNewKeyPortal("");
      setNewKeyExpiry("90");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/analytics/api-keys?id=${keyId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to revoke");

      setKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, is_active: false } : k))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--cream)]">API Keys</h2>
          <p className="font-mono text-xs text-[var(--muted)] mt-1">
            Manage API keys for external integrations (Snowflake, GA, etc.)
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--coral)]/90 transition-colors"
        >
          {showCreate ? "Cancel" : "Create Key"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Created Key Display */}
      {createdKey && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="font-mono text-xs text-green-400 mb-2">
            API key created successfully. Copy it now - it won&apos;t be shown again!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-[var(--void)] rounded font-mono text-sm text-[var(--cream)] break-all">
              {createdKey}
            </code>
            <button
              onClick={() => {
                copyToClipboard(createdKey);
                setCreatedKey(null);
              }}
              className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] hover:border-[var(--coral)] transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && !createdKey && (
        <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg space-y-4">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] mb-1">
              Key Name
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Snowflake Integration"
              className="w-full px-3 py-2 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] mb-1">
                Portal Scope (optional)
              </label>
              <select
                value={newKeyPortal}
                onChange={(e) => setNewKeyPortal(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                <option value="">All Portals (Super Admin)</option>
                {portals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] mb-1">
                Expires In
              </label>
              <select
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="">Never</option>
              </select>
            </div>
          </div>

          <button
            onClick={createKey}
            disabled={!newKeyName.trim() || creating}
            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--coral)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create API Key"}
          </button>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="p-8 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            No API keys yet. Create one to enable external integrations.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--night)]">
              <tr className="border-b border-[var(--twilight)]">
                <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">
                  Key
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">
                  Scope
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">
                  Last Used
                </th>
                <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key.id}
                  className={`border-b border-[var(--twilight)] ${
                    !key.is_active ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-sm text-[var(--cream)]">{key.name}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      Created {formatDistanceToNow(new Date(key.created_at))} ago
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-sm text-[var(--coral)]">
                      {key.key_prefix}...
                    </code>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-[var(--cream)]">
                    {key.portal ? key.portal.name : "All Portals"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {key.last_used_at
                      ? formatDistanceToNow(new Date(key.last_used_at)) + " ago"
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    {!key.is_active ? (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 font-mono text-xs rounded">
                        Revoked
                      </span>
                    ) : key.expires_at && new Date(key.expires_at) < new Date() ? (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 font-mono text-xs rounded">
                        Expired
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 font-mono text-xs rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {key.is_active && (
                      <button
                        onClick={() => revokeKey(key.id)}
                        className="font-mono text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="p-4 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
        <p className="font-mono text-xs text-[var(--muted)] mb-2">Usage:</p>
        <code className="block p-3 bg-[var(--void)] rounded font-mono text-xs text-[var(--cream)] overflow-x-auto">
          curl -H &quot;Authorization: Bearer lc_xxx...&quot; \<br />
          &nbsp;&nbsp;{typeof window !== "undefined" ? window.location.origin : ""}/api/admin/analytics/webhook
        </code>
      </div>
    </div>
  );
}

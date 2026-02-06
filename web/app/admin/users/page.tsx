"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "@/components/SmartImage";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type User = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_public: boolean;
  is_admin: boolean;
  created_at: string;
  email?: string;
  follower_count?: number;
  following_count?: number;
  rsvp_count?: number;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Scroll detail panel into view on mobile when user is selected
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEditMode(false);
    // Scroll to detail panel on mobile
    setTimeout(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Load users via API (uses service role to bypass RLS)
  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load users");
      }

      const data = await res.json();
      setUsers((data.users as User[]) || []);
    } catch (err) {
      console.error("Failed to load users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load user details when selected (via API to bypass RLS)
  useEffect(() => {
    if (!selectedUser?.id) return;
    const userId = selectedUser.id;

    async function loadUserDetails() {
      try {
        const res = await fetch(`/api/admin/users?id=${userId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.user) {
          setSelectedUser((prev) =>
            prev
              ? {
                  ...prev,
                  follower_count: data.user.follower_count || 0,
                  following_count: data.user.following_count || 0,
                  rsvp_count: data.user.rsvp_count || 0,
                }
              : null
          );
        }
      } catch (err) {
        console.error("Failed to load user details:", err);
      }
    }

    loadUserDetails();
  }, [selectedUser?.id]);

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          updates: {
            username: selectedUser.username,
            display_name: selectedUser.display_name,
            bio: selectedUser.bio,
            location: selectedUser.location,
            is_public: selectedUser.is_public,
            is_admin: selectedUser.is_admin,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? selectedUser : u))
      );
      setEditMode(false);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    if (
      !confirm(
        `Are you sure you want to delete @${selectedUser.username}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);

    // Delete from auth (this cascades to profile due to FK)
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser.id }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert("Failed to delete: " + data.error);
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setSelectedUser(null);
    }

    setDeleting(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--cream)]">
          Manage Users
        </h1>
        <p className="font-mono text-xs text-[var(--muted)]">
          {users.length} users
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* User List */}
        <div className="w-full lg:w-1/2">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or name..."
              className="w-full px-4 py-2 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          {/* List */}
          <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="font-mono text-sm text-[var(--cream)] mb-1">No users found</p>
                <p className="font-mono text-xs text-[var(--muted)]">Try adjusting your search</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--twilight)] max-h-[600px] overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--twilight)] transition-colors ${
                      selectedUser?.id === user.id ? "bg-[var(--twilight)]" : ""
                    }`}
                  >
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={`${user.display_name || user.username}'s profile photo`}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--coral)] flex items-center justify-center">
                        <span className="font-mono text-xs font-bold text-[var(--void)]">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-[var(--cream)] truncate">
                        {user.display_name || user.username}
                        {user.is_admin && (
                          <span className="ml-2 px-1.5 py-0.5 bg-[var(--coral)] text-[var(--void)] text-[0.5rem] font-bold uppercase rounded">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        @{user.username}
                      </p>
                    </div>
                    <p className="font-mono text-[0.6rem] text-[var(--muted)]">
                      {formatDistanceToNow(new Date(user.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Detail */}
        <div ref={detailPanelRef} className="w-full lg:w-1/2">
          {selectedUser ? (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              {/* Header */}
              <div className="p-4 border-b border-[var(--twilight)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="lg:hidden font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]"
                  >
                    ← Back
                  </button>
                  <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                    User Details
                  </h2>
                  <Link
                    href={`/profile/${selectedUser.username}`}
                    target="_blank"
                    className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
                  >
                    View Profile →
                  </Link>
                </div>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-3 py-1.5 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 rounded bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-3 py-1.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs hover:bg-[var(--muted)]/20 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Avatar & Username */}
                <div className="flex items-center gap-4">
                  {selectedUser.avatar_url ? (
                    <Image
                      src={selectedUser.avatar_url}
                      alt={`${selectedUser.display_name || selectedUser.username}'s profile photo`}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--coral)] flex items-center justify-center">
                      <span className="font-mono text-xl font-bold text-[var(--void)]">
                        {(
                          selectedUser.display_name || selectedUser.username
                        )[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    {editMode ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-lg text-[var(--muted)]">@</span>
                          <input
                            type="text"
                            value={selectedUser.username}
                            onChange={(e) => {
                              const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                              setSelectedUser({
                                ...selectedUser,
                                username: value,
                              });
                            }}
                            maxLength={30}
                            className="flex-1 px-2 py-1 rounded bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-lg focus:outline-none focus:border-[var(--coral)]"
                            placeholder="username"
                          />
                        </div>
                        <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-1">
                          3-30 chars, lowercase letters, numbers, underscores only
                        </p>
                      </div>
                    ) : (
                      <p className="font-mono text-lg text-[var(--cream)]">
                        @{selectedUser.username}
                      </p>
                    )}
                    <p className="font-mono text-xs text-[var(--muted)]">
                      ID: {selectedUser.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[var(--night)] rounded-lg text-center">
                    <p className="font-mono text-lg font-bold text-[var(--cream)]">
                      {selectedUser.follower_count ?? "-"}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[var(--muted)] uppercase">
                      Followers
                    </p>
                  </div>
                  <div className="p-3 bg-[var(--night)] rounded-lg text-center">
                    <p className="font-mono text-lg font-bold text-[var(--cream)]">
                      {selectedUser.following_count ?? "-"}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[var(--muted)] uppercase">
                      Following
                    </p>
                  </div>
                  <div className="p-3 bg-[var(--night)] rounded-lg text-center">
                    <p className="font-mono text-lg font-bold text-[var(--cream)]">
                      {selectedUser.rsvp_count ?? "-"}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[var(--muted)] uppercase">
                      RSVPs
                    </p>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-1">
                      Display Name
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={selectedUser.display_name || ""}
                        onChange={(e) =>
                          setSelectedUser({
                            ...selectedUser,
                            display_name: e.target.value || null,
                          })
                        }
                        className="w-full px-3 py-2 rounded bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)]"
                      />
                    ) : (
                      <p className="font-mono text-sm text-[var(--cream)]">
                        {selectedUser.display_name || "-"}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-1">
                      Bio
                    </label>
                    {editMode ? (
                      <textarea
                        value={selectedUser.bio || ""}
                        onChange={(e) =>
                          setSelectedUser({
                            ...selectedUser,
                            bio: e.target.value || null,
                          })
                        }
                        rows={2}
                        className="w-full px-3 py-2 rounded bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] resize-none"
                      />
                    ) : (
                      <p className="font-mono text-sm text-[var(--soft)]">
                        {selectedUser.bio || "-"}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-1">
                      Location
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={selectedUser.location || ""}
                        onChange={(e) =>
                          setSelectedUser({
                            ...selectedUser,
                            location: e.target.value || null,
                          })
                        }
                        className="w-full px-3 py-2 rounded bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)]"
                      />
                    ) : (
                      <p className="font-mono text-sm text-[var(--soft)]">
                        {selectedUser.location || "-"}
                      </p>
                    )}
                  </div>

                  {/* Toggles */}
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUser.is_public}
                        onChange={(e) =>
                          editMode &&
                          setSelectedUser({
                            ...selectedUser,
                            is_public: e.target.checked,
                          })
                        }
                        disabled={!editMode}
                        className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
                      />
                      <span className="font-mono text-xs text-[var(--soft)]">
                        Public profile
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUser.is_admin}
                        onChange={(e) =>
                          editMode &&
                          setSelectedUser({
                            ...selectedUser,
                            is_admin: e.target.checked,
                          })
                        }
                        disabled={!editMode}
                        className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
                      />
                      <span className="font-mono text-xs text-[var(--soft)]">
                        Admin
                      </span>
                    </label>
                  </div>
                </div>

                {/* Meta */}
                <div className="pt-4 border-t border-[var(--twilight)]">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    Joined{" "}
                    {new Date(selectedUser.created_at).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>

                {/* Danger Zone */}
                {editMode && (
                  <div className="pt-4 border-t border-[var(--coral)]/30">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full px-4 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete User"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)] flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-mono text-sm text-[var(--cream)] mb-1">No user selected</h3>
              <p className="font-mono text-xs text-[var(--muted)]">
                Select a user from the list to view their details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

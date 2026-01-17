"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load users
  useEffect(() => {
    async function loadUsers() {
      setLoading(true);

      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (search) {
        query = query.or(
          `username.ilike.%${search}%,display_name.ilike.%${search}%`
        );
      }

      const { data } = await query;
      setUsers((data as User[]) || []);
      setLoading(false);
    }

    loadUsers();
  }, [search, supabase]);

  // Load user details when selected
  useEffect(() => {
    if (!selectedUser?.id) return;
    const userId = selectedUser.id;

    async function loadUserDetails() {
      // Get follower/following/rsvp counts
      const [
        { count: followerCount },
        { count: followingCount },
        { count: rsvpCount },
      ] = await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("followed_user_id", userId),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", userId),
        supabase
          .from("event_rsvps")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              follower_count: followerCount || 0,
              following_count: followingCount || 0,
              rsvp_count: rsvpCount || 0,
            }
          : null
      );
    }

    loadUserDetails();
  }, [selectedUser?.id, supabase]);

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: selectedUser.display_name,
        bio: selectedUser.bio,
        location: selectedUser.location,
        is_public: selectedUser.is_public,
        is_admin: selectedUser.is_admin,
      } as never)
      .eq("id", selectedUser.id);

    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? selectedUser : u))
      );
      setEditMode(false);
    }

    setSaving(false);
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
        <h1 className="font-serif text-2xl text-[var(--cream)] italic">
          Manage Users
        </h1>
        <p className="font-mono text-xs text-[var(--muted)]">
          {users.length} users
        </p>
      </div>

      <div className="flex gap-6">
        {/* User List */}
        <div className="w-1/2">
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
              <p className="p-8 text-center font-mono text-sm text-[var(--muted)]">
                No users found
              </p>
            ) : (
              <div className="divide-y divide-[var(--twilight)] max-h-[600px] overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setEditMode(false);
                    }}
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
        <div className="w-1/2">
          {selectedUser ? (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              {/* Header */}
              <div className="p-4 border-b border-[var(--twilight)] flex items-center justify-between">
                <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                  User Details
                </h2>
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
                  <div>
                    <p className="font-mono text-lg text-[var(--cream)]">
                      @{selectedUser.username}
                    </p>
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
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-8 text-center">
              <p className="font-mono text-sm text-[var(--muted)]">
                Select a user to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

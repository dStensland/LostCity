import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Get counts
  const [
    { count: userCount },
    { count: eventCount },
    { count: venueCount },
    { count: rsvpCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("venues").select("*", { count: "exact", head: true }),
    supabase.from("event_rsvps").select("*", { count: "exact", head: true }),
  ]);

  // Get recent signups
  type RecentUser = {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
  };

  const { data: recentUsersData } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const recentUsers = recentUsersData as RecentUser[] | null;

  const stats = [
    { label: "Total Users", value: userCount || 0, href: "/admin/users" },
    { label: "Events", value: eventCount || 0, href: "#" },
    { label: "Venues", value: venueCount || 0, href: "#" },
    { label: "RSVPs", value: rsvpCount || 0, href: "#" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl text-[var(--cream)] italic mb-8">
        Admin Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
          >
            <p className="font-mono text-3xl font-bold text-[var(--coral)]">
              {stat.value.toLocaleString()}
            </p>
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mt-1">
              {stat.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent Users */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        <div className="p-4 border-b border-[var(--twilight)] flex items-center justify-between">
          <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
            Recent Signups
          </h2>
          <Link
            href="/admin/users"
            className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-[var(--twilight)]">
          {recentUsers?.map((user) => (
            <Link
              key={user.id}
              href={`/admin/users?id=${user.id}`}
              className="flex items-center gap-3 p-4 hover:bg-[var(--twilight)] transition-colors"
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
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
                <p className="font-mono text-sm text-[var(--cream)]">
                  {user.display_name || user.username}
                </p>
                <p className="font-mono text-xs text-[var(--muted)]">
                  @{user.username}
                </p>
              </div>
              <p className="font-mono text-xs text-[var(--muted)]">
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
          {(!recentUsers || recentUsers.length === 0) && (
            <p className="p-4 text-center font-mono text-sm text-[var(--muted)]">
              No users yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

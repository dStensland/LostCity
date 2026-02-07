"use client";

import Link from "next/link";
import Image from "@/components/SmartImage";
// FollowButton removed — benched for curator feature

type UserListItem = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type UserListProps = {
  users: UserListItem[];
  emptyMessage?: string;
};

export default function UserList({ users, emptyMessage = "No users found" }: UserListProps) {
  if (users.length === 0) {
    return (
      <p className="font-mono text-sm text-[var(--muted)] py-8 text-center">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="divide-y divide-[var(--twilight)]">
      {users.map((user) => (
        <div key={user.id} className="py-4 flex items-center gap-4">
          <Link href={`/profile/${user.username}`} className="flex-shrink-0">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.display_name || user.username}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover border border-[var(--twilight)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--coral)] flex items-center justify-center">
                <span className="font-mono text-sm font-bold text-[var(--void)]">
                  {user.display_name
                    ? user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                    : user.username.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <Link href={`/profile/${user.username}`} className="block">
              <p className="font-mono text-sm text-[var(--cream)] hover:text-[var(--coral)] transition-colors truncate">
                {user.display_name || user.username}
              </p>
              <p className="font-mono text-xs text-[var(--muted)]">
                @{user.username}
              </p>
            </Link>
            {user.bio && (
              <p className="font-mono text-xs text-[var(--soft)] mt-1 line-clamp-1">
                {user.bio}
              </p>
            )}
          </div>

        </div>
      ))}
    </div>
  );
}

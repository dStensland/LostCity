"use client";

import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export default function AccountPanel() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--cream)]">Account</h2>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          Your account information.
        </p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
            Email
          </label>
          <p className="font-mono text-sm text-[var(--cream)]">{user.email}</p>
        </div>

        {/* Member Since */}
        <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
            Member Since
          </label>
          <p className="font-mono text-sm text-[var(--cream)]">
            {format(new Date(user.created_at), "MMMM d, yyyy")}
          </p>
        </div>

        {/* Auth Provider */}
        <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
            Sign-in Method
          </label>
          <p className="font-mono text-sm text-[var(--cream)] capitalize">
            {user.app_metadata?.provider || "Email"}
          </p>
        </div>
      </div>

      {/* Sign Out */}
      <div className="pt-4 border-t border-[var(--twilight)]">
        <button
          onClick={signOut}
          className="px-6 py-2.5 rounded-lg border border-[var(--coral)]/30 text-[var(--coral)] font-mono text-sm hover:bg-[var(--coral)]/10 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

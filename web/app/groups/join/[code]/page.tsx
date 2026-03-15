"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useJoinGroup } from "@/lib/hooks/useGroups";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";

export default function JoinGroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const joinGroup = useJoinGroup();

  useEffect(() => {
    if (!ENABLE_GROUPS_V1 || !code) return;

    joinGroup.mutate(
      { invite_code: code },
      {
        onSuccess: (group) => {
          router.replace(`/groups/${group.id}`);
        },
      }
    );
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!ENABLE_GROUPS_V1) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-[var(--muted)] font-mono text-sm">Groups are coming soon.</p>
      </div>
    );
  }

  // Loading state
  if (joinGroup.isPending || joinGroup.isIdle) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--vibe)]/10 border border-[var(--vibe)]/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--vibe)] border-t-transparent animate-spin" />
          </div>
          <p className="text-base font-semibold text-[var(--cream)] mb-1">Joining...</p>
          <p className="text-sm text-[var(--soft)]">Hang tight while we add you to the group.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (joinGroup.isError) {
    const message = joinGroup.error instanceof Error
      ? joinGroup.error.message
      : "This invite link may be invalid or expired.";

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--coral)]/10 border border-[var(--coral)]/20 flex items-center justify-center text-3xl">
            🚫
          </div>
          <p className="text-base font-semibold text-[var(--cream)] mb-2">
            Couldn&apos;t join group
          </p>
          <p className="text-sm text-[var(--soft)] mb-5">{message}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--vibe)] text-[var(--void)] font-mono text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Success — redirect happens in onSuccess above
  return null;
}

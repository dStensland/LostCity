"use client";

import { useState } from "react";
import { UserCirclePlus, CheckCircle } from "@phosphor-icons/react";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";

interface ArtistClaimBannerProps {
  artistId: string;
  artistName: string;
  isClaimed: boolean;
  isVerified: boolean;
}

export function ArtistClaimBanner({
  artistId,
  artistName,
  isClaimed,
  isVerified,
}: ArtistClaimBannerProps) {
  const { authFetch, user } = useAuthenticatedFetch();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(isClaimed);

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs text-[var(--neon-green)]">
        <CheckCircle size={14} weight="fill" />
        <span>Verified Artist</span>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs text-[var(--soft)]">
        <CheckCircle size={14} weight="duotone" />
        <span>Profile claimed — pending verification</span>
      </div>
    );
  }

  const handleClaim = async () => {
    if (!user) return;
    setClaiming(true);
    const { error } = await authFetch<{ success: boolean }>(
      "/api/artists/claim",
      {
        method: "POST",
        body: { artist_id: artistId },
      }
    );
    if (!error) {
      setClaimed(true);
    }
    setClaiming(false);
  };

  return (
    <div className="border border-[var(--twilight)] rounded-none p-4 space-y-2">
      <div className="flex items-start gap-3">
        <UserCirclePlus
          size={20}
          weight="duotone"
          className="text-[var(--action-primary)] flex-shrink-0 mt-0.5"
        />
        <div className="space-y-2">
          <p className="font-mono text-sm text-[var(--cream)]">
            Is this you?
          </p>
          <p className="font-mono text-xs text-[var(--muted)] leading-relaxed">
            Claim your profile to add your bio, links, and keep your exhibition
            record up to date.
          </p>
          <button
            onClick={handleClaim}
            disabled={claiming || !user}
            className="font-mono text-xs px-3 py-1.5 border border-[var(--action-primary)] text-[var(--action-primary)] rounded-none hover:bg-[var(--action-primary)]/10 transition-colors disabled:opacity-50"
          >
            {claiming
              ? "Claiming..."
              : `Claim ${artistName}'s Profile`}
          </button>
        </div>
      </div>
    </div>
  );
}

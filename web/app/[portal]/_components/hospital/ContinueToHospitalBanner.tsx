"use client";

import { useMyHospital } from "@/lib/hooks/useMyHospital";
import Link from "next/link";

type Props = {
  portalSlug: string;
  portalId: string;
};

export default function ContinueToHospitalBanner({ portalSlug, portalId }: Props) {
  const { myHospital, loaded } = useMyHospital(portalId);

  if (!loaded || !myHospital) return null;

  return (
    <div className="rounded-xl border border-[#c7d3e8] bg-[#f3f7ff] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-xs text-[#4b6a9b]">Your recent hospital</p>
        <p className="text-sm font-semibold text-[#002f6c]">{myHospital.displayName}</p>
      </div>
      <Link
        href={`/${portalSlug}/hospitals/${myHospital.slug}`}
        className="emory-primary-btn inline-flex items-center text-sm"
      >
        Continue to {myHospital.shortName}
      </Link>
    </div>
  );
}

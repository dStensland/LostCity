"use client";

import { useRouter } from "next/navigation";
import FestivalDetailView from "./FestivalDetailView";

interface FestivalDetailPageClientProps {
  slug: string;
  portalSlug: string;
}

export default function FestivalDetailPageClient({
  slug,
  portalSlug,
}: FestivalDetailPageClientProps) {
  const router = useRouter();

  const handleClose = () => {
    router.push(`/${portalSlug}`);
  };

  return (
    <FestivalDetailView
      slug={slug}
      portalSlug={portalSlug}
      onClose={handleClose}
      showOpenPageLink={false}
    />
  );
}

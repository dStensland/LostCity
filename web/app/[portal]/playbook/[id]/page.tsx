"use client";

import { useParams } from "next/navigation";
import { usePortal } from "@/lib/portal-context";
import PlaybookEditor from "@/components/playbook/PlaybookEditor";

export default function PlaybookEditorPage() {
  const params = useParams();
  const portalSlug = params.portal as string;
  const itineraryId = params.id as string;
  const { portal } = usePortal();

  return (
    <PlaybookEditor
      itineraryId={itineraryId}
      portalId={portal?.id || ""}
      portalSlug={portalSlug}
    />
  );
}

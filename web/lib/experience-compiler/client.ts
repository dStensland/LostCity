import type { ExperienceSpec } from "./types";

export type ExperienceApiWarning = {
  code?: string;
  message?: string;
  field?: string;
};

export type ExperienceApiResponse = {
  mode?: "dry_run" | "applied";
  error?: string;
  details?: string[];
  warnings?: ExperienceApiWarning[];
  compiled?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sections?: Record<string, unknown>;
  portal?: Record<string, unknown>;
};

export async function applyPortalExperience(
  portalId: string,
  spec: ExperienceSpec,
  options?: {
    apply?: boolean;
    sync_sections?: boolean;
    replace_sections?: boolean;
  }
): Promise<ExperienceApiResponse> {
  const res = await fetch(`/api/admin/portals/${portalId}/experience`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      spec,
      apply: options?.apply ?? true,
      sync_sections: options?.sync_sections,
      replace_sections: options?.replace_sections,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as ExperienceApiResponse;

  if (!res.ok) {
    const details = Array.isArray(data.details) && data.details.length > 0
      ? ` (${data.details.join("; ")})`
      : "";
    throw new Error((data.error || "Failed to apply experience") + details);
  }

  return data;
}

import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkBodySize, adminErrorResponse, isValidUUID } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { compileExperienceSpec, validateExperienceSpec } from "@/lib/experience-compiler";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// POST /api/admin/portals/[id]/experience
// Compile (dry-run) or apply an AI-generated experience spec to a portal.
export async function POST(request: NextRequest, { params }: RouteProps) {
  const sizeCheck = checkBodySize(request, 50_000);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;

  if (!isValidUUID(portalId)) {
    return NextResponse.json({ error: "Invalid portal ID" }, { status: 400 });
  }

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const applyChanges = payload.apply === true;
  const syncSections = payload.sync_sections !== false;
  const replaceSections = payload.replace_sections !== false;
  const specInput = isObject(payload.spec) ? payload.spec : payload;

  const validation = validateExperienceSpec(specInput);
  if (!validation.ok) {
    return NextResponse.json({ error: "Invalid experience spec", details: validation.errors }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalData, error: portalError } = await (serviceClient as any)
    .from("portals")
    .select("id, slug, portal_type, filters, branding, settings")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError || !portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portal = portalData as {
    id: string;
    slug: string;
    portal_type: "city" | "event" | "business" | "personal";
    filters: Record<string, unknown> | null;
    branding: Record<string, unknown> | null;
    settings: Record<string, unknown> | null;
  };

  const compiled = compileExperienceSpec(validation.value.spec, {
    portalId: portal.id,
    portalSlug: portal.slug,
    portalType: portal.portal_type,
    existingFilters: portal.filters,
    existingBranding: portal.branding,
    existingSettings: portal.settings,
  });

  const warnings = [...validation.value.warnings, ...compiled.warnings];

  if (!applyChanges) {
    return NextResponse.json({
      mode: "dry_run",
      apply_required: true,
      compiled,
      warnings,
      options: {
        sync_sections: syncSections,
        replace_sections: replaceSections,
      },
    });
  }

  const portalUpdates: Record<string, unknown> = {
    filters: compiled.portal.filters,
    branding: compiled.portal.branding,
    settings: compiled.portal.settings,
    updated_at: new Date().toISOString(),
  };

  if (compiled.portal.name !== undefined) portalUpdates.name = compiled.portal.name;
  if (compiled.portal.tagline !== undefined) portalUpdates.tagline = compiled.portal.tagline;
  if (compiled.portal.parent_portal_id !== undefined) {
    portalUpdates.parent_portal_id = compiled.portal.parent_portal_id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedPortal, error: updatePortalError } = await (serviceClient as any)
    .from("portals")
    .update(portalUpdates)
    .eq("id", portalId)
    .select("id, slug, name, tagline, parent_portal_id, filters, branding, settings")
    .maybeSingle();

  if (updatePortalError || !updatedPortal) {
    return adminErrorResponse(updatePortalError || new Error("Failed to update portal"), "POST /api/admin/portals/[id]/experience");
  }

  const sectionSummary = {
    synced: false,
    replaced: false,
    inserted: 0,
    updated: 0,
    total: compiled.sections.length,
  };

  if (syncSections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSections, error: existingSectionsError } = await (serviceClient as any)
      .from("portal_sections")
      .select("id, slug")
      .eq("portal_id", portalId);

    if (existingSectionsError) {
      return adminErrorResponse(existingSectionsError, "POST /api/admin/portals/[id]/experience (load sections)");
    }

    const existing = (existingSections || []) as Array<{ id: string; slug: string }>;

    if (replaceSections) {
      const existingIds = existing.map((s) => s.id);

      if (existingIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteItemsError } = await (serviceClient as any)
          .from("portal_section_items")
          .delete()
          .in("section_id", existingIds);

        if (deleteItemsError) {
          return adminErrorResponse(deleteItemsError, "POST /api/admin/portals/[id]/experience (delete section items)");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteSectionsError } = await (serviceClient as any)
          .from("portal_sections")
          .delete()
          .eq("portal_id", portalId);

        if (deleteSectionsError) {
          return adminErrorResponse(deleteSectionsError, "POST /api/admin/portals/[id]/experience (delete sections)");
        }
      }

      if (compiled.sections.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertSectionsError } = await (serviceClient as any)
          .from("portal_sections")
          .insert(
            compiled.sections.map((section) => ({
              portal_id: portalId,
              slug: section.slug,
              title: section.title,
              description: section.description || null,
              section_type: section.section_type,
              auto_filter: section.auto_filter || null,
              layout: section.layout || null,
              items_per_row: section.items_per_row || null,
              max_items: section.max_items || null,
              style: section.style || null,
              is_visible: section.is_visible,
              display_order: section.display_order,
            }))
          );

        if (insertSectionsError) {
          return adminErrorResponse(insertSectionsError, "POST /api/admin/portals/[id]/experience (insert sections)");
        }
      }

      sectionSummary.synced = true;
      sectionSummary.replaced = true;
      sectionSummary.inserted = compiled.sections.length;
    } else {
      const existingBySlug = new Map(existing.map((s) => [s.slug, s.id]));

      for (const section of compiled.sections) {
        const existingId = existingBySlug.get(section.slug);
        if (existingId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateSectionError } = await (serviceClient as any)
            .from("portal_sections")
            .update({
              title: section.title,
              description: section.description || null,
              section_type: section.section_type,
              auto_filter: section.auto_filter || null,
              layout: section.layout || null,
              items_per_row: section.items_per_row || null,
              max_items: section.max_items || null,
              style: section.style || null,
              is_visible: section.is_visible,
              display_order: section.display_order,
            })
            .eq("id", existingId);

          if (updateSectionError) {
            return adminErrorResponse(updateSectionError, "POST /api/admin/portals/[id]/experience (update section)");
          }

          sectionSummary.updated += 1;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertSectionError } = await (serviceClient as any)
            .from("portal_sections")
            .insert({
              portal_id: portalId,
              slug: section.slug,
              title: section.title,
              description: section.description || null,
              section_type: section.section_type,
              auto_filter: section.auto_filter || null,
              layout: section.layout || null,
              items_per_row: section.items_per_row || null,
              max_items: section.max_items || null,
              style: section.style || null,
              is_visible: section.is_visible,
              display_order: section.display_order,
            });

          if (insertSectionError) {
            return adminErrorResponse(insertSectionError, "POST /api/admin/portals/[id]/experience (insert section)");
          }

          sectionSummary.inserted += 1;
        }
      }

      sectionSummary.synced = true;
      sectionSummary.replaced = false;
    }
  }

  return NextResponse.json({
    mode: "applied",
    portal: updatedPortal,
    sections: sectionSummary,
    warnings,
    metadata: compiled.metadata,
  });
}

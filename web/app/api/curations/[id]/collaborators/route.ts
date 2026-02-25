import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidUUID } from "@/lib/api-utils";
import { isValidCollaboratorRole } from "@/lib/curation-utils";

/**
 * GET /api/curations/[id]/collaborators
 * List collaborators (visible to owner and collaborators)
 */
export const GET = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      // Verify user is owner or collaborator
      const { data: list } = await serviceClient
        .from("lists")
        .select("creator_id")
        .eq("id", listId)
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: "Curation not found" }, { status: 404 });
      }

      const isOwner = list.creator_id === user.id;

      if (!isOwner) {
        const { data: collab } = await serviceClient
          .from("curation_collaborators")
          .select("id")
          .eq("list_id", listId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!collab) {
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
      }

      const { data: collaborators, error } = await serviceClient
        .from("curation_collaborators")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Collaborators fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch collaborators" }, { status: 500 });
      }

      // Fetch profiles
      const userIds = (collaborators || []).map((c: { user_id: string }) => c.user_id);
      let profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();

      if (userIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (profiles) {
          profileMap = new Map(
            profiles.map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => [p.id, p])
          );
        }
      }

      const collaboratorsWithProfiles = (collaborators || []).map((c: { user_id: string; [key: string]: unknown }) => ({
        ...c,
        profile: profileMap.get(c.user_id) || null,
      }));

      return NextResponse.json({ collaborators: collaboratorsWithProfiles });
    } catch (error) {
      console.error("Collaborators GET error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);

/**
 * POST /api/curations/[id]/collaborators
 * Invite a collaborator (owner only)
 */
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      const body = await request.json();
      const { user_id: inviteeId, role } = body;

      if (!isValidUUID(inviteeId)) {
        return validationError("Invalid user_id");
      }

      if (role && !isValidCollaboratorRole(role)) {
        return validationError("Invalid role. Must be 'editor' or 'moderator'");
      }

      // Verify ownership
      const { data: list } = await serviceClient
        .from("lists")
        .select("creator_id")
        .eq("id", listId)
        .maybeSingle();

      if (!list || list.creator_id !== user.id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      // Can't invite yourself
      if (inviteeId === user.id) {
        return validationError("Cannot invite yourself as a collaborator");
      }

      // Check for existing invitation
      const { data: existing } = await serviceClient
        .from("curation_collaborators")
        .select("id, status")
        .eq("list_id", listId)
        .eq("user_id", inviteeId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "User already has a collaboration record", existing_status: existing.status },
          { status: 409 }
        );
      }

      const { data: collaborator, error } = await serviceClient
        .from("curation_collaborators")
        .insert({
          list_id: listId,
          user_id: inviteeId,
          role: role || "editor",
          invited_by: user.id,
          status: "pending",
        } as never)
        .select()
        .single();

      if (error) {
        console.error("Collaborator invite error:", error);
        return NextResponse.json({ error: "Failed to invite collaborator" }, { status: 500 });
      }

      return NextResponse.json({ collaborator }, { status: 201 });
    } catch (error) {
      console.error("Collaborators POST error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);

/**
 * PATCH /api/curations/[id]/collaborators
 * Accept or decline an invitation (invitee only)
 */
export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      const body = await request.json();
      const { action } = body;

      if (!action || !["accept", "decline"].includes(action)) {
        return validationError("Action must be 'accept' or 'decline'");
      }

      const newStatus = action === "accept" ? "accepted" : "declined";

      const { data: collaborator, error } = await serviceClient
        .from("curation_collaborators")
        .update({ status: newStatus })
        .eq("list_id", listId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();

      if (error) {
        console.error("Collaborator update error:", error);
        return NextResponse.json({ error: "Failed to update collaboration" }, { status: 500 });
      }

      if (!collaborator) {
        return NextResponse.json({ error: "No pending invitation found" }, { status: 404 });
      }

      return NextResponse.json({ collaborator });
    } catch (error) {
      console.error("Collaborators PATCH error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);

/**
 * DELETE /api/curations/[id]/collaborators
 * Remove a collaborator (owner or self)
 * Query param: user_id (required)
 */
export const DELETE = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("user_id");

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    if (!targetUserId || !isValidUUID(targetUserId)) {
      return validationError("user_id query parameter is required");
    }

    try {
      // Verify user is owner or removing themselves
      const { data: list } = await serviceClient
        .from("lists")
        .select("creator_id")
        .eq("id", listId)
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: "Curation not found" }, { status: 404 });
      }

      const isOwner = list.creator_id === user.id;
      const isSelf = targetUserId === user.id;

      if (!isOwner && !isSelf) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const { error } = await serviceClient
        .from("curation_collaborators")
        .delete()
        .eq("list_id", listId)
        .eq("user_id", targetUserId);

      if (error) {
        console.error("Collaborator delete error:", error);
        return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Collaborators DELETE error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// POST /api/auth/avatar — Upload avatar
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, user.id);
  if (rateLimitResult) return rateLimitResult;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    let contentType = file.type;
    let ext = "jpg";

    // Try to resize with sharp if available
    try {
      const sharp = (await import("sharp")).default;
      const resized = await sharp(buffer)
        .resize(256, 256, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85 })
        .toBuffer();
      buffer = Buffer.from(resized);
      contentType = "image/jpeg";
      ext = "jpg";
    } catch {
      // sharp not available — upload original
      const extMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      ext = extMap[file.type] || "jpg";
    }

    const filename = `${user.id}/avatar.${ext}`;

    // Delete old avatar files first (handles extension changes)
    const { data: existingFiles } = await supabase.storage
      .from("avatars")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("avatars").remove(filesToDelete);
    }

    // Upload new avatar
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(filename, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      logger.error("Avatar upload error", error, {
        userId: user.id,
        component: "auth/avatar",
      });
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(data.path);

    // Add cache-busting param
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    // Update profile
    await (supabase.from("profiles") as ReturnType<typeof supabase.from>)
      .update({ avatar_url: avatarUrl } as never)
      .eq("id", user.id);

    return NextResponse.json({ url: avatarUrl });
  } catch (error) {
    logger.error("Avatar processing error", error, {
      userId: user.id,
      component: "auth/avatar",
    });
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/avatar — Remove avatar
export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, user.id);
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // List and delete all avatar files for this user
    const { data: existingFiles } = await supabase.storage
      .from("avatars")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("avatars").remove(filesToDelete);
    }

    // Clear avatar_url in profile
    await (supabase.from("profiles") as ReturnType<typeof supabase.from>)
      .update({ avatar_url: null } as never)
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Avatar delete error", error, {
      userId: user.id,
      component: "auth/avatar",
    });
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 }
    );
  }
}

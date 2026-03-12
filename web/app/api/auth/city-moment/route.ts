import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { ENABLE_CITY_MOMENTS } from "@/lib/launch-flags";

const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_THUMBNAIL_SIZE = 512 * 1024; // 512KB
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

// POST /api/auth/city-moment — Upload city moment video + thumbnail
export async function POST(request: NextRequest) {
  if (!ENABLE_CITY_MOMENTS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, user.id);
  if (rateLimitResult) return rateLimitResult;

  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;
    const thumbnail = formData.get("thumbnail") as File | null;

    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    if (!ALLOWED_VIDEO_TYPES.includes(video.type)) {
      return NextResponse.json(
        { error: "Invalid video type. Allowed: MP4, WebM, MOV" },
        { status: 400 },
      );
    }

    if (video.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: "Video too large. Maximum size is 10MB" },
        { status: 400 },
      );
    }

    if (thumbnail && thumbnail.size > MAX_THUMBNAIL_SIZE) {
      return NextResponse.json(
        { error: "Thumbnail too large. Maximum size is 512KB" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Delete previous city moment files
    const { data: existingFiles } = await supabase.storage
      .from("city-moments")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("city-moments").remove(filesToDelete);
    }

    // Determine extension from MIME type
    const extMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    };
    const ext = extMap[video.type] || "mp4";
    const videoPath = `${user.id}/moment.${ext}`;

    // Upload video
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const { data: videoData, error: videoError } = await supabase.storage
      .from("city-moments")
      .upload(videoPath, videoBuffer, {
        contentType: video.type,
        upsert: true,
      });

    if (videoError) {
      logger.error("City moment video upload error", videoError, {
        userId: user.id,
        component: "auth/city-moment",
      });
      return NextResponse.json(
        { error: "Failed to upload video" },
        { status: 500 },
      );
    }

    // Get video public URL
    const {
      data: { publicUrl: videoPublicUrl },
    } = supabase.storage.from("city-moments").getPublicUrl(videoData.path);
    const momentUrl = `${videoPublicUrl}?v=${Date.now()}`;

    // Upload thumbnail if provided
    let thumbnailUrl: string | null = null;
    if (thumbnail) {
      const thumbPath = `${user.id}/thumbnail.jpg`;
      const thumbBuffer = Buffer.from(await thumbnail.arrayBuffer());
      const { data: thumbData, error: thumbError } = await supabase.storage
        .from("city-moments")
        .upload(thumbPath, thumbBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (thumbError) {
        logger.warn("City moment thumbnail upload failed, continuing without", {
          error: thumbError.message,
          userId: user.id,
        });
      } else {
        const {
          data: { publicUrl: thumbPublicUrl },
        } = supabase.storage.from("city-moments").getPublicUrl(thumbData.path);
        thumbnailUrl = `${thumbPublicUrl}?v=${Date.now()}`;
      }
    }

    // Update profile
    await (supabase.from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        city_moment_url: momentUrl,
        city_moment_thumbnail_url: thumbnailUrl,
      } as never)
      .eq("id", user.id);

    return NextResponse.json({
      momentUrl,
      thumbnailUrl,
    });
  } catch (error) {
    logger.error("City moment processing error", error, {
      userId: user.id,
      component: "auth/city-moment",
    });
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}

// DELETE /api/auth/city-moment — Remove city moment
export async function DELETE(request: NextRequest) {
  if (!ENABLE_CITY_MOMENTS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, user.id);
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // List and delete all city moment files for this user
    const { data: existingFiles } = await supabase.storage
      .from("city-moments")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("city-moments").remove(filesToDelete);
    }

    // Clear URLs in profile
    await (supabase.from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        city_moment_url: null,
        city_moment_thumbnail_url: null,
      } as never)
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("City moment delete error", error, {
      userId: user.id,
      component: "auth/city-moment",
    });
    return NextResponse.json(
      { error: "Failed to remove city moment" },
      { status: 500 },
    );
  }
}

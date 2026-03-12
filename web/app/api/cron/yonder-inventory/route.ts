import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, checkParsedBodySize } from "@/lib/api-utils";
import { createServiceClient } from "@/lib/supabase/service";
import {
  resolveYonderInventoryRefreshConfig,
  shouldRunYonderInventoryRefreshAt,
} from "@/lib/yonder-inventory-refresh-schedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const DEFAULT_KEEP_PER_WINDOW = 2;
const DEFAULT_FRESHNESS_MAX_AGE_DAYS = 1;

type CronRequestBody = {
  force?: boolean;
  skip_prune?: boolean;
  keep_per_window?: number;
  freshness_max_age_days?: number;
};

type PortalRow = {
  id: string;
  slug: string;
  status: string;
  settings: Record<string, unknown> | null;
};

function isAuthorized(request: NextRequest): boolean {
  const expectedKey = process.env.YONDER_INVENTORY_CRON_API_KEY;
  if (!expectedKey) return false;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
  if (!token || token.length !== expectedKey.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expectedKey));
  } catch {
    return false;
  }
}

async function resolveYonderPortal(): Promise<PortalRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("portals")
    .select("id, slug, status, settings")
    .eq("slug", "yonder")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed resolving Yonder portal: ${error.message}`);
  }

  return (data as PortalRow | null) || null;
}

function getWorkspaceRoot() {
  const cwd = process.cwd();
  if (path.basename(cwd) === "web") {
    return path.resolve(cwd, "..");
  }
  return cwd;
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.standard,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CronRequestBody = {};
  try {
    body = (await request.json()) as CronRequestBody;
  } catch {
    body = {};
  }

  const parsedSizeCheck = checkParsedBodySize(body, 4096);
  if (parsedSizeCheck) return parsedSizeCheck;

  if (
    body.keep_per_window !== undefined &&
    (!Number.isInteger(body.keep_per_window) || body.keep_per_window < 1 || body.keep_per_window > 10)
  ) {
    return NextResponse.json(
      { error: "keep_per_window must be an integer between 1 and 10" },
      { status: 400 },
    );
  }

  if (
    body.freshness_max_age_days !== undefined &&
    (!Number.isInteger(body.freshness_max_age_days) ||
      body.freshness_max_age_days < 0 ||
      body.freshness_max_age_days > 14)
  ) {
    return NextResponse.json(
      { error: "freshness_max_age_days must be an integer between 0 and 14" },
      { status: 400 },
    );
  }

  try {
    const portal = await resolveYonderPortal();
    if (!portal) {
      return NextResponse.json({ error: "Yonder portal not found" }, { status: 404 });
    }

    const refreshConfig = resolveYonderInventoryRefreshConfig(portal.settings);
    const forced = body.force === true;
    if (!forced && !shouldRunYonderInventoryRefreshAt(refreshConfig, new Date())) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: refreshConfig.cadence === "disabled" ? "disabled" : "outside_daily_window",
        portal: {
          id: portal.id,
          slug: portal.slug,
          status: portal.status,
        },
        refresh_config: {
          cadence: refreshConfig.cadence,
          hour_utc: refreshConfig.hourUtc,
          source: refreshConfig.source,
        },
      });
    }

    const workspaceRoot = getWorkspaceRoot();
    const crawlersRoot = path.join(workspaceRoot, "crawlers");
    if (!fs.existsSync(crawlersRoot)) {
      return NextResponse.json(
        {
          success: false,
          error: "Crawler workspace unavailable for Yonder inventory sync",
        },
        { status: 503 },
      );
    }
    const pythonBinary = process.env.PYTHON_BIN || "python3";
    const commandArgs = [
      "scripts/run_yonder_inventory_cycle.py",
      "--apply",
      "--keep-per-window",
      String(body.keep_per_window ?? DEFAULT_KEEP_PER_WINDOW),
      "--freshness-max-age-days",
      String(body.freshness_max_age_days ?? DEFAULT_FRESHNESS_MAX_AGE_DAYS),
    ];

    if (body.skip_prune === true) {
      commandArgs.push("--skip-prune");
    }

    const result = await execFileAsync(pythonBinary, commandArgs, {
      cwd: crawlersRoot,
      maxBuffer: 1024 * 1024 * 8,
      env: process.env,
    });

    return NextResponse.json({
      success: true,
      skipped: false,
      forced,
      portal: {
        id: portal.id,
        slug: portal.slug,
        status: portal.status,
      },
      refresh_config: {
        cadence: refreshConfig.cadence,
        hour_utc: refreshConfig.hourUtc,
        source: refreshConfig.source,
      },
      command: {
        program: pythonBinary,
        args: commandArgs,
      },
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Yonder inventory cron failure",
      },
      { status: 500 },
    );
  }
}

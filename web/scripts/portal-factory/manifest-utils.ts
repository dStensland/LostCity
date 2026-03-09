import fs from "fs";
import path from "path";
import { config as loadDotenv } from "dotenv";

export type PortalType = "city" | "event" | "business" | "personal";
export type PortalVisibility = "public" | "unlisted" | "private";
export type PortalPlan = "starter" | "professional" | "enterprise";
export type ChannelType = "jurisdiction" | "institution" | "topic" | "community" | "intent";
export type RuleType = "source" | "organization" | "venue" | "category" | "tag" | "geo" | "expression";
export type RefreshCadence = "hourly" | "daily" | "disabled";

export type PortalSectionManifest = {
  slug: string;
  title: string;
  description?: string;
  section_type: "auto" | "curated" | "mixed";
  auto_filter?: Record<string, unknown>;
  is_visible?: boolean;
  display_order?: number;
};

export type InterestChannelRuleManifest = {
  rule_type: RuleType;
  rule_payload: Record<string, unknown>;
  priority?: number;
  is_active?: boolean;
};

export type InterestChannelManifest = {
  slug: string;
  name: string;
  channel_type: ChannelType;
  description?: string;
  metadata?: Record<string, unknown>;
  is_active?: boolean;
  sort_order?: number;
  rules?: InterestChannelRuleManifest[];
};

export type PortalManifest = {
  portal: {
    slug: string;
    name: string;
    tagline?: string;
    portal_type: PortalType;
    visibility?: PortalVisibility;
    plan?: PortalPlan;
    parent_portal_slug?: string | null;
    filters?: Record<string, unknown>;
    branding?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
  source_subscriptions?: {
    source_slugs: string[];
    subscription_scope?: "all" | "selected";
    subscribed_categories?: string[] | null;
    is_active?: boolean;
  };
  sections?: PortalSectionManifest[];
  interest_channels?: InterestChannelManifest[];
  refresh_schedule?: {
    cadence: RefreshCadence;
    hour_utc?: number;
  };
};

export type ScriptOptions = {
  manifestPath: string;
  dryRun: boolean;
  activate: boolean;
  skipDb: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseCliOptions(argv: string[]): ScriptOptions {
  let manifestPath = "";
  let dryRun = false;
  let activate = false;
  let skipDb = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--manifest") {
      manifestPath = argv[i + 1] || "";
      i += 1;
    } else if (token === "--dry-run") {
      dryRun = true;
    } else if (token === "--activate") {
      activate = true;
    } else if (token === "--skip-db") {
      skipDb = true;
    } else if (token === "--help" || token === "-h") {
      printUsageAndExit();
    }
  }

  if (!manifestPath) {
    console.error("Missing required argument: --manifest <path>");
    printUsageAndExit(1);
  }

  return {
    manifestPath,
    dryRun,
    activate,
    skipDb,
  };
}

function printUsageAndExit(code = 0): never {
  console.log(
    "Usage: npx tsx scripts/portal-factory/<script>.ts --manifest <path> [--dry-run] [--activate] [--skip-db]",
  );
  process.exit(code);
}

export function resolveWorkspaceRoot(): string {
  return path.resolve(__dirname, "../../..");
}

export function resolveManifestPath(manifestPath: string): string {
  if (path.isAbsolute(manifestPath)) return manifestPath;
  return path.resolve(process.cwd(), manifestPath);
}

export function loadPortalManifest(manifestPath: string): PortalManifest {
  const absolutePath = resolveManifestPath(manifestPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Manifest not found: ${absolutePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse manifest JSON: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  if (!isObject(parsed) || !isObject(parsed.portal)) {
    throw new Error("Manifest must include a top-level 'portal' object");
  }

  const portal = parsed.portal;
  if (!isNonEmptyString(portal.slug)) throw new Error("portal.slug is required");
  if (!isNonEmptyString(portal.name)) throw new Error("portal.name is required");
  if (!isNonEmptyString(portal.portal_type)) throw new Error("portal.portal_type is required");
  if (!["city", "event", "business", "personal"].includes(String(portal.portal_type))) {
    throw new Error("portal.portal_type must be one of: city, event, business, personal");
  }

  if (parsed.source_subscriptions !== undefined) {
    if (!isObject(parsed.source_subscriptions)) {
      throw new Error("source_subscriptions must be an object when provided");
    }
    const sourceSlugs = parsed.source_subscriptions.source_slugs;
    if (!Array.isArray(sourceSlugs) || sourceSlugs.some((slug) => !isNonEmptyString(slug))) {
      throw new Error("source_subscriptions.source_slugs must be an array of strings");
    }
  }

  if (parsed.refresh_schedule !== undefined) {
    if (!isObject(parsed.refresh_schedule)) {
      throw new Error("refresh_schedule must be an object when provided");
    }
    const cadence = parsed.refresh_schedule.cadence;
    if (!["hourly", "daily", "disabled"].includes(String(cadence))) {
      throw new Error("refresh_schedule.cadence must be one of: hourly, daily, disabled");
    }
    if (cadence === "daily") {
      const hour = parsed.refresh_schedule.hour_utc;
      if (!Number.isInteger(hour) || (hour as number) < 0 || (hour as number) > 23) {
        throw new Error("refresh_schedule.hour_utc must be an integer 0-23 when cadence=daily");
      }
    }
  }

  return parsed as PortalManifest;
}

export function loadBestEffortEnv(workspaceRoot: string): void {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(workspaceRoot, ".env.local"),
    path.resolve(workspaceRoot, ".env"),
    path.resolve(workspaceRoot, "web/.env.local"),
    path.resolve(workspaceRoot, "web/.env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      loadDotenv({ path: candidate, override: false });
    }
  }
}

export function collectManifestSourceSlugs(manifest: PortalManifest): string[] {
  const sourceSlugs = new Set<string>();

  for (const slug of manifest.source_subscriptions?.source_slugs || []) {
    sourceSlugs.add(slug.trim());
  }

  for (const channel of manifest.interest_channels || []) {
    for (const rule of channel.rules || []) {
      if (rule.rule_type !== "source") continue;
      const payload = rule.rule_payload || {};
      const payloadSlug = payload.source_slug;
      if (isNonEmptyString(payloadSlug)) {
        sourceSlugs.add(payloadSlug.trim());
      }

      const payloadSlugs = payload.source_slugs;
      if (Array.isArray(payloadSlugs)) {
        for (const slug of payloadSlugs) {
          if (isNonEmptyString(slug)) {
            sourceSlugs.add(slug.trim());
          }
        }
      }
    }
  }

  return [...sourceSlugs].sort();
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
  return `{${entries.join(",")}}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

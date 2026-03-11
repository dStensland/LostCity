import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

type DbSourceRow = {
  id: number;
  slug: string;
  is_active: boolean | null;
};

function parseOverrideSlugs(mainFileContents: string): Set<string> {
  const startIndex = mainFileContents.indexOf("SOURCE_OVERRIDES = {");
  if (startIndex === -1) return new Set<string>();

  const tail = mainFileContents.slice(startIndex);
  const endIndex = tail.indexOf("\n}\n");
  const block = endIndex >= 0 ? tail.slice(0, endIndex + 2) : tail;
  const lines = block.split("\n");

  const overrideSlugs = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^\s*"([^"]+)":\s*"sources\.[^"]+",?/);
    if (match) overrideSlugs.add(match[1]);
  }
  return overrideSlugs;
}

export function getCrawlerSupportedSlugs(workspaceRoot: string): Set<string> {
  const supported = new Set<string>();
  const sourcesDir = path.join(workspaceRoot, "crawlers", "sources");
  if (fs.existsSync(sourcesDir)) {
    for (const filename of fs.readdirSync(sourcesDir)) {
      if (!filename.endsWith(".py") || filename.startsWith("_")) continue;
      const moduleName = filename.replace(/\.py$/, "");
      supported.add(moduleName.replace(/_/g, "-"));
    }
  }

  const mainPath = path.join(workspaceRoot, "crawlers", "main.py");
  if (fs.existsSync(mainPath)) {
    const overrides = parseOverrideSlugs(fs.readFileSync(mainPath, "utf8"));
    for (const slug of overrides) {
      supported.add(slug);
    }
  }

  return supported;
}

export function profileExists(workspaceRoot: string, slug: string): boolean {
  const profileDir = path.join(workspaceRoot, "crawlers", "sources", "profiles");
  return fs.existsSync(path.join(profileDir, `${slug}.yaml`))
    || fs.existsSync(path.join(profileDir, `${slug}.json`));
}

export async function validateSourceRowsInDb(
  slugs: string[],
): Promise<{
  missingInDb: string[];
  inactiveInDb: string[];
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY for DB validation.");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("sources")
    .select("id,slug,is_active")
    .in("slug", slugs);

  if (error) {
    throw new Error(`Failed querying sources table: ${error.message}`);
  }

  const foundBySlug = new Map<string, DbSourceRow>();
  for (const row of (data || []) as DbSourceRow[]) {
    foundBySlug.set(row.slug, row);
  }

  const missingInDb: string[] = [];
  const inactiveInDb: string[] = [];
  for (const slug of slugs) {
    const row = foundBySlug.get(slug);
    if (!row) {
      missingInDb.push(slug);
      continue;
    }
    if (row.is_active !== true) {
      inactiveInDb.push(slug);
    }
  }

  return {
    missingInDb,
    inactiveInDb,
  };
}

export async function validatePortalAccessibleSourceRowsInDb(
  portalSlug: string,
  slugs: string[],
): Promise<{
  portalFound: boolean;
  missingInDb: string[];
  inactiveInDb: string[];
  inaccessibleInPortal: string[];
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY for DB validation.");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", portalSlug)
    .maybeSingle();

  if (portalError) {
    throw new Error(`Failed querying portal '${portalSlug}': ${portalError.message}`);
  }

  const portalId = (portalData as { id: string } | null)?.id || null;
  if (!portalId) {
    return {
      portalFound: false,
      missingInDb: [],
      inactiveInDb: [],
      inaccessibleInPortal: [],
    };
  }

  const { data: sourceData, error: sourceError } = await supabase
    .from("sources")
    .select("id,slug,is_active")
    .in("slug", slugs);

  if (sourceError) {
    throw new Error(`Failed querying sources table: ${sourceError.message}`);
  }

  const foundBySlug = new Map<string, DbSourceRow>();
  const sourceIds: number[] = [];
  for (const row of (sourceData || []) as DbSourceRow[]) {
    foundBySlug.set(row.slug, row);
    sourceIds.push(row.id);
  }

  const missingInDb: string[] = [];
  const inactiveInDb: string[] = [];
  for (const slug of slugs) {
    const row = foundBySlug.get(slug);
    if (!row) {
      missingInDb.push(slug);
      continue;
    }
    if (row.is_active !== true) {
      inactiveInDb.push(slug);
    }
  }

  const activeIds = [...foundBySlug.values()]
    .filter((row) => row.is_active === true)
    .map((row) => row.id);

  let accessibleIds = new Set<number>();
  if (activeIds.length > 0) {
    const { data: accessData, error: accessError } = await supabase
      .from("portal_source_access")
      .select("source_id")
      .eq("portal_id", portalId)
      .in("source_id", activeIds);

    if (accessError) {
      throw new Error(`Failed querying portal_source_access: ${accessError.message}`);
    }

    accessibleIds = new Set(
      ((accessData || []) as Array<{ source_id: number | null }>)
        .map((row) => row.source_id)
        .filter((value): value is number => typeof value === "number"),
    );
  }

  const inaccessibleInPortal = [...foundBySlug.values()]
    .filter((row) => row.is_active === true && !accessibleIds.has(row.id))
    .map((row) => row.slug)
    .sort();

  return {
    portalFound: true,
    missingInDb,
    inactiveInDb,
    inaccessibleInPortal,
  };
}

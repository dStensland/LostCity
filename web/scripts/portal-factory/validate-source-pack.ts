import {
  collectManifestSourceSlugs,
  loadBestEffortEnv,
  loadPortalManifest,
  parseCliOptions,
  resolveManifestPath,
  resolveWorkspaceRoot,
} from "./manifest-utils";
import {
  getCrawlerSupportedSlugs,
  profileExists,
  validateSourceRowsInDb,
} from "./source-pack-utils";

type LocalCoverageRow = {
  slug: string;
  has_module: boolean;
  has_profile: boolean;
  crawlable: boolean;
};

function printLocalCoverage(rows: LocalCoverageRow[]): void {
  console.log("\nLocal crawlability coverage:");
  for (const row of rows) {
    console.log(
      `  - ${row.slug}: module=${row.has_module ? "yes" : "no"}, profile=${row.has_profile ? "yes" : "no"}, crawlable=${row.crawlable ? "yes" : "no"}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const workspaceRoot = resolveWorkspaceRoot();
  loadBestEffortEnv(workspaceRoot);

  const manifestPath = resolveManifestPath(options.manifestPath);
  const manifest = loadPortalManifest(manifestPath);
  const sourceSlugs = collectManifestSourceSlugs(manifest);

  if (sourceSlugs.length === 0) {
    console.log("No source slugs were found in the manifest. Nothing to validate.");
    process.exit(0);
  }

  console.log(`Validating source pack (${sourceSlugs.length} slugs):`);
  console.log(`  Manifest: ${manifestPath}`);

  const moduleSlugs = getCrawlerSupportedSlugs(workspaceRoot);
  const localRows: LocalCoverageRow[] = sourceSlugs.map((slug) => {
    const hasModule = moduleSlugs.has(slug);
    const hasProfile = profileExists(workspaceRoot, slug);
    return {
      slug,
      has_module: hasModule,
      has_profile: hasProfile,
      crawlable: hasModule || hasProfile,
    };
  });

  printLocalCoverage(localRows);

  const notCrawlable = localRows
    .filter((row) => !row.crawlable)
    .map((row) => row.slug);

  let missingInDb: string[] = [];
  let inactiveInDb: string[] = [];

  if (!options.skipDb) {
    const dbCheck = await validateSourceRowsInDb(sourceSlugs);
    missingInDb = dbCheck.missingInDb;
    inactiveInDb = dbCheck.inactiveInDb;

    console.log("\nDatabase source coverage:");
    console.log(`  Missing: ${missingInDb.length === 0 ? "none" : missingInDb.join(", ")}`);
    console.log(`  Inactive: ${inactiveInDb.length === 0 ? "none" : inactiveInDb.join(", ")}`);
  } else {
    console.log("\nDatabase source coverage: skipped (--skip-db)");
  }

  if (notCrawlable.length > 0 || missingInDb.length > 0 || inactiveInDb.length > 0) {
    console.error("\nSource-pack validation failed.");
    if (notCrawlable.length > 0) {
      console.error(`  Not crawlable (no module/profile): ${notCrawlable.join(", ")}`);
    }
    if (missingInDb.length > 0) {
      console.error(`  Missing in sources table: ${missingInDb.join(", ")}`);
    }
    if (inactiveInDb.length > 0) {
      console.error(`  Inactive in sources table: ${inactiveInDb.join(", ")}`);
    }
    process.exit(1);
  }

  console.log("\nSource-pack validation passed.");
}

main().catch((error) => {
  console.error("Validation failed with an unexpected error:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { config as loadDotenv } from "dotenv";
import path from "path";

loadDotenv({ path: path.resolve(process.cwd(), "../.env"), override: false });
loadDotenv({ path: path.resolve(process.cwd(), ".env"), override: false });

type TriggerOptions = {
  force: boolean;
  skipPrune: boolean;
  keepPerWindow?: number;
  freshnessMaxAgeDays?: number;
  showHelp: boolean;
};

function parseOptions(argv: string[]): TriggerOptions {
  const options: TriggerOptions = {
    force: false,
    skipPrune: false,
    showHelp: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--force") {
      options.force = true;
    } else if (token === "--skip-prune") {
      options.skipPrune = true;
    } else if (token === "--keep-per-window") {
      options.keepPerWindow = Number(argv[i + 1]);
      i += 1;
    } else if (token === "--freshness-max-age-days") {
      options.freshnessMaxAgeDays = Number(argv[i + 1]);
      i += 1;
    } else if (token === "--help" || token === "-h") {
      options.showHelp = true;
    }
  }

  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.showHelp) {
    console.log(
      "Usage: npx tsx scripts/trigger-yonder-inventory-cron.ts [--force] [--skip-prune] [--keep-per-window N] [--freshness-max-age-days N]",
    );
    process.exit(0);
  }

  const endpoint = process.env.YONDER_INVENTORY_CRON_URL;
  const apiKey = process.env.YONDER_INVENTORY_CRON_API_KEY;

  if (!endpoint) {
    throw new Error("Missing YONDER_INVENTORY_CRON_URL");
  }
  if (!apiKey) {
    throw new Error("Missing YONDER_INVENTORY_CRON_API_KEY");
  }

  const payload: Record<string, unknown> = {
    force: options.force,
    skip_prune: options.skipPrune,
  };

  if (Number.isInteger(options.keepPerWindow)) {
    payload.keep_per_window = options.keepPerWindow;
  }
  if (Number.isInteger(options.freshnessMaxAgeDays)) {
    payload.freshness_max_age_days = options.freshnessMaxAgeDays;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    console.error(JSON.stringify(parsed, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown cron trigger failure");
  process.exit(1);
});

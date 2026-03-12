import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function readFromRepo(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("spots schema sync", () => {
  it("registers get_spot_event_counts in database, supabase, and schema files", () => {
    const databaseMigration = readFromRepo(
      "database/migrations/325_spot_event_counts_rpc.sql",
    );
    const supabaseMigration = readFromRepo(
      "supabase/migrations/20260310009100_spot_event_counts_rpc.sql",
    );
    const schema = readFromRepo("database/schema.sql");

    expect(databaseMigration).toContain("CREATE OR REPLACE FUNCTION get_spot_event_counts");
    expect(supabaseMigration).toContain("CREATE OR REPLACE FUNCTION get_spot_event_counts");
    expect(schema).toContain("CREATE OR REPLACE FUNCTION get_spot_event_counts");
  });

  it("registers supporting spot count indexes in database, supabase, and schema files", () => {
    const databaseMigration = readFromRepo(
      "database/migrations/326_spot_event_counts_indexes.sql",
    );
    const supabaseMigration = readFromRepo(
      "supabase/migrations/20260310010000_spot_event_counts_indexes.sql",
    );
    const schema = readFromRepo("database/schema.sql");

    expect(databaseMigration).toContain("idx_events_spot_counts_portal_start_venue");
    expect(databaseMigration).toContain("idx_venues_city_id_for_spots");
    expect(supabaseMigration).toContain("idx_events_spot_counts_portal_start_venue");
    expect(supabaseMigration).toContain("idx_venues_city_id_for_spots");
    expect(schema).toContain("idx_events_spot_counts_portal_start_venue");
    expect(schema).toContain("idx_venues_city_id_for_spots");
  });
});

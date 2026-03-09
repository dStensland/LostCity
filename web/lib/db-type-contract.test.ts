import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function readDbTypes(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return fs.readFileSync(path.join(root, "lib", "supabase", "database.types.ts"), "utf-8");
}

describe("DB type contracts", () => {
  it("keeps follows.portal_id aligned with portal attribution migration", () => {
    const content = readDbTypes();

    const followsBlockMatch = content.match(/follows:\s*\{[\s\S]*?Relationships:\s*\[[\s\S]*?\n\s*\]\n\s*\}/);
    expect(followsBlockMatch, "follows block missing from generated DB types").toBeTruthy();

    const followsBlock = followsBlockMatch?.[0] || "";
    expect(followsBlock).toContain("portal_id: string | null");
    expect(followsBlock).toContain("portal_id?: string | null");
    expect(followsBlock).toContain('foreignKeyName: "follows_portal_id_fkey"');
  });
});

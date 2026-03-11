import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  collectManifestSourceSlugs,
  collectManifestStructuredSourceSlugs,
  loadPortalManifest,
} from "./manifest-utils";

const tempDirs: string[] = [];

function writeManifest(payload: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portal-manifest-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "manifest.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("portal factory manifest utils", () => {
  it("parses structured opportunity sources separately from crawlable source subscriptions", () => {
    const manifestPath = writeManifest({
      portal: {
        slug: "helpatl",
        name: "HelpATL",
        portal_type: "event",
      },
      source_subscriptions: {
        source_slugs: ["hands-on-atlanta", "marta-board"],
      },
      structured_opportunity_sources: {
        source_slugs: ["avlf", "red-cross-georgia"],
      },
    });

    const manifest = loadPortalManifest(manifestPath);

    expect(collectManifestSourceSlugs(manifest)).toEqual(["hands-on-atlanta", "marta-board"]);
    expect(collectManifestStructuredSourceSlugs(manifest)).toEqual(["avlf", "red-cross-georgia"]);
  });

  it("rejects malformed structured opportunity source manifests", () => {
    const manifestPath = writeManifest({
      portal: {
        slug: "helpatl",
        name: "HelpATL",
        portal_type: "event",
      },
      structured_opportunity_sources: {
        source_slugs: ["avlf", 42],
      },
    });

    expect(() => loadPortalManifest(manifestPath)).toThrow(
      "structured_opportunity_sources.source_slugs must be an array of strings",
    );
  });
});

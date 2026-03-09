import { createClient } from "@supabase/supabase-js";
import {
  collectManifestSourceSlugs,
  loadBestEffortEnv,
  loadPortalManifest,
  parseCliOptions,
  resolveManifestPath,
  resolveWorkspaceRoot,
  stableStringify,
  type PortalManifest,
  type InterestChannelRuleManifest,
} from "./manifest-utils";
import {
  getCrawlerSupportedSlugs,
  profileExists,
  validateSourceRowsInDb,
} from "./source-pack-utils";

type PortalRow = {
  id: string;
  slug: string;
  status: string;
  settings: Record<string, unknown> | null;
};

type SectionRow = {
  id: string;
  slug: string;
};

type ChannelRow = {
  id: string;
  slug: string;
};

type RuleRow = {
  id: string;
  channel_id: string;
  rule_type: string;
  rule_payload: Record<string, unknown>;
  priority: number;
  is_active: boolean;
};

function removeKeys<T extends Record<string, unknown>>(obj: T, keys: string[]): T {
  const next = { ...obj };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function buildPortalPayloadAttempts(basePayload: Record<string, unknown>): Record<string, unknown>[] {
  const attempts: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const candidates = [
    basePayload,
    removeKeys(basePayload, ["plan"]),
    removeKeys(basePayload, ["parent_portal_id"]),
    removeKeys(basePayload, ["owner_type"]),
    removeKeys(basePayload, ["plan", "parent_portal_id"]),
    removeKeys(basePayload, ["plan", "owner_type"]),
    removeKeys(basePayload, ["parent_portal_id", "owner_type"]),
    removeKeys(basePayload, ["plan", "parent_portal_id", "owner_type"]),
  ];

  for (const candidate of candidates) {
    const key = stableStringify(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      attempts.push(candidate);
    }
  }
  return attempts;
}

function shouldTryFallback(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message || "");
  return message.toLowerCase().includes("column");
}

async function validateSourcePack(
  workspaceRoot: string,
  manifest: PortalManifest,
  skipDb: boolean,
): Promise<void> {
  const sourceSlugs = collectManifestSourceSlugs(manifest);
  if (sourceSlugs.length === 0) return;

  const moduleSlugs = getCrawlerSupportedSlugs(workspaceRoot);
  const notCrawlable = sourceSlugs.filter((slug) => {
    const hasModule = moduleSlugs.has(slug);
    const hasProfile = profileExists(workspaceRoot, slug);
    return !hasModule && !hasProfile;
  });

  if (notCrawlable.length > 0) {
    throw new Error(`Source pack includes non-crawlable slugs: ${notCrawlable.join(", ")}`);
  }

  if (!skipDb) {
    const dbValidation = await validateSourceRowsInDb(sourceSlugs);
    if (dbValidation.missingInDb.length > 0) {
      throw new Error(`Source pack includes slugs missing from sources table: ${dbValidation.missingInDb.join(", ")}`);
    }
    if (dbValidation.inactiveInDb.length > 0) {
      throw new Error(`Source pack includes inactive sources: ${dbValidation.inactiveInDb.join(", ")}`);
    }
  }
}

async function resolveParentPortalId(
  supabase: ReturnType<typeof createClient>,
  parentSlug: string | null | undefined,
): Promise<string | null> {
  if (!parentSlug) return null;
  const { data, error } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", parentSlug)
    .maybeSingle();

  if (error) throw new Error(`Failed resolving parent portal '${parentSlug}': ${error.message}`);
  const row = data as { id: string } | null;
  if (!row?.id) throw new Error(`Parent portal not found for slug '${parentSlug}'`);
  return row.id;
}

async function resolveSourceIds(
  supabase: ReturnType<typeof createClient>,
  sourceSlugs: string[],
): Promise<Map<string, number>> {
  if (sourceSlugs.length === 0) return new Map();
  const { data, error } = await supabase
    .from("sources")
    .select("id,slug,is_active")
    .in("slug", sourceSlugs);

  if (error) throw new Error(`Failed resolving sources: ${error.message}`);

  const bySlug = new Map<string, number>();
  for (const row of (data || []) as Array<{ id: number; slug: string; is_active: boolean | null }>) {
    if (row.is_active !== true) {
      throw new Error(`Source '${row.slug}' is not active`);
    }
    bySlug.set(row.slug, row.id);
  }

  const missing = sourceSlugs.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) {
    throw new Error(`Could not resolve source IDs for slugs: ${missing.join(", ")}`);
  }

  return bySlug;
}

async function upsertPortal(
  supabase: ReturnType<typeof createClient>,
  manifest: PortalManifest,
  parentPortalId: string | null,
  status: "draft" | "active",
  dryRun: boolean,
): Promise<PortalRow> {
  const { data: existingData, error: existingError } = await supabase
    .from("portals")
    .select("id,slug,status,settings")
    .eq("slug", manifest.portal.slug)
    .maybeSingle();
  if (existingError) throw new Error(`Failed checking existing portal: ${existingError.message}`);

  const existing = (existingData as PortalRow | null) || null;
  const basePayload: Record<string, unknown> = {
    slug: manifest.portal.slug,
    name: manifest.portal.name,
    tagline: manifest.portal.tagline || null,
    portal_type: manifest.portal.portal_type,
    visibility: manifest.portal.visibility || "public",
    plan: manifest.portal.plan || "starter",
    parent_portal_id: parentPortalId,
    filters: manifest.portal.filters || {},
    branding: manifest.portal.branding || {},
    settings: manifest.portal.settings || {},
    owner_type: null,
    status,
  };

  if (dryRun) {
    if (existing) {
      console.log(`DRY RUN: would update portal '${manifest.portal.slug}' (${existing.id})`);
      return existing;
    }
    console.log(`DRY RUN: would create portal '${manifest.portal.slug}'`);
    return {
      id: "00000000-0000-0000-0000-000000000000",
      slug: manifest.portal.slug,
      status,
      settings: (manifest.portal.settings || {}) as Record<string, unknown>,
    };
  }

  const attempts = buildPortalPayloadAttempts(basePayload);
  if (existing) {
    for (const payload of attempts) {
      const { data, error } = await supabase
        .from("portals")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id,slug,status,settings")
        .maybeSingle();

      if (!error && data) return data as PortalRow;
      if (error && !shouldTryFallback(error)) {
        throw new Error(`Failed updating portal '${manifest.portal.slug}': ${error.message}`);
      }
    }
    throw new Error(`Failed updating portal '${manifest.portal.slug}' after fallback attempts`);
  }

  for (const payload of attempts) {
    const { data, error } = await supabase
      .from("portals")
      .insert(payload)
      .select("id,slug,status,settings")
      .maybeSingle();

    if (!error && data) return data as PortalRow;
    if (error && !shouldTryFallback(error)) {
      throw new Error(`Failed creating portal '${manifest.portal.slug}': ${error.message}`);
    }
  }
  throw new Error(`Failed creating portal '${manifest.portal.slug}' after fallback attempts`);
}

async function upsertSourceSubscriptions(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
  manifest: PortalManifest,
  sourceIdsBySlug: Map<string, number>,
  dryRun: boolean,
): Promise<void> {
  const sourceSlugs = manifest.source_subscriptions?.source_slugs || [];
  if (sourceSlugs.length === 0) return;

  const sourceIds = sourceSlugs.map((slug) => sourceIdsBySlug.get(slug)).filter((id): id is number => typeof id === "number");
  if (sourceIds.length === 0) return;

  const subscriptionScope = manifest.source_subscriptions?.subscription_scope || "all";
  const subscribedCategories = manifest.source_subscriptions?.subscribed_categories || null;
  const isActive = manifest.source_subscriptions?.is_active !== false;

  const { data: existingRows, error: existingError } = await supabase
    .from("source_subscriptions")
    .select("id,source_id,is_active,subscription_scope,subscribed_categories")
    .eq("subscriber_portal_id", portalId)
    .in("source_id", sourceIds);
  if (existingError) throw new Error(`Failed loading existing subscriptions: ${existingError.message}`);

  const existingBySourceId = new Map<number, {
    id: string;
    source_id: number;
    is_active: boolean | null;
    subscription_scope: string | null;
    subscribed_categories: string[] | null;
  }>();
  for (const row of (existingRows || []) as Array<{
    id: string;
    source_id: number;
    is_active: boolean | null;
    subscription_scope: string | null;
    subscribed_categories: string[] | null;
  }>) {
    existingBySourceId.set(row.source_id, row);
  }

  const toInsert = sourceIds.filter((id) => !existingBySourceId.has(id));
  const toUpdate = sourceIds.filter((id) => {
    const row = existingBySourceId.get(id);
    if (!row) return false;
    return row.is_active !== isActive
      || row.subscription_scope !== subscriptionScope
      || stableStringify(row.subscribed_categories || null) !== stableStringify(subscribedCategories);
  });

  if (dryRun) {
    console.log(`DRY RUN: source subscriptions insert=${toInsert.length}, update=${toUpdate.length}`);
    return;
  }

  if (toInsert.length > 0) {
    const payload = toInsert.map((sourceId) => ({
      subscriber_portal_id: portalId,
      source_id: sourceId,
      is_active: isActive,
      subscription_scope: subscriptionScope,
      subscribed_categories: subscriptionScope === "selected" ? subscribedCategories : null,
    }));
    const { error } = await supabase.from("source_subscriptions").insert(payload);
    if (error) throw new Error(`Failed inserting source subscriptions: ${error.message}`);
  }

  for (const sourceId of toUpdate) {
    const existing = existingBySourceId.get(sourceId);
    if (!existing) continue;
    const { error } = await supabase
      .from("source_subscriptions")
      .update({
        is_active: isActive,
        subscription_scope: subscriptionScope,
        subscribed_categories: subscriptionScope === "selected" ? subscribedCategories : null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed updating source subscription for source_id=${sourceId}: ${error.message}`);
  }
}

async function refreshPortalSourceAccess(
  supabase: ReturnType<typeof createClient>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log("DRY RUN: would call refresh_portal_source_access()");
    return;
  }
  const { error } = await supabase.rpc("refresh_portal_source_access");
  if (error) {
    throw new Error(`Failed refreshing portal_source_access: ${error.message}`);
  }
}

async function upsertSections(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
  manifest: PortalManifest,
  dryRun: boolean,
): Promise<void> {
  const sections = manifest.sections || [];
  if (sections.length === 0) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("portal_sections")
    .select("id,slug")
    .eq("portal_id", portalId);
  if (existingError) throw new Error(`Failed loading sections: ${existingError.message}`);

  const existingBySlug = new Map<string, SectionRow>();
  for (const row of (existingRows || []) as SectionRow[]) {
    existingBySlug.set(row.slug, row);
  }

  let inserts = 0;
  let updates = 0;
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const payload = {
      portal_id: portalId,
      slug: section.slug,
      title: section.title,
      description: section.description || null,
      section_type: section.section_type,
      auto_filter: section.auto_filter || {},
      is_visible: section.is_visible !== false,
      display_order: section.display_order ?? index + 1,
    };
    const existing = existingBySlug.get(section.slug);
    if (!existing) {
      inserts += 1;
      if (!dryRun) {
        const { error } = await supabase.from("portal_sections").insert(payload);
        if (error) throw new Error(`Failed inserting section '${section.slug}': ${error.message}`);
      }
      continue;
    }

    updates += 1;
    if (!dryRun) {
      const { error } = await supabase
        .from("portal_sections")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(`Failed updating section '${section.slug}': ${error.message}`);
    }
  }

  console.log(`${dryRun ? "DRY RUN: would upsert" : "Upserted"} sections insert=${inserts}, update=${updates}`);
}

function ruleKey(rule: InterestChannelRuleManifest | RuleRow): string {
  return `${rule.rule_type}:${stableStringify(rule.rule_payload || {})}`;
}

async function upsertChannelsAndRules(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
  manifest: PortalManifest,
  sourceIdsBySlug: Map<string, number>,
  dryRun: boolean,
): Promise<void> {
  const channels = manifest.interest_channels || [];
  if (channels.length === 0) return;

  const { data: existingRows, error: existingError } = await supabase
    .from("interest_channels")
    .select("id,slug")
    .eq("portal_id", portalId);
  if (existingError) throw new Error(`Failed loading channels: ${existingError.message}`);

  const existingBySlug = new Map<string, ChannelRow>();
  for (const row of (existingRows || []) as ChannelRow[]) {
    existingBySlug.set(row.slug, row);
  }

  const channelIdBySlug = new Map<string, string>();
  let channelInserts = 0;
  let channelUpdates = 0;

  for (let index = 0; index < channels.length; index += 1) {
    const channel = channels[index];
    const payload = {
      portal_id: portalId,
      slug: channel.slug,
      name: channel.name,
      channel_type: channel.channel_type,
      description: channel.description || null,
      metadata: channel.metadata || {},
      is_active: channel.is_active !== false,
      sort_order: channel.sort_order ?? (index + 1) * 10,
    };

    const existing = existingBySlug.get(channel.slug);
    if (!existing) {
      channelInserts += 1;
      if (dryRun) {
        channelIdBySlug.set(channel.slug, `dry-run-channel-${channel.slug}`);
        continue;
      }
      const { data, error } = await supabase
        .from("interest_channels")
        .insert(payload)
        .select("id,slug")
        .maybeSingle();
      if (error || !data) throw new Error(`Failed inserting channel '${channel.slug}': ${error?.message || "unknown error"}`);
      channelIdBySlug.set(channel.slug, data.id);
      continue;
    }

    channelUpdates += 1;
    channelIdBySlug.set(channel.slug, existing.id);
    if (!dryRun) {
      const { error } = await supabase
        .from("interest_channels")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(`Failed updating channel '${channel.slug}': ${error.message}`);
    }
  }

  let ruleInserts = 0;
  let ruleUpdates = 0;
  let ruleDeactivations = 0;
  if (!dryRun) {
    const channelIds = [...channelIdBySlug.values()];
    const { data: existingRulesData, error: existingRulesError } = await supabase
      .from("interest_channel_rules")
      .select("id,channel_id,rule_type,rule_payload,priority,is_active")
      .in("channel_id", channelIds);
    if (existingRulesError) throw new Error(`Failed loading channel rules: ${existingRulesError.message}`);

    const rulesByChannel = new Map<string, RuleRow[]>();
    for (const row of (existingRulesData || []) as RuleRow[]) {
      const arr = rulesByChannel.get(row.channel_id) || [];
      arr.push(row);
      rulesByChannel.set(row.channel_id, arr);
    }

    for (const channel of channels) {
      const channelId = channelIdBySlug.get(channel.slug);
      if (!channelId) continue;
      const existingRules = rulesByChannel.get(channelId) || [];
      const existingByKey = new Map<string, RuleRow>();
      for (const rule of existingRules) {
        existingByKey.set(ruleKey(rule), rule);
      }

      for (const desiredRule of channel.rules || []) {
        const normalizedPayload = {
          ...(desiredRule.rule_payload || {}),
        };
        if (desiredRule.rule_type === "source") {
          const sourceSlug = normalizedPayload.source_slug;
          if (typeof sourceSlug === "string" && sourceIdsBySlug.has(sourceSlug)) {
            normalizedPayload.source_id = sourceIdsBySlug.get(sourceSlug);
          }

          const sourceSlugs = normalizedPayload.source_slugs;
          if (Array.isArray(sourceSlugs)) {
            normalizedPayload.source_ids = sourceSlugs
              .map((slug) => sourceIdsBySlug.get(String(slug)))
              .filter((id): id is number => typeof id === "number");
          }
        }

        const rulePayloadForWrite = normalizedPayload;
        const desiredKey = `${desiredRule.rule_type}:${stableStringify(rulePayloadForWrite)}`;
        const existingRule = existingByKey.get(desiredKey);
        const desiredPriority = desiredRule.priority ?? 100;
        const desiredIsActive = desiredRule.is_active !== false;

        if (!existingRule) {
          ruleInserts += 1;
          const { error } = await supabase
            .from("interest_channel_rules")
            .insert({
              channel_id: channelId,
              rule_type: desiredRule.rule_type,
              rule_payload: rulePayloadForWrite,
              priority: desiredPriority,
              is_active: desiredIsActive,
            });
          if (error) throw new Error(`Failed inserting rule for channel '${channel.slug}': ${error.message}`);
          continue;
        }

        if (existingRule.priority !== desiredPriority || existingRule.is_active !== desiredIsActive) {
          ruleUpdates += 1;
          const { error } = await supabase
            .from("interest_channel_rules")
            .update({
              priority: desiredPriority,
              is_active: desiredIsActive,
            })
            .eq("id", existingRule.id);
          if (error) throw new Error(`Failed updating rule for channel '${channel.slug}': ${error.message}`);
        }
      }

      const desiredRuleKeys = new Set(
        (channel.rules || []).map((rule) => {
          const normalizedPayload = { ...(rule.rule_payload || {}) };
          if (rule.rule_type === "source") {
            const sourceSlug = normalizedPayload.source_slug;
            if (typeof sourceSlug === "string" && sourceIdsBySlug.has(sourceSlug)) {
              normalizedPayload.source_id = sourceIdsBySlug.get(sourceSlug);
            }
            const sourceSlugs = normalizedPayload.source_slugs;
            if (Array.isArray(sourceSlugs)) {
              normalizedPayload.source_ids = sourceSlugs
                .map((slug) => sourceIdsBySlug.get(String(slug)))
                .filter((id): id is number => typeof id === "number");
            }
          }
          return `${rule.rule_type}:${stableStringify(normalizedPayload)}`;
        }),
      );

      for (const existingRule of existingRules) {
        if (desiredRuleKeys.has(ruleKey(existingRule))) continue;
        if (!existingRule.is_active) continue;
        ruleDeactivations += 1;
        const { error } = await supabase
          .from("interest_channel_rules")
          .update({ is_active: false })
          .eq("id", existingRule.id);
        if (error) {
          throw new Error(`Failed deactivating stale rule for channel '${channel.slug}': ${error.message}`);
        }
      }
    }
  } else {
    for (const channel of channels) {
      ruleInserts += (channel.rules || []).length;
    }
  }

  console.log(
    `${dryRun ? "DRY RUN: would upsert" : "Upserted"} channels insert=${channelInserts}, update=${channelUpdates}; rules insert=${ruleInserts}, update=${ruleUpdates}, deactivate=${ruleDeactivations}`,
  );
}

async function applyRefreshSchedule(
  supabase: ReturnType<typeof createClient>,
  portal: PortalRow,
  manifest: PortalManifest,
  dryRun: boolean,
): Promise<void> {
  if (!manifest.refresh_schedule) return;
  const cadence = manifest.refresh_schedule.cadence;
  const refreshSettings = cadence === "daily"
    ? { cadence: "daily", hour_utc: manifest.refresh_schedule.hour_utc }
    : { cadence };

  const nextSettings = {
    ...(portal.settings || {}),
    interest_channel_matches_refresh: refreshSettings,
  };

  if (dryRun) {
    console.log(`DRY RUN: would set refresh cadence to ${cadence}`);
    return;
  }

  const { error } = await supabase
    .from("portals")
    .update({
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portal.id);
  if (error) throw new Error(`Failed updating portal refresh schedule: ${error.message}`);
}

async function verifyProvisioning(
  supabase: ReturnType<typeof createClient>,
  portalId: string,
): Promise<void> {
  const channelIdsRes = await supabase
    .from("interest_channels")
    .select("id")
    .eq("portal_id", portalId);
  if (channelIdsRes.error) {
    throw new Error(`Verification failed (channel ids): ${channelIdsRes.error.message}`);
  }
  const channelIds = (channelIdsRes.data || []).map((row) => row.id);

  const [
    portalRes,
    subsRes,
    channelsRes,
    matchesRes,
  ] = await Promise.all([
    supabase.from("portals").select("id,slug,status").eq("id", portalId).maybeSingle(),
    supabase.from("source_subscriptions").select("id", { count: "exact", head: true }).eq("subscriber_portal_id", portalId).eq("is_active", true),
    supabase.from("interest_channels").select("id", { count: "exact", head: true }).eq("portal_id", portalId).eq("is_active", true),
    supabase.from("event_channel_matches").select("event_id", { count: "exact", head: true }).eq("portal_id", portalId),
  ]);

  let rulesCount = 0;
  if (channelIds.length > 0) {
    const rulesRes = await supabase
      .from("interest_channel_rules")
      .select("id", { count: "exact", head: true })
      .in("channel_id", channelIds);
    if (rulesRes.error) throw new Error(`Verification failed (rules): ${rulesRes.error.message}`);
    rulesCount = rulesRes.count || 0;
  }

  if (portalRes.error) throw new Error(`Verification failed (portal): ${portalRes.error.message}`);
  if (!portalRes.data) throw new Error("Verification failed: portal not found");
  if (subsRes.error) throw new Error(`Verification failed (subscriptions): ${subsRes.error.message}`);
  if (channelsRes.error) throw new Error(`Verification failed (channels): ${channelsRes.error.message}`);
  if (matchesRes.error) throw new Error(`Verification failed (matches): ${matchesRes.error.message}`);

  console.log("\nVerification:");
  console.log(`  Portal: ${portalRes.data.slug} (${portalRes.data.id})`);
  console.log(`  Status: ${portalRes.data.status}`);
  console.log(`  Active source subscriptions: ${subsRes.count || 0}`);
  console.log(`  Active channels: ${channelsRes.count || 0}`);
  console.log(`  Channel rules: ${rulesCount}`);
  console.log(`  Existing event-channel matches: ${matchesRes.count || 0}`);
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const workspaceRoot = resolveWorkspaceRoot();
  loadBestEffortEnv(workspaceRoot);

  const manifestPath = resolveManifestPath(options.manifestPath);
  const manifest = loadPortalManifest(manifestPath);
  const sourceSlugs = collectManifestSourceSlugs(manifest);

  await validateSourcePack(workspaceRoot, manifest, options.skipDb);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const status = options.activate ? "active" : "draft";
  console.log(`\nProvisioning manifest: ${manifestPath}`);
  console.log(`Portal: ${manifest.portal.slug}`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}${options.activate ? " + activate" : " (draft)"}`);
  console.log(`Source slugs in pack: ${sourceSlugs.length}`);

  const parentPortalId = await resolveParentPortalId(
    supabase,
    manifest.portal.parent_portal_slug || null,
  );
  const sourceIdsBySlug = await resolveSourceIds(supabase, sourceSlugs);
  const portal = await upsertPortal(supabase, manifest, parentPortalId, status, options.dryRun);

  await upsertSourceSubscriptions(supabase, portal.id, manifest, sourceIdsBySlug, options.dryRun);
  await refreshPortalSourceAccess(supabase, options.dryRun);
  await upsertSections(supabase, portal.id, manifest, options.dryRun);
  await upsertChannelsAndRules(supabase, portal.id, manifest, sourceIdsBySlug, options.dryRun);
  await applyRefreshSchedule(supabase, portal, manifest, options.dryRun);

  if (options.dryRun) {
    console.log("\nDry-run complete. No writes performed.");
    return;
  }

  await verifyProvisioning(supabase, portal.id);
  console.log("\nProvisioning complete.");
}

main().catch((error) => {
  console.error("\nProvisioning failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

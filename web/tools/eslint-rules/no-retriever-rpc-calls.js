/**
 * Retrievers MUST NOT issue their own database calls. They read from the
 * UnifiedRetrievalResult passed to their factory. This keeps the per-search
 * connection count at 1 instead of 9 (see spec §2.5 — the reconciliation).
 *
 * Bans, under lib/search/retrievers/**:
 *   - Any `.rpc(` call expression
 *   - Any import of `createServiceClient` or `createClient` from supabase helpers
 *   - Any import from `@/lib/supabase/*`
 *
 * This rule does NOT apply to `lib/search/unified-retrieval.ts` (which is the
 * ONE place where the orchestrator calls .rpc("search_unified")). That file is
 * deliberately outside `lib/search/retrievers/`.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Retrievers cannot issue DB calls — read from UnifiedRetrievalResult instead",
      category: "architecture",
    },
    schema: [],
    messages: {
      noRpcCall:
        "Retrievers cannot call .rpc() directly. Read from UnifiedRetrievalResult passed to the factory. See spec §2.5.",
      noSupabaseImport:
        "Retrievers cannot import Supabase clients. The orchestrator calls runUnifiedRetrieval; retrievers interpret its result. See spec §2.5.",
    },
  },
  create(context) {
    const filename = context.getFilename
      ? context.getFilename()
      : context.filename;
    // Only apply the rule under lib/search/retrievers/
    if (!filename.includes("/lib/search/retrievers/")) return {};

    return {
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "rpc"
        ) {
          context.report({ node, messageId: "noRpcCall" });
        }
      },
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        // Ban any import from Supabase helpers or the local supabase module
        if (
          source.includes("@/lib/supabase") ||
          source.includes("/supabase/service") ||
          source.includes("/supabase/server") ||
          source.includes("/supabase/client")
        ) {
          context.report({ node, messageId: "noSupabaseImport" });
        }
      },
    };
  },
};

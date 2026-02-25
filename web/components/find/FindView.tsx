/**
 * FindView — Thin shim that re-exports FindShell.
 *
 * After the Phase 2 decomposition, FindShell is the orchestration layer
 * and EventsFinder / SpotsFinder handle type-specific rendering.
 * This file exists so existing imports from "find/FindView" keep working.
 */
export { default } from "./FindShell";

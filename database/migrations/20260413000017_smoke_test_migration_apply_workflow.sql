-- Migration: Smoke Test Migration Apply Workflow
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
--
-- Validates the .github/workflows/migration-apply.yml auto-apply pipeline
-- end-to-end. No schema impact — just records this version into
-- supabase_migrations.schema_migrations on apply.
SELECT 1 AS smoke;

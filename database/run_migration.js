#!/usr/bin/env node
/**
 * Script to run SQL migrations against Supabase
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rtppvljfrkjtoxmaizea.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

async function runSQL(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SQL execution failed: ${error}`);
  }

  return response.json();
}

async function runMigration(filePath) {
  console.log(`\nRunning migration: ${path.basename(filePath)}`);
  console.log('='.repeat(60));

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    await runSQL(sql);
    console.log('✓ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    return false;
  }
}

async function main() {
  const migrations = process.argv.slice(2);

  if (migrations.length === 0) {
    console.log('Usage: node run_migration.js <migration_file> [migration_file2] ...');
    console.log('Example: node run_migration.js migrations/086_producer_to_organization_rename.sql');
    process.exit(1);
  }

  console.log('Supabase Migration Runner');
  console.log('='.repeat(60));
  console.log(`Target: ${SUPABASE_URL}`);

  let success = true;
  for (const migration of migrations) {
    const filePath = path.resolve(migration);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      success = false;
      continue;
    }

    const result = await runMigration(filePath);
    if (!result) success = false;
  }

  process.exit(success ? 0 : 1);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Run SQL migrations against Supabase using the management API
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_PROJECT_REF = 'rtppvljfrkjtoxmaizea';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  // Try to get from supabase CLI config
  const configPath = path.join(process.env.HOME, '.supabase', 'access-token');
  if (fs.existsSync(configPath)) {
    process.env.SUPABASE_ACCESS_TOKEN = fs.readFileSync(configPath, 'utf8').trim();
  } else {
    console.error('Error: SUPABASE_ACCESS_TOKEN not found');
    console.error('Run: supabase login');
    process.exit(1);
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN;

async function runSQL(sql) {
  // Use the Supabase Management API to run SQL
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SQL execution failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function runMigration(filePath) {
  console.log(`\nRunning migration: ${path.basename(filePath)}`);
  console.log('='.repeat(60));

  const sql = fs.readFileSync(filePath, 'utf8');

  // Split into statements (rough split, handles most cases)
  const statements = sql
    .split(/;\s*(?=(?:--|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|DO|COMMENT))/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    console.log(`\n[${i + 1}/${statements.length}] ${preview}...`);

    try {
      await runSQL(stmt + ';');
      console.log('  ✓ Success');
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
      // Continue with other statements
    }
  }

  return true;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Default: run our new migrations
    args.push(
      path.join(__dirname, 'migrations', '086_producer_to_organization_rename.sql'),
      path.join(__dirname, 'migrations', '087_venue_type_consolidation.sql')
    );
  }

  console.log('Supabase Migration Runner');
  console.log('='.repeat(60));
  console.log(`Project: ${SUPABASE_PROJECT_REF}`);

  for (const migration of args) {
    const filePath = path.resolve(migration);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }
    await runMigration(filePath);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration complete!');
}

main().catch(console.error);

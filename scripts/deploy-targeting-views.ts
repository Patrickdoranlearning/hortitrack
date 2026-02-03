#!/usr/bin/env npx tsx
/**
 * Deploy smart targeting views to Supabase
 * Run with: npx tsx scripts/deploy-targeting-views.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runSQL(sql: string, description: string) {
  console.log(`Running: ${description}...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // Try direct query approach for simple statements
    console.log(`  RPC failed, trying alternative...`);
    return { error };
  }
  console.log(`  ✓ ${description}`);
  return { data };
}

async function main() {
  console.log('Deploying smart targeting views to Supabase...\n');
  console.log('URL:', supabaseUrl);

  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251231200000_smart_targeting.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into individual statements (rough split)
  const statements = sql
    .split(/;[\s]*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  // Try executing via the postgrest endpoint (won't work for DDL)
  // Instead, we'll need to use the Management API or SQL Editor

  console.log('\n⚠️  Direct SQL execution requires the Supabase Dashboard SQL Editor.');
  console.log('\nPlease run the following SQL in your Supabase Dashboard:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to SQL Editor');
  console.log('4. Copy and run the SQL from:');
  console.log(`   ${migrationPath}`);
  console.log('\nOr run this command if you have psql installed:');
  console.log(`   psql "postgresql://postgres:[YOUR-PASSWORD]@db.${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}.supabase.co:5432/postgres" -f "${migrationPath}"`);
}

main().catch(console.error);

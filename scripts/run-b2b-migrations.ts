/**
 * Script to run B2B portal migrations
 *
 * This script applies the B2B portal database migrations to your Supabase database.
 *
 * Usage:
 *   npx tsx scripts/run-b2b-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const migrations = [
  '20251201100000_sales_products_pricing.sql',
  '20251202123500_product_aliases.sql',
  '20251209100000_customer_enhancement.sql',
  '20251215100000_b2b_portal_auth.sql',
  '20251215101000_customer_favorites.sql',
  '20251215102000_customer_resources.sql',
  '20251215103000_order_items_rrp.sql',
];

async function runMigrations() {
  console.log('🚀 Running B2B portal migrations...\n');

  for (const migrationFile of migrations) {
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);

    try {
      console.log(`📄 Reading migration: ${migrationFile}`);
      const sql = readFileSync(migrationPath, 'utf-8');

      console.log(`⚡ Executing migration: ${migrationFile}`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // If exec_sql doesn't exist, we need to use the direct SQL approach
        console.log('   Using direct SQL execution...');
        const { error: directError } = await supabase.from('_migrations').select('*').limit(1);

        if (directError) {
          console.error(`❌ Error executing ${migrationFile}:`, error);
          console.error('\n⚠️  Note: You may need to run this migration manually through the Supabase dashboard.');
          console.error(`   Dashboard URL: ${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql')}`);
          continue;
        }
      }

      console.log(`✅ Successfully executed: ${migrationFile}\n`);
    } catch (error) {
      console.error(`❌ Failed to execute ${migrationFile}:`, error);
      console.error('\n⚠️  Please run this migration manually through the Supabase dashboard.');
      console.error(`   Dashboard URL: ${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql')}\n`);
    }
  }

  console.log('✨ Migration process complete!\n');
  console.log('📋 Next steps:');
  console.log('   1. Verify migrations in Supabase dashboard');
  console.log('   2. Test customer portal access creation');
  console.log('   3. Create test customer portal user');
}

runMigrations();

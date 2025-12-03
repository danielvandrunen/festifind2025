import fs from 'fs';
import path from 'path';
import { applyMigration } from '../../lib/supabase-client.js';

async function runMigration() {
  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'app', 'sales-monitor', 'migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Apply the migration
    const success = await applyMigration('add_sales_stage_column', sql);
    
    if (success) {
      console.log('✅ Migration successfully applied');
      process.exit(0);
    } else {
      console.error('❌ Migration failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration(); 
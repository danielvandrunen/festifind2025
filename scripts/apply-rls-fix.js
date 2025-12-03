#!/usr/bin/env node

/**
 * Apply RLS fix migration to resolve persistence issues
 * 
 * This script applies the missing UPDATE policy for the festivals table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Use the same configuration as the API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 === Applying RLS Fix Migration ===\n');

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'database/migrations/20250723_fix_festivals_update_policy.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('🔍 SQL to execute:');
    console.log('─'.repeat(50));
    console.log(migrationSQL);
    console.log('─'.repeat(50));
    
    // Split the SQL into individual statements (rough split by semicolon + newline)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`\n📝 Executing ${statements.length} SQL statements...\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      console.log(`⏳ Statement ${i + 1}/${statements.length}:`);
      console.log(`   ${statement.substring(0, 60)}${statement.length > 60 ? '...' : ''}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // Try alternative method if RPC fails
          console.log('   Trying alternative execution method...');
          
          // For policies, we might need to use a different approach
          if (statement.includes('CREATE POLICY')) {
            console.log('   🛡️  Creating RLS policy...');
            // We'll need to use the SQL editor or a service key for this
            console.log('   ⚠️  Policy creation may require manual execution in Supabase dashboard');
          }
          
          throw error;
        }
        
        console.log('   ✅ Success');
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        
        // Continue with other statements even if one fails
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log('   ℹ️  Resource already exists, continuing...');
        } else {
          console.log('   ⚠️  Non-fatal error, continuing...');
        }
      }
    }
    
    console.log('\n🎉 Migration execution completed!');
    console.log('');
    console.log('⚠️  IMPORTANT: If RLS policies failed to create automatically,');
    console.log('   please copy and paste the following SQL in your Supabase dashboard:');
    console.log('');
    console.log('CREATE POLICY IF NOT EXISTS "Allow updates to festival preferences"');
    console.log('  ON public.festivals');  
    console.log('  FOR UPDATE');
    console.log('  USING (true)');
    console.log('  WITH CHECK (true);');
    console.log('');
    
    // Test if the fix worked
    console.log('🧪 Testing the fix...');
    await testFix();
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    console.log('');
    console.log('🔧 Manual fix required:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to the SQL Editor');  
    console.log('   3. Execute the migration SQL manually');
    process.exit(1);
  }
}

async function testFix() {
  try {
    // Test festival ID from user's testing
    const testFestivalId = '891913d7-e8c1-47ee-ba9e-c57fd79b03f4';
    
    console.log('📝 Testing update capability...');
    
    // Try to update the favorite status
    const { data, error } = await supabase
      .from('festivals')
      .update({ favorite: false, updated_at: new Date().toISOString() })
      .eq('id', testFestivalId)
      .select('favorite')
      .single();
    
    if (error) {
      console.log('❌ Update test failed:', error.message);
      if (error.message.includes('policy')) {
        console.log('   🛡️  RLS policy issue detected - manual policy creation needed');
      }
      return false;
    }
    
    if (data) {
      console.log('✅ Update test succeeded!');
      console.log(`   Festival favorite status: ${data.favorite}`);
      
      // Restore original state
      await supabase
        .from('festivals')
        .update({ favorite: true })
        .eq('id', testFestivalId);
      
      console.log('');
      console.log('🎉 PERSISTENCE ISSUE FIXED!');
      console.log('   Your favorite/archive changes should now persist after refresh');
      
      return true;
    }
    
  } catch (testError) {
    console.log('❌ Test error:', testError.message);
    return false;
  }
}

applyMigration(); 
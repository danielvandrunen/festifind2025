#!/usr/bin/env node

/**
 * Supabase Update Diagnostic Tool
 * 
 * Test direct database updates to identify the exact issue with favorite/archive persistence
 */

import { createClient } from '@supabase/supabase-js';

// Use the same configuration as the API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';

// Create client with same config as API routes
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

console.log('🔧 === Supabase Update Diagnostic Tool ===\n');

// Test festival ID from user's test
const testFestivalId = '891913d7-e8c1-47ee-ba9e-c57fd79b03f4';
const testFestivalName = 'IJsbeelden Festival';

async function runDiagnostics() {
  console.log(`🎯 Testing updates for: ${testFestivalName} (${testFestivalId})\n`);

  try {
    // Step 1: Check if festival exists
    console.log('📝 Step 1: Checking if festival exists...');
    const { data: existingFestival, error: fetchError } = await supabase
      .from('festivals')
      .select('*')
      .eq('id', testFestivalId)
      .single();

    if (fetchError) {
      console.log('❌ Error fetching festival:', fetchError);
      return;
    }

    if (!existingFestival) {
      console.log('❌ Festival not found');
      return;
    }

    console.log('✅ Festival found:', {
      name: existingFestival.name,
      favorite: existingFestival.favorite,
      archived: existingFestival.archived,
      sales_stage: existingFestival.sales_stage
    });

    // Step 2: Test basic update without returning data
    console.log('\n📝 Step 2: Testing basic update (no select)...');
    const { error: updateError1 } = await supabase
      .from('festivals')
      .update({ favorite: false })
      .eq('id', testFestivalId);

    if (updateError1) {
      console.log('❌ Basic update failed:', updateError1);
      console.log('   Message:', updateError1.message);
      console.log('   Code:', updateError1.code);
      console.log('   Details:', updateError1.details);
    } else {
      console.log('✅ Basic update succeeded (no error returned)');
    }

    // Step 3: Test update with select
    console.log('\n📝 Step 3: Testing update with select()...');
    const { data: updateData, error: updateError2 } = await supabase
      .from('festivals')
      .update({ favorite: false })
      .eq('id', testFestivalId)
      .select();

    if (updateError2) {
      console.log('❌ Update with select failed:', updateError2);
      console.log('   Message:', updateError2.message);
      console.log('   Code:', updateError2.code);
      console.log('   Details:', updateError2.details);
    } else {
      console.log('✅ Update with select succeeded');
      console.log('📊 Updated data:', updateData);
    }

    // Step 4: Test update with select and single
    console.log('\n📝 Step 4: Testing update with select().single()...');
    const { data: singleData, error: singleError } = await supabase
      .from('festivals')
      .update({ favorite: true })
      .eq('id', testFestivalId)
      .select()
      .single();

    if (singleError) {
      console.log('❌ Update with single failed:', singleError);
      console.log('   Message:', singleError.message);
      console.log('   Code:', singleError.code);
      console.log('   Details:', singleError.details);
    } else {
      console.log('✅ Update with single succeeded');
      console.log('📊 Single data:', singleData);
    }

    // Step 5: Verify final state
    console.log('\n📝 Step 5: Verifying final state...');
    const { data: finalState, error: finalError } = await supabase
      .from('festivals')
      .select('favorite, archived, sales_stage')
      .eq('id', testFestivalId)
      .single();

    if (finalError) {
      console.log('❌ Error fetching final state:', finalError);
    } else {
      console.log('✅ Final state:', finalState);
    }

    // Step 6: Check RLS policies
    console.log('\n📝 Step 6: Checking authentication state...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ Auth error:', authError);
    } else if (user) {
      console.log('✅ User authenticated:', user.email);
    } else {
      console.log('⚠️  No authenticated user (using anonymous key)');
    }

    // Step 7: Test with different column
    console.log('\n📝 Step 7: Testing update of archived field...');
    const { data: archivedUpdate, error: archivedError } = await supabase
      .from('festivals')
      .update({ archived: !existingFestival.archived })
      .eq('id', testFestivalId)
      .select('archived')
      .single();

    if (archivedError) {
      console.log('❌ Archived update failed:', archivedError);
    } else {
      console.log('✅ Archived update succeeded:', archivedUpdate);
    }

  } catch (error) {
    console.log('💥 Unexpected error:', error);
  }
}

runDiagnostics(); 
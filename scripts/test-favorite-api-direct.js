#!/usr/bin/env node

/**
 * Test the favorite API route directly to debug the issue
 */

console.log('🧪 === Testing Favorite API Route Directly ===\n');

const testFestivalId = '891913d7-e8c1-47ee-ba9e-c57fd79b03f4';
const testFestivalName = 'IJsbeelden Festival';

async function testFavoriteApi() {
  try {
    console.log(`🎯 Testing favorite API for: ${testFestivalName}`);
    
    // Step 1: Get current state
    console.log('\n📝 Step 1: Getting current state from main API...');
    const currentResponse = await fetch(`https://festifind2025.vercel.app/api/festivals?search=${encodeURIComponent(testFestivalName)}`);
    const currentFestivals = await currentResponse.json();
    const currentFestival = currentFestivals.find(f => f.id === testFestivalId);
    
    if (!currentFestival) {
      console.log('❌ Festival not found in main API');
      return;
    }
    
    console.log('✅ Current state from main API:', {
      favorite: currentFestival.favorite,
      archived: currentFestival.archived,
      sales_stage: currentFestival.sales_stage
    });
    
    // Step 2: Try to update via favorite API 
    const newFavoriteState = !currentFestival.favorite;
    console.log(`\n🔄 Step 2: Setting favorite to ${newFavoriteState} via favorite API...`);
    
    const favoriteResponse = await fetch(`https://festifind2025.vercel.app/api/festivals/${testFestivalId}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: newFavoriteState })
    });
    
    const favoriteResult = await favoriteResponse.json();
    console.log('📤 Favorite API Response:', favoriteResult);
    
    if (favoriteResult.data) {
      console.log('📊 Data returned by API:', {
        favorite: favoriteResult.data.favorite,
        updated_at: favoriteResult.data.updated_at
      });
    }
    
    // Step 3: Check if it was actually saved
    console.log('\n⏳ Step 3: Waiting 3 seconds, then checking main API again...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const verifyResponse = await fetch(`https://festifind2025.vercel.app/api/festivals?search=${encodeURIComponent(testFestivalName)}`);
    const verifyFestivals = await verifyResponse.json();
    const verifyFestival = verifyFestivals.find(f => f.id === testFestivalId);
    
    console.log('📥 State after favorite API call:', {
      favorite: verifyFestival?.favorite,
      updated_at: verifyFestival?.updated_at
    });
    
    // Step 4: Compare results
    console.log('\n🔍 Step 4: Analysis...');
    if (verifyFestival?.favorite === newFavoriteState) {
      console.log('✅ SUCCESS! Favorite API is working correctly!');
      console.log('🎉 The persistence issue may already be fixed!');
    } else {
      console.log('❌ ISSUE CONFIRMED: Favorite API claims success but doesn\'t update database');
      console.log('🔧 This confirms the persistence bug exists');
    }
    
    // Step 5: Test if we can update directly via Supabase
    console.log('\n📝 Step 5: Testing direct Supabase update for comparison...');
    
    try {
      // Import Supabase client (same config as favorite API route)
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';
      
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      
      console.log('🔗 Using same Supabase config as favorite API route...');
      
      const { data: directUpdateData, error: directUpdateError } = await supabase
        .from('festivals')
        .update({ favorite: currentFestival.favorite }) // Restore original state
        .eq('id', testFestivalId)
        .select('favorite, updated_at')
        .single();
      
      if (directUpdateError) {
        console.log('❌ Direct Supabase update failed:', directUpdateError.message);
        if (directUpdateError.message.includes('policy')) {
          console.log('🛡️  RLS policy is blocking the update!');
        }
      } else {
        console.log('✅ Direct Supabase update succeeded:', directUpdateData);
      }
      
    } catch (importError) {
      console.log('⚠️  Could not test direct Supabase update:', importError.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testFavoriteApi(); 
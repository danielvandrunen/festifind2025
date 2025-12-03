#!/usr/bin/env node

/**
 * Debug Deployed API Calls
 * 
 * This script makes API calls to both local and deployed versions
 * and compares the results to identify the difference
 */

const testFestivalId = '891913d7-e8c1-47ee-ba9e-c57fd79b03f4';
const testFestivalName = 'IJsbeelden Festival';

console.log('🔍 === Debugging Deployed API vs Local API ===\n');

async function testBothEnvironments() {
  const environments = {
    'Local Docker': 'http://localhost:3005',
    'Deployed Vercel': 'https://festifind2025.vercel.app'
  };

  for (const [envName, baseUrl] of Object.entries(environments)) {
    console.log(`\n🌍 === Testing ${envName} (${baseUrl}) ===`);
    
    try {
      // Step 1: Get current state
      console.log('📝 Step 1: Getting current state...');
      const currentResponse = await fetch(`${baseUrl}/api/festivals?search=${encodeURIComponent(testFestivalName)}`);
      
      if (!currentResponse.ok) {
        console.log(`❌ Current state request failed: ${currentResponse.status} ${currentResponse.statusText}`);
        continue;
      }
      
      const currentFestivals = await currentResponse.json();
      const currentFestival = currentFestivals.find(f => f.id === testFestivalId);
      
      if (!currentFestival) {
        console.log('❌ Test festival not found');
        continue;
      }
      
      console.log(`✅ Current state: favorite=${currentFestival.favorite}`);
      
      // Step 2: Toggle favorite status
      const newFavoriteStatus = !currentFestival.favorite;
      console.log(`🔄 Step 2: Setting favorite to ${newFavoriteStatus}...`);
      
      const favoriteResponse = await fetch(`${baseUrl}/api/festivals/${testFestivalId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ favorite: newFavoriteStatus })
      });
      
      if (!favoriteResponse.ok) {
        console.log(`❌ Favorite API request failed: ${favoriteResponse.status} ${favoriteResponse.statusText}`);
        const errorText = await favoriteResponse.text();
        console.log(`❌ Error details: ${errorText}`);
        continue;
      }
      
      const favoriteResult = await favoriteResponse.json();
      console.log(`📤 API Response:`, favoriteResult);
      
      // Step 3: Check if change was persisted
      console.log('⏳ Step 3: Waiting 3 seconds, then checking persistence...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const verifyResponse = await fetch(`${baseUrl}/api/festivals?search=${encodeURIComponent(testFestivalName)}`);
      if (!verifyResponse.ok) {
        console.log(`❌ Verify request failed: ${verifyResponse.status} ${verifyResponse.statusText}`);
        continue;
      }
      
      const verifyFestivals = await verifyResponse.json();
      const verifyFestival = verifyFestivals.find(f => f.id === testFestivalId);
      
      if (!verifyFestival) {
        console.log('❌ Festival not found during verification');
        continue;
      }
      
      console.log(`📥 Database state after API call: favorite=${verifyFestival.favorite}`);
      
      // Step 4: Check if the change persisted
      if (verifyFestival.favorite === newFavoriteStatus) {
        console.log(`✅ ${envName}: Change persisted successfully!`);
      } else {
        console.log(`❌ ${envName}: Change did NOT persist!`);
        console.log(`   Expected: ${newFavoriteStatus}, Got: ${verifyFestival.favorite}`);
      }
      
    } catch (error) {
      console.log(`❌ ${envName} test failed:`, error.message);
    }
  }
}

async function main() {
  await testBothEnvironments();
  console.log('\n🏁 === Test Complete ===');
}

main().catch(console.error); 
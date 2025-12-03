#!/usr/bin/env node

/**
 * Test the deployed frontend API calls to identify issues
 * This simulates exactly what the frontend does
 */

console.log('🌐 === Testing Deployed Frontend API Calls ===\n');

const BASE_URL = 'https://festifind2025.vercel.app';
const testFestivalId = '891913d7-e8c1-47ee-ba9e-c57fd79b03f4';

async function testDeployedFrontend() {
  try {
    console.log('🧪 Testing exactly what the frontend does...\n');
    
    // Step 1: Test the exact API call the frontend makes
    console.log('📝 Step 1: Making favorite API call (same as frontend)...');
    
    const response = await fetch(`${BASE_URL}/api/festivals/${testFestivalId}/favorite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ favorite: false }),
    });
    
    console.log('📤 Response status:', response.status);
    console.log('📤 Response ok:', response.ok);
    console.log('📤 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.log('❌ API call failed!');
      const errorText = await response.text();
      console.log('❌ Error text:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('❌ Error JSON:', errorJson);
      } catch (e) {
        console.log('❌ Could not parse error as JSON');
      }
      
      return;
    }
    
    // Step 2: Parse response
    console.log('\n📝 Step 2: Parsing response...');
    const result = await response.json();
    console.log('✅ API Response:', result);
    
    // Step 3: Test if it actually saved
    console.log('\n📝 Step 3: Checking if it actually saved (after 2 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const checkResponse = await fetch(`${BASE_URL}/api/festivals?search=IJsbeelden%20Festival`);
    const festivals = await checkResponse.json();
    const festival = festivals.find(f => f.id === testFestivalId);
    
    console.log('🔍 Festival in database:', {
      name: festival?.name,
      favorite: festival?.favorite,
      updated_at: festival?.updated_at
    });
    
    // Step 4: Compare and analyze
    console.log('\n📝 Step 4: Analysis...');
    if (result.success && result.data && result.data.favorite === false) {
      if (festival?.favorite === false) {
        console.log('✅ SUCCESS: API worked and database was updated');
      } else {
        console.log('❌ ISSUE: API claimed success but database shows different value');
        console.log('🔧 This suggests a race condition or caching issue');
      }
    } else {
      console.log('❌ ISSUE: API response doesn\'t match expected format');
    }
    
    // Step 5: Test potential network issues
    console.log('\n📝 Step 5: Testing potential network issues...');
    
    // Test with longer timeout
    console.log('⏰ Testing with longer timeout...');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out after 10 seconds')), 10000)
    );
    
    const apiPromise = fetch(`${BASE_URL}/api/festivals/${testFestivalId}/favorite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ favorite: true }), // Toggle back
    });
    
    try {
      const timeoutResponse = await Promise.race([apiPromise, timeoutPromise]);
      console.log('✅ Request completed within timeout');
      console.log('📊 Status:', timeoutResponse.status);
      
      const timeoutResult = await timeoutResponse.json();
      console.log('📊 Response:', timeoutResult);
      
    } catch (error) {
      if (error.message.includes('timed out')) {
        console.log('⏰ API request timed out - this could be the issue on frontend!');
      } else {
        console.log('❌ Network error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    
    if (error.message.includes('fetch')) {
      console.log('🌐 This looks like a network connectivity issue');
    } else if (error.message.includes('timeout')) {
      console.log('⏰ This looks like a timeout issue');
    }
  }
}

testDeployedFrontend(); 
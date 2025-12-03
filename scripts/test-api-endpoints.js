#!/usr/bin/env node

/**
 * API Endpoint Testing Tool
 * Tests favorite and archive API endpoints to verify they're working
 */

const BASE_URL = 'https://festifind2025.vercel.app';

// Test festival ID - we'll get this from the database first
let testFestivalId = null;

console.log('=== FestiFind API Endpoint Testing Tool ===\n');

// Function to test an API endpoint
async function testEndpoint(endpoint, method, data, description) {
  console.log(`🧪 Testing: ${description}`);
  console.log(`   ${method} ${endpoint}`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Success (${response.status}):`, responseData);
    } else {
      console.log(`   ❌ Failed (${response.status}):`, responseData);
    }
    
    console.log('');
    return { success: response.ok, data: responseData, status: response.status };
    
  } catch (error) {
    console.log(`   🚨 Network Error:`, error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

// Get a test festival ID from the API
async function getTestFestivalId() {
  console.log('🔍 Getting a festival ID for testing...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/festivals?limit=1`);
    if (!response.ok) {
      throw new Error(`Failed to fetch festivals: ${response.statusText}`);
    }
    
    const festivals = await response.json();
    if (festivals.length === 0) {
      throw new Error('No festivals found');
    }
    
    testFestivalId = festivals[0].id;
    console.log(`✅ Using test festival: ${festivals[0].name} (ID: ${testFestivalId})\n`);
    return testFestivalId;
    
  } catch (error) {
    console.log(`❌ Failed to get test festival ID: ${error.message}\n`);
    return null;
  }
}

// Main testing function
async function runTests() {
  // First get a test festival ID
  const festivalId = await getTestFestivalId();
  if (!festivalId) {
    console.log('Cannot continue without a test festival ID');
    return;
  }
  
  console.log('=== API ENDPOINT TESTS ===\n');
  
  // Test 1: Set festival as favorite
  await testEndpoint(
    `/api/festivals/${festivalId}/favorite`,
    'POST',
    { favorite: true },
    'Set festival as favorite'
  );
  
  // Test 2: Remove from favorites
  await testEndpoint(
    `/api/festivals/${festivalId}/favorite`,
    'POST',
    { favorite: false },
    'Remove from favorites'
  );
  
  // Test 3: Archive festival
  await testEndpoint(
    `/api/festivals/${festivalId}/archive`,
    'POST',
    { archived: true },
    'Archive festival'
  );
  
  // Test 4: Unarchive festival
  await testEndpoint(
    `/api/festivals/${festivalId}/archive`,
    'POST',
    { archived: false },
    'Unarchive festival'
  );
  
  // Test 5: Update notes
  await testEndpoint(
    `/api/festivals/${festivalId}/notes`,
    'POST',
    { notes: 'Test note from API tester' },
    'Update festival notes'
  );
  
  // Test 6: Update sales stage
  await testEndpoint(
    `/api/festivals/${festivalId}/sales-stage`,
    'POST',
    { sales_stage: 'talking' },
    'Update sales stage to talking'
  );
  
  // Test 7: Reset sales stage
  await testEndpoint(
    `/api/festivals/${festivalId}/sales-stage`,
    'POST',
    { sales_stage: 'favorited' },
    'Reset sales stage to favorited'
  );
  
  // Test 8: Health check
  await testEndpoint(
    '/api/health',
    'GET',
    null,
    'Health check endpoint'
  );
  
  console.log('=== TESTING COMPLETE ===\n');
  console.log('💡 Next steps:');
  console.log('   1. Check if the changes persisted in the database');
  console.log('   2. Check if localStorage was updated');
  console.log('   3. Check the browser network tab for any failed requests');
}

// Run the tests immediately
runTests().catch(console.error); 
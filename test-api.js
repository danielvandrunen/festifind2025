// Test script for API endpoint
const fetch = require('node-fetch');

async function testApiEndpoint() {
  console.log('Testing API endpoint...');
  
  try {
    // Test the festivals endpoint
    const response = await fetch('http://localhost:3000/api/festivals', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log(`Successfully fetched ${data.count} festivals`);
    } else {
      console.error('API request failed with status:', response.status);
    }
  } catch (err) {
    console.error('Error testing API endpoint:', err);
  }
}

// Run the test
testApiEndpoint(); 
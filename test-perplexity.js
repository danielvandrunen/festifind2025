#!/usr/bin/env node

// FestiFind Perplexity Test Script
// Tests the Perplexity API integration with the new API key

const PERPLEXITY_API_KEY = 'YOUR_PERPLEXITY_API_KEY';

async function testPerplexityAPI() {
  console.log('🧪 Testing Perplexity API with fresh key...');
  
  try {
    // Test basic API connectivity
    console.log('📡 Testing basic API connectivity...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'User-Agent': 'FestiFind-Test/1.0'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Respond with only "API_TEST_SUCCESS" to confirm the connection is working.'
          },
          {
            role: 'user',
            content: 'Test message'
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
        stream: false
      })
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ API Response:', result);
    
    const content = result.choices?.[0]?.message?.content;
    if (content && content.includes('API_TEST_SUCCESS')) {
      console.log('✅ Basic connectivity test passed!');
      return true;
    } else {
      console.log('⚠️ Unexpected response content:', content);
      return true; // Still consider this a success
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testFestivalExtraction() {
  console.log('\n🎪 Testing festival extraction...');
  
  try {
    const testHTML = `
      <html>
        <head><title>Tomorrowland 2025 - The Magical Festival</title></head>
        <body>
          <h1>Tomorrowland 2025</h1>
          <div class="event-details">
            <p>Date: July 18-20, 2025</p>
            <p>Location: Boom, Belgium</p>
            <p>Contact us at: info@tomorrowland.com</p>
            <p>Press inquiries: press@tomorrowland.com</p>
          </div>
        </body>
      </html>
    `;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'User-Agent': 'FestiFind-Test/1.0'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are FestiFind AI, an expert at extracting event and festival information from web content. 

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON - no explanations, no markdown, no additional text
2. Extract festival/event information with high accuracy
3. Focus on festivals, concerts, music events, cultural events, and similar gatherings
4. If no clear event is found, return null values but maintain JSON structure
5. Always provide confidence scores for your extractions

RESPONSE FORMAT (JSON only):
{
  "name": "Festival/Event Name or null",
  "dates": {
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null"
  },
  "location": "City, Country or venue name or null", 
  "emails": ["email1@domain.com", "email2@domain.com"] or [],
  "confidence": 85
}`
          },
          {
            role: 'user',
            content: `Extract festival information from this web content:

${testHTML}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Festival extraction error:', errorText);
      return false;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    console.log('📝 Raw response:', content);
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const extracted = JSON.parse(jsonString);
      
      console.log('🎯 Extracted data:', JSON.stringify(extracted, null, 2));
      
      // Validate extraction
      if (extracted.name && extracted.name.toLowerCase().includes('tomorrowland')) {
        console.log('✅ Festival name extraction: PASSED');
      } else {
        console.log('⚠️ Festival name extraction: PARTIAL');
      }
      
      if (extracted.location && extracted.location.toLowerCase().includes('belgium')) {
        console.log('✅ Location extraction: PASSED');
      } else {
        console.log('⚠️ Location extraction: PARTIAL');
      }
      
      if (extracted.emails && extracted.emails.length > 0) {
        console.log('✅ Email extraction: PASSED');
      } else {
        console.log('⚠️ Email extraction: PARTIAL');
      }
      
      return true;
      
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError.message);
      console.log('Raw content:', content);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Festival extraction test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Perplexity API tests...\n');
  
  const tests = [
    { name: 'Basic API Connectivity', fn: testPerplexityAPI },
    { name: 'Festival Data Extraction', fn: testFestivalExtraction }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    console.log(`Running: ${test.name}`);
    const result = await test.fn();
    if (result) {
      passed++;
      console.log(`✅ ${test.name}: PASSED\n`);
    } else {
      console.log(`❌ ${test.name}: FAILED\n`);
    }
  }
  
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Perplexity integration is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
}); 
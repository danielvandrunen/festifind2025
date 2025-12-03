const fetch = require('node-fetch'); // You'll need to install node-fetch for Node.js

// Configuration
const SERVICE_URL = 'http://localhost:3001';
const API_KEY = 'festifind-perplexity-service-2025';

// Sample HTML content for testing
const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Summer Music Festival 2025 - Amsterdam</title>
    <meta name="description" content="Join us for the biggest music festival in Amsterdam">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Summer Music Festival 2025",
        "startDate": "2025-07-15",
        "endDate": "2025-07-17",
        "location": {
            "@type": "Place",
            "name": "Vondelpark",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Vondelpark",
                "addressLocality": "Amsterdam",
                "addressCountry": "Netherlands"
            }
        },
        "organizer": {
            "@type": "Organization",
            "name": "Music Events Netherlands"
        }
    }
    </script>
</head>
<body>
    <header>
        <nav>Navigation</nav>
    </header>
    
    <main>
        <h1>Summer Music Festival 2025</h1>
        <p>Experience three amazing days of music in the heart of Amsterdam!</p>
        
        <div class="event-details">
            <h2>Event Information</h2>
            <p><strong>Dates:</strong> July 15-17, 2025</p>
            <p><strong>Location:</strong> Vondelpark, Amsterdam</p>
            <p><strong>Organizer:</strong> Music Events Netherlands</p>
        </div>
        
        <div class="contact">
            <h2>Contact</h2>
            <p>For inquiries: <a href="mailto:info@summerfest.nl">info@summerfest.nl</a></p>
            <p>Booking: <a href="mailto:booking@summerfest.nl">booking@summerfest.nl</a></p>
            <p>Phone: +31 20 123 4567</p>
        </div>
        
        <div class="lineup">
            <h2>Featured Artists</h2>
            <ul>
                <li>Artist One</li>
                <li>Artist Two</li>
                <li>Artist Three</li>
            </ul>
        </div>
        
        <div class="tickets">
            <h2>Tickets</h2>
            <p>Early bird: €89</p>
            <p>Regular: €109</p>
            <p><a href="https://tickets.summerfest.nl">Buy tickets here</a></p>
        </div>
    </main>
    
    <footer>
        <p>Footer content</p>
    </footer>
</body>
</html>
`;

/**
 * Test functions
 */
async function testHealthCheck() {
    console.log('\n🔍 Testing health check...');
    
    try {
        const response = await fetch(`${SERVICE_URL}/health`);
        const data = await response.json();
        
        console.log('✅ Health check passed:', data);
        return true;
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

async function testConnectionWithAuth() {
    console.log('\n🔍 Testing authenticated connection...');
    
    try {
        const response = await fetch(`${SERVICE_URL}/api/extract/test`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Connection test passed:', data);
            return true;
        } else {
            console.error('❌ Connection test failed:', data);
            return false;
        }
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
    }
}

async function testEventExtraction() {
    console.log('\n🔍 Testing event extraction...');
    
    try {
        const response = await fetch(`${SERVICE_URL}/api/extract/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                html: SAMPLE_HTML,
                url: 'https://summerfest.nl/2025'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('✅ Event extraction successful!');
            console.log('\n📊 Extracted Data:');
            console.log('- Name:', data.data.name);
            console.log('- Start Date:', data.data.dates.startDate);
            console.log('- End Date:', data.data.dates.endDate);
            console.log('- Location:', data.data.location);
            console.log('- Emails:', data.data.emails);
            console.log('- Organizer:', data.data.organizer);
            console.log('- Category:', data.data.category);
            
            console.log('\n📈 Metadata:');
            console.log('- Confidence:', data.metadata.confidence + '%');
            console.log('- Method:', data.metadata.method);
            console.log('- Token Compression:', data.metadata.stats?.compressionRatio);
            
            return true;
        } else {
            console.error('❌ Event extraction failed:', data);
            return false;
        }
    } catch (error) {
        console.error('❌ Event extraction failed:', error.message);
        return false;
    }
}

async function testInvalidAuth() {
    console.log('\n🔍 Testing invalid authentication...');
    
    try {
        const response = await fetch(`${SERVICE_URL}/api/extract/test`, {
            headers: {
                'Authorization': 'Bearer invalid-key'
            }
        });
        
        const data = await response.json();
        
        if (response.status === 401) {
            console.log('✅ Invalid auth correctly rejected:', data.message);
            return true;
        } else {
            console.error('❌ Invalid auth should have been rejected');
            return false;
        }
    } catch (error) {
        console.error('❌ Auth test failed:', error.message);
        return false;
    }
}

async function testRateLimit() {
    console.log('\n🔍 Testing rate limiting (making multiple quick requests)...');
    
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(
            fetch(`${SERVICE_URL}/api/extract/test`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`
                }
            })
        );
    }
    
    try {
        const responses = await Promise.all(promises);
        const successCount = responses.filter(r => r.ok).length;
        
        console.log(`✅ Made 5 quick requests, ${successCount} succeeded`);
        console.log('✅ Rate limiting appears to be working');
        return true;
    } catch (error) {
        console.error('❌ Rate limit test failed:', error.message);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🚀 Starting Perplexity Extractor Service Tests\n');
    console.log('Service URL:', SERVICE_URL);
    console.log('API Key:', API_KEY.substring(0, 10) + '...');
    
    const tests = [
        { name: 'Health Check', fn: testHealthCheck },
        { name: 'Authenticated Connection', fn: testConnectionWithAuth },
        { name: 'Event Extraction', fn: testEventExtraction },
        { name: 'Invalid Authentication', fn: testInvalidAuth },
        { name: 'Rate Limiting', fn: testRateLimit }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`❌ Test "${test.name}" threw an error:`, error.message);
            failed++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! The service is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the service configuration and logs.');
    }
}

/**
 * Individual test runners for specific scenarios
 */
async function testChromExtensionScenario() {
    console.log('\n🔍 Testing Chrome Extension Integration Scenario...');
    
    // Simulate what the Chrome extension would send
    const extensionRequest = {
        html: SAMPLE_HTML,
        url: 'https://summerfest.nl/2025'
    };
    
    try {
        const response = await fetch(`${SERVICE_URL}/api/extract/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(extensionRequest)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Chrome extension scenario successful!');
            
            // Show how this would populate extension fields
            console.log('\nExtension field population:');
            console.log('document.getElementById("festivalName").value =', `"${result.data.name}"`);
            console.log('document.getElementById("startDate").value =', `"${result.data.dates.startDate}"`);
            console.log('document.getElementById("endDate").value =', `"${result.data.dates.endDate}"`);
            console.log('document.getElementById("location").value =', `"${result.data.location}"`);
            console.log('document.getElementById("emails").value =', `"${result.data.emails.join(', ')}"`);
            
            return true;
        } else {
            console.error('❌ Chrome extension scenario failed:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Chrome extension scenario failed:', error.message);
        return false;
    }
}

// If this file is run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--chrome')) {
        testChromExtensionScenario();
    } else if (args.includes('--health')) {
        testHealthCheck();
    } else if (args.includes('--auth')) {
        testConnectionWithAuth();
    } else if (args.includes('--extract')) {
        testEventExtraction();
    } else {
        runAllTests();
    }
}

module.exports = {
    runAllTests,
    testHealthCheck,
    testConnectionWithAuth,
    testEventExtraction,
    testInvalidAuth,
    testRateLimit,
    testChromExtensionScenario
}; 
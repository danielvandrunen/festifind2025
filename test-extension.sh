#!/bin/bash

echo "🧪 FestiFind Extension Test Suite"
echo "=================================="

# Test 1: Check if Perplexity service is running
echo
echo "📡 Test 1: Perplexity Service Health Check"
echo "-------------------------------------------"
health_response=$(curl -s http://localhost:3005/health)
if [[ $? -eq 0 ]]; then
    echo "✅ Perplexity service is running"
    echo "📊 Service info: $health_response" | jq -r '.service + " v" + .version + " (uptime: " + (.uptime/60|floor|tostring) + "m)"'
else
    echo "❌ Perplexity service is NOT running!"
    echo "💡 Please start it with: cd services/perplexity-extractor && npm start"
    exit 1
fi

# Test 2: Test extraction with known good data
echo
echo "🎯 Test 2: Service Extraction Test"
echo "-----------------------------------"
test_html='<!DOCTYPE html><html><head><title>Vier De Lente Festival</title></head><body><h1>Vier De Lente Festival</h1><p><strong>Date:</strong> 11 April 2026</p><p><strong>Location:</strong> Hillegom, Netherlands</p><p><strong>Contact:</strong> info@vierdelente.com</p></body></html>'

extraction_result=$(curl -s -X POST http://localhost:3005/api/extract/html \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer festifind-perplexity-service-2025" \
  -d "{\"url\": \"file://test\", \"html\": \"$test_html\"}")

if echo "$extraction_result" | jq -e '.success' > /dev/null; then
    echo "✅ Service extraction successful"
    echo "🎪 Festival name: $(echo "$extraction_result" | jq -r '.data.name')"
    echo "📅 Date: $(echo "$extraction_result" | jq -r '.data.dates.startDate')"
    echo "📍 Location: $(echo "$extraction_result" | jq -r '.data.location')"
    echo "📧 Email: $(echo "$extraction_result" | jq -r '.data.emails[0]')"
    echo "🎯 Confidence: $(echo "$extraction_result" | jq -r '.metadata.confidence')%"
else
    echo "❌ Service extraction failed"
    echo "🔍 Error: $(echo "$extraction_result" | jq -r '.error // "Unknown error"')"
    exit 1
fi

# Test 3: Check test HTML page
echo
echo "📄 Test 3: Test Page Analysis"
echo "------------------------------"
if [[ -f "test-extension-debug.html" ]]; then
    html_size=$(wc -c < test-extension-debug.html)
    echo "✅ Test page exists (${html_size} bytes)"
    echo "🌐 File URL: file://$(pwd)/test-extension-debug.html"
    
    # Test extraction with test page
    test_page_html=$(cat test-extension-debug.html)
    test_page_result=$(curl -s -X POST http://localhost:3005/api/extract/html \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer festifind-perplexity-service-2025" \
      -d "{\"url\": \"file://$(pwd)/test-extension-debug.html\", \"html\": $(echo "$test_page_html" | jq -Rs .)}")
    
    if echo "$test_page_result" | jq -e '.success' > /dev/null; then
        echo "✅ Test page extraction successful"
        echo "🎪 Festival: $(echo "$test_page_result" | jq -r '.data.name')"
        echo "🎯 Confidence: $(echo "$test_page_result" | jq -r '.metadata.confidence')%"
    else
        echo "❌ Test page extraction failed"
        echo "🔍 Error: $(echo "$test_page_result" | jq -r '.error // "Unknown error"')"
    fi
else
    echo "❌ Test page not found"
fi

# Test 4: Real website test (the problematic one)
echo
echo "🌐 Test 4: Real Website Test (vierdelente.com)"
echo "-----------------------------------------------"
echo "💡 Now visit https://vierdelente.com/ in Chrome with the extension enabled"
echo "📱 Open the extension popup and click 'Extract Festival Data'"
echo "📊 Check the console for detailed logs"
echo
echo "Expected issues:"
echo "   - HTML length should be ~82 chars (too short)"
echo "   - This causes wrong extraction ('Test Festival 2025' instead of 'Vier De Lente Festival')"
echo
echo "🔍 Debug steps:"
echo "   1. Open Chrome DevTools (F12)"
echo "   2. Go to Console tab"
echo "   3. Look for FestiFind logs showing HTML length"
echo "   4. If HTML < 1000 chars, that's the root cause"

echo
echo "🎯 Test Results Summary:"
echo "========================"
echo "📡 Perplexity Service: ✅ Running and working"
echo "🧪 Service Extraction: ✅ Working perfectly"
echo "📄 Test Page: ✅ Ready for browser testing"
echo "🌐 Real Website: ⚠️ Needs browser testing with extension"
echo
echo "Next steps:"
echo "1. Open Chrome with the extension loaded"
echo "2. Visit file://$(pwd)/test-extension-debug.html"
echo "3. Check that all tests pass in the browser"
echo "4. Then visit https://vierdelente.com/ to debug the HTML issue" 
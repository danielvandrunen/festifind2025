# FestiFind Perplexity Extractor Service

A powerful AI-driven event data extraction service that uses Perplexity AI to intelligently parse website content and extract structured festival/event information. This service replaces traditional regex-based parsing with advanced natural language processing.

## 🚀 Features

- **AI-Powered Extraction**: Uses Perplexity AI for intelligent content understanding
- **HTML to Markdown Conversion**: Optimizes content for AI processing while reducing token usage
- **Structured Data Support**: Automatically detects and uses JSON-LD and microdata
- **Multi-language Support**: Works with Dutch, German, English, and French content
- **Rate Limiting**: Built-in protection against abuse
- **Comprehensive Logging**: Full request/response tracking
- **Security**: API key authentication and CORS protection
- **Extensible**: Easy to integrate with existing FestiFind infrastructure

## 📋 Prerequisites

- Node.js 18+ 
- Perplexity AI API key
- NPM or Yarn

## 🛠️ Installation

1. **Navigate to the service directory**:
   ```bash
   cd services/perplexity-extractor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   PERPLEXITY_BASE_URL=https://api.perplexity.ai
   PORT=3001
   API_KEY=festifind-perplexity-service-2025
   DEFAULT_MODEL=sonar-pro
   MAX_TOKENS=2000
   TEMPERATURE=0.1
   ```

4. **Start the service**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 API Endpoints

### Health Check
```http
GET /health
```
No authentication required. Returns service status.

### Test Connection
```http
GET /api/extract/test
Authorization: Bearer your-api-key
```
Tests Perplexity AI connection and service functionality.

### Extract from HTML
```http
POST /api/extract/html
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "html": "<html>...</html>",
  "url": "https://example.com/event" // optional
}
```

### Extract from URL with HTML
```http
POST /api/extract/url
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "url": "https://example.com/event",
  "html": "<html>...</html>"
}
```

## 📝 Example Usage

### JavaScript/Node.js
```javascript
const extractEventData = async (html, url) => {
  const response = await fetch('http://localhost:3001/api/extract/html', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer festifind-perplexity-service-2025'
    },
    body: JSON.stringify({
      html: html,
      url: url // optional
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Event data:', result.data);
    console.log('Confidence:', result.metadata.confidence);
  } else {
    console.error('Extraction failed:', result.error);
  }
  
  return result;
};
```

### Chrome Extension Integration
```javascript
// In your chrome extension content script
async function extractWithPerplexity() {
  const html = document.documentElement.outerHTML;
  const url = window.location.href;
  
  try {
    const response = await fetch('http://localhost:3001/api/extract/html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer festifind-perplexity-service-2025'
      },
      body: JSON.stringify({ html, url })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Use the extracted data in your extension
      populateExtensionFields(result.data);
    }
    
  } catch (error) {
    console.error('Perplexity extraction failed:', error);
    // Fallback to regex-based extraction
    fallbackExtraction();
  }
}
```

## 📊 Response Format

The service returns data in a format compatible with your existing Chrome extension:

```json
{
  "success": true,
  "data": {
    "name": "Summer Music Festival 2025",
    "dates": {
      "startDate": "2025-07-15",
      "endDate": "2025-07-17"
    },
    "location": "Central Park, New York, USA",
    "emails": ["info@summerfest.com", "booking@summerfest.com"],
    "url": "https://summerfest.com",
    "domain": "summerfest.com",
    "title": "Summer Music Festival 2025",
    "timestamp": "2025-01-02T10:30:00.000Z",
    "description": "Three days of amazing music...",
    "organizer": "Music Events Inc",
    "category": "music festival",
    "structuredLocation": {
      "venue": "Central Park",
      "city": "New York",
      "country": "USA"
    }
  },
  "metadata": {
    "confidence": 85,
    "method": "perplexity-ai",
    "extractedAt": "2025-01-02T10:30:00.000Z",
    "stats": {
      "originalLength": 45678,
      "markdownLength": 3456,
      "compressionRatio": "0.92"
    }
  }
}
```

## 🔒 Security

- **API Key Authentication**: All extraction endpoints require authentication
- **Rate Limiting**: 100 requests per minute per IP (configurable)
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Comprehensive request validation
- **No URL Fetching**: For security, HTML must be provided by the client

## 📈 Performance Optimization

### Cost Optimization
The service implements several strategies to minimize Perplexity API costs:

1. **HTML to Markdown Conversion**: Reduces token usage by ~95%
2. **Content Filtering**: Removes navigation, ads, and irrelevant content
3. **Structured Data Priority**: Uses JSON-LD and microdata when available
4. **Smart Content Selection**: Focuses on main content areas

### Caching Strategies
- Implement Redis caching for frequently accessed content
- Cache processed HTML conversions
- Cache Perplexity responses for identical content

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PERPLEXITY_API_KEY` | - | Your Perplexity AI API key (required) |
| `PERPLEXITY_BASE_URL` | `https://api.perplexity.ai` | Perplexity API base URL |
| `PORT` | `3001` | Server port |
| `API_KEY` | - | Authentication key for this service |
| `DEFAULT_MODEL` | `sonar-pro` | Perplexity AI model to use |
| `MAX_TOKENS` | `2000` | Maximum tokens per request |
| `TEMPERATURE` | `0.1` | AI creativity level (0.0-1.0) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `LOG_LEVEL` | `info` | Logging level |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins |

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3001

CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  perplexity-extractor:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}
      - API_KEY=${API_KEY}
      - NODE_ENV=production
    restart: unless-stopped
```

### Production Considerations
- Use environment variables for sensitive configuration
- Implement Redis for caching
- Set up monitoring and alerting
- Configure log rotation
- Use a reverse proxy (nginx) for SSL termination

## 🔍 Monitoring & Debugging

### Health Monitoring
```bash
# Check service health
curl http://localhost:3001/health

# Test Perplexity connection
curl -H "Authorization: Bearer your-api-key" \
     http://localhost:3001/api/extract/test
```

### Logs
Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

### Common Issues

1. **Rate Limiting**: Adjust `RATE_LIMIT_MAX_REQUESTS` if needed
2. **Token Limits**: Increase `MAX_TOKENS` for complex pages
3. **Performance**: Implement caching for frequently accessed content
4. **Memory Usage**: Monitor for large HTML documents

## 🤝 Integration with Chrome Extension

Update your Chrome extension to use this service:

1. **Modify content script**:
   ```javascript
   // In chrome-extension/content/content.js
   async function handleExtractData(sendResponse) {
     try {
       const html = document.documentElement.outerHTML;
       const url = window.location.href;
       
       // Try Perplexity extraction first
       const perplexityData = await extractWithPerplexity(html, url);
       
       if (perplexityData.success) {
         sendResponse({
           success: true,
           data: perplexityData.data
         });
         return;
       }
       
       // Fallback to regex extraction
       const fallbackData = extractAllData();
       sendResponse({
         success: true,
         data: fallbackData
       });
       
     } catch (error) {
       // Handle error and use fallback
     }
   }
   ```

2. **Add service configuration**:
   ```javascript
   // In chrome-extension/background/background.js
   const PERPLEXITY_SERVICE_URL = 'http://localhost:3001';
   const PERPLEXITY_API_KEY = 'festifind-perplexity-service-2025';
   ```

## 📚 API Documentation

For detailed API documentation, see the interactive documentation at:
- Development: `http://localhost:3001/`
- Production: Your deployed service URL

## 🐛 Troubleshooting

### Common Error Codes

- `401`: Authentication failed - check API key
- `429`: Rate limit exceeded - wait or adjust limits
- `400`: Invalid request - check request format
- `503`: Service unavailable - check Perplexity connection

### Debug Mode
Set `LOG_LEVEL=debug` for verbose logging.

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the logs: `tail -f logs/combined.log`
- Test the service: `GET /api/extract/test`
- Review configuration: Check `.env` file
- Monitor performance: Check response times and confidence scores 
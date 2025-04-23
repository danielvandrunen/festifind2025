type: Always
description: Project guidelines for FestiFind festival aggregator application

# FestiFind Project Guidelines

## Project Overview
FestiFind is a festival aggregator application that scrapes data from multiple festival websites, stores it in a centralized database, and displays it through a modern web interface. Users can browse, filter, favorite, and archive festivals.

## Technology Stack
- **Frontend**: React with Next.js
- **UI Library**: shadcn/ui components
- **Database**: Supabase
- **Scraping**: Custom scrapers for 5 festival websites
- **Testing**: Jest for unit tests, CLI-based testing for components

## Development Workflow

### Development Priorities
1. Test-driven development where possible
2. CLI testing before browser testing
3. Incremental feature implementation
4. Regular version tagging with Git

### Testing Approach
- Use CLI for all testable functionality before visual browser testing
- Leverage Chrome DevTools only for UI/visual debugging
- Write Jest tests for all utility functions and scrapers
- Log extensively during scraper development

### Error Handling
- Implement robust error handling in scrapers
- Add detailed logging for all scraping operations
- Validate all data before database insertion
- Handle edge cases gracefully

## Code Organization

### Directory Structure
```
festifind/
├── .cursor/
│   └── rules/
├── src/
│   ├── components/
│   │   ├── ui/            # shadcn UI components
│   │   ├── festival/      # Festival-specific components
│   │   ├── dev-tools/     # Developer tools components
│   │   └── layout/        # Layout components
│   ├── lib/
│   │   ├── scrapers/      # Scraper modules
│   │   ├── supabase/      # Supabase client and helpers
│   │   ├── utils/         # Utility functions
│   │   └── types.ts       # TypeScript type definitions
│   ├── app/
│   │   ├── page.tsx       # Main page
│   │   ├── dev-tools/     # Dev tools routes
│   │   └── layout.tsx     # Root layout
│   └── styles/            # CSS/styling files
├── tests/                 # Test files
├── scripts/               # CLI scripts and utilities
└── public/                # Static assets
```

### Component Structure
Each component should:
- Have a single responsibility
- Include inline documentation
- Be tested independently
- Include proper TypeScript typing

## Implementation Guidelines

### Scraper Development
- Build each scraper as an independent module
- Include CLI testing scripts for each scraper
- Use consistent error handling and logging
- Validate scraped data before database upload

### Frontend Development
- Follow shadcn/ui design patterns
- Implement responsive design from the start
- Use TypeScript for all components
- Test UI logic with Jest where possible

### Database Integration
- Use Supabase client for all database operations
- Implement proper error handling
- Use transactions for data integrity
- Include data validation before insertion

## CLI Testing Requirements

When implementing new features:
1. Create CLI test scripts in `scripts/` directory
2. Run tests via npm scripts (`npm run test:scraper-befesti`)
3. Output test results in the terminal
4. Use proper exit codes to indicate success/failure

Example test script structure:
```typescript
// scripts/test-befesti-scraper.ts
import { BefestiScraper } from '../src/lib/scrapers/befesti-scraper';

async function testScraper() {
  try {
    const scraper = new BefestiScraper();
    const results = await scraper.scrapeTestPage();
    
    console.log('Test results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Validation logic
    if (results.length > 0 && results[0].name && results[0].start_date) {
      console.log('✅ Test passed');
      process.exit(0);
    } else {
      console.error('❌ Test failed: Invalid data structure');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

testScraper();
```

## Versioning and Documentation

- Tag significant milestones with semantic versioning
- Document all components and modules
- Keep scraper specifications updated
- Maintain a changelog for version history

## Specific Requirements

- All dates must be in ISO format (YYYY-MM-DD)
- Festival names should be properly formatted and sanitized
- Location information should be structured consistently
- Source website attribution must be included for all festivals
- Favorite and archive functionality must persist across sessions 
# FestiFind

FestiFind is a festival aggregator application that scrapes data from multiple festival websites, stores it in a centralized database, and displays it through a modern web interface.

## Features

- Browse festivals from multiple sources
- Filter by month and source
- Favorite and archive festivals
- Add notes to festivals
- Developer tools for scraping and monitoring

## Technology Stack

- Frontend: React with Next.js
- UI Library: shadcn/ui components
- Database: Supabase
- Scraping: Custom scrapers for 5 festival websites
- Testing: Jest for unit tests, CLI-based testing for components

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm (included with Node.js)
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd festifind
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

4. Set up the database:
   Run the SQL script in `sql/schema.sql` in your Supabase SQL Editor.

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
festifind/
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

## Development Workflow

1. Create feature branches from `main`
2. Follow the test-driven development approach
3. Test components via CLI before browser testing
4. Create pull requests for review
5. Tag significant milestones with semantic versioning

## License

[MIT](LICENSE) 
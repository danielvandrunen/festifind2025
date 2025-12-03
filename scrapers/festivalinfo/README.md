# FestivalInfo.nl Scraper

This is a dedicated scraper for extracting festival data from [festivalinfo.nl](https://www.festivalinfo.nl/festivals/). It is designed to operate independently from the eblive scraper to maintain complete isolation and prevent any cross-contamination of code or bugs.

## Features

- Scrapes festival listings from festivalinfo.nl
- Extracts detailed information from individual festival pages
- Normalizes data formats (dates, locations, etc.)
- Stores data in isolated database tables
- Tracks scraping runs with metrics
- Configurable rate limiting to avoid overloading the target website

## Installation

The scraper is designed to run in a Docker container but can also be run locally:

### Prerequisites

- Node.js 16+
- Playwright
- Docker and Docker Compose (for containerized execution)
- Supabase account and API credentials

### Setup

1. Make sure your Supabase credentials are properly configured in your environment:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_key
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create the necessary directories:
   ```
   mkdir -p data logs
   ```

## Usage

### Running with Docker

```bash
# Build and run the scraper
docker-compose build festivalinfo-scraper
docker-compose run --rm festivalinfo-scraper

# Or use the convenience script
node scripts/run-festivalinfo-scraper.js --docker
```

### Running Locally

```bash
# Run directly with Node.js
node scrapers/festivalinfo/index.js

# Or use the convenience script
node scripts/run-festivalinfo-scraper.js
```

### Configuration

You can configure the scraper using environment variables:

- `LOG_LEVEL`: Logging level (default: "info")
- `FESTIVALINFO_DELAY`: Delay between page requests in ms (default: 2000)
- `FESTIVALINFO_DETAIL_DELAY`: Delay between detail page requests in ms (default: 1500)
- `FESTIVALINFO_MAX_PAGES`: Maximum number of pages to scrape (default: 0 = all pages)
- `FESTIVALINFO_OUTPUT_DIR`: Directory to save output files (default: "./data")

## Data Model

The scraper stores data in the following Supabase database structure:

### Schema: `festival_info`

#### Tables:

1. **festivals**
   - `id` - Primary key
   - `festival_id` - Original ID from festivalinfo.nl
   - `name` - Festival name
   - `url` - URL to the festival page
   - `description` - Festival description
   - `location_city` - City
   - `location_country` - Country
   - `start_date` - Start date (ISO format)
   - `end_date` - End date (ISO format)
   - `duration` - Duration in days
   - `num_acts` - Number of acts/artists
   - `is_free` - Whether the festival is free
   - `has_camping` - Whether camping is available
   - `ticket_url` - URL to purchase tickets
   - `created_at` - Record creation timestamp
   - `updated_at` - Record update timestamp

2. **acts**
   - `id` - Primary key
   - `festival_id` - Foreign key to festivals.festival_id
   - `name` - Artist/band name
   - `url` - URL to artist page
   - `created_at` - Record creation timestamp

3. **scrape_runs**
   - `id` - Primary key
   - `start_time` - When the scrape started
   - `end_time` - When the scrape completed
   - `total_festivals` - Total festivals processed
   - `unique_festivals` - Unique festivals stored
   - `errors` - Number of errors encountered
   - `status` - Run status (running/completed/failed)
   - `created_at` - Record creation timestamp

## Troubleshooting

### Common Issues

1. **Connectivity Issues**
   - Check your internet connection
   - Ensure festivalinfo.nl is accessible from your location

2. **Database Issues**
   - Verify Supabase credentials are correct
   - Check if you have the appropriate permissions

3. **Docker Issues**
   - Ensure Docker and Docker Compose are installed and running
   - Check if the Docker service has enough resources

### Logs

Logs are stored in the `logs` directory:
- `festivalinfo-combined.log` - All logs
- `festivalinfo-error.log` - Error logs only

## Maintenance

### Updating Selectors

If the website structure changes, you may need to update the selectors in `config.js`:

```javascript
selectors: {
  festivalList: 'a[href*="/festival/"]',
  festivalName: 'strong',
  pagination: 'a[href*="?page="]',
  // other selectors
}
```

## License

This scraper is part of the FestiFind project and is subject to the same license terms.

## Acknowledgements

- [festivalinfo.nl](https://www.festivalinfo.nl/) for providing festival data
- [Playwright](https://playwright.dev/) for browser automation
- [Supabase](https://supabase.io/) for database storage 
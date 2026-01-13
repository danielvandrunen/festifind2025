-- Migration: Add research data columns to festivals table
-- Purpose: Store research results from Apify and AI orchestrator

-- Add research_data column for storing research results
ALTER TABLE public.festivals
ADD COLUMN IF NOT EXISTS research_data JSONB NULL;

-- Add last_verified column for tracking when festival was last verified on calendar sources
ALTER TABLE public.festivals
ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ NULL;

-- Add calendar_presence column for storing which calendar sources list this festival
ALTER TABLE public.festivals
ADD COLUMN IF NOT EXISTS calendar_presence JSONB NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.festivals.research_data IS 'JSON data from research orchestrator including LinkedIn, news, FAQ, and social media findings';
COMMENT ON COLUMN public.festivals.last_verified IS 'Timestamp of when the festival was last verified across calendar sources';
COMMENT ON COLUMN public.festivals.calendar_presence IS 'JSON object tracking which Dutch calendar sources (EB Live, FestivalInfo, Partyflock, etc.) list this festival';

-- Example structure for research_data:
-- {
--   "linkedin": {
--     "companyUrl": "https://linkedin.com/company/...",
--     "organizers": [...],
--     "lastChecked": "2025-01-13T..."
--   },
--   "news": [{
--     "title": "...",
--     "url": "...",
--     "date": "...",
--     "source": "..."
--   }],
--   "faq": [...],
--   "socialMedia": {
--     "instagram": {...},
--     "facebook": {...}
--   }
-- }

-- Example structure for calendar_presence:
-- {
--   "eblive": { "found": true, "url": "...", "lastChecked": "..." },
--   "festivalinfo": { "found": true, "url": "...", "lastChecked": "..." },
--   "partyflock": { "found": false, "lastChecked": "..." }
-- }

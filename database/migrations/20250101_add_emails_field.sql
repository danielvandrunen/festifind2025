-- Migration: Add emails array field to festivals table for Chrome Extension
-- This allows storing multiple email addresses found on festival websites

-- Add emails array field to festivals table
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS emails TEXT[];

-- Create GIN index for efficient email searches
CREATE INDEX IF NOT EXISTS idx_festivals_emails ON public.festivals USING GIN(emails);

-- Add a comment to document this field
COMMENT ON COLUMN public.festivals.emails IS 'Array of email addresses extracted from festival websites via Chrome extension';

-- Update the updated_at trigger to include the new emails field
-- This ensures updated_at is modified when emails are changed
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists for festivals table
DROP TRIGGER IF EXISTS update_festivals_updated_at ON public.festivals;
CREATE TRIGGER update_festivals_updated_at 
  BEFORE UPDATE ON public.festivals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
-- Migration to ensure all user preference columns exist in festivals table
-- This aligns with the current implementation that stores preferences directly on festivals

-- Add missing columns if they don't exist
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure sales_stage column exists (may already exist from previous migration)
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS sales_stage VARCHAR(20) DEFAULT 'favorited';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_festivals_favorite ON public.festivals (favorite) WHERE favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_festivals_archived ON public.festivals (archived) WHERE archived = TRUE;
CREATE INDEX IF NOT EXISTS idx_festivals_sales_stage ON public.festivals (sales_stage);

-- Add check constraint for sales_stage if it doesn't exist
DO $$
BEGIN
  -- Try to add the constraint, ignore if it already exists
  BEGIN
    ALTER TABLE public.festivals ADD CONSTRAINT chk_valid_sales_stage 
      CHECK (sales_stage IN ('favorited', 'outreach', 'talking', 'offer', 'deal'));
  EXCEPTION
    WHEN duplicate_object THEN
      -- Constraint already exists, do nothing
      NULL;
  END;
END $$;

-- Ensure NOT NULL constraints
ALTER TABLE public.festivals ALTER COLUMN favorite SET DEFAULT FALSE;
ALTER TABLE public.festivals ALTER COLUMN archived SET DEFAULT FALSE;
ALTER TABLE public.festivals ALTER COLUMN sales_stage SET DEFAULT 'favorited';

-- Update any NULL values
UPDATE public.festivals SET favorite = FALSE WHERE favorite IS NULL;
UPDATE public.festivals SET archived = FALSE WHERE archived IS NULL;
UPDATE public.festivals SET sales_stage = 'favorited' WHERE sales_stage IS NULL;

-- Make columns NOT NULL after updating NULLs
ALTER TABLE public.festivals ALTER COLUMN favorite SET NOT NULL;
ALTER TABLE public.festivals ALTER COLUMN archived SET NOT NULL;
ALTER TABLE public.festivals ALTER COLUMN sales_stage SET NOT NULL;

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_festivals_updated_at ON public.festivals;
CREATE TRIGGER update_festivals_updated_at 
  BEFORE UPDATE ON public.festivals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
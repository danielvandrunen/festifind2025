-- Add sales_stage column to the festivals table
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS sales_stage VARCHAR(20) DEFAULT 'favorited';

-- Create an index on the sales_stage column for faster queries
CREATE INDEX IF NOT EXISTS idx_festivals_sales_stage ON public.festivals (sales_stage);

-- Add check constraint to ensure valid values
ALTER TABLE public.festivals ADD CONSTRAINT chk_valid_sales_stage 
  CHECK (sales_stage IN ('favorited', 'outreach', 'talking', 'offer', 'deal'));

-- Update any NULL values to 'favorited'
UPDATE public.festivals SET sales_stage = 'favorited' WHERE sales_stage IS NULL;

-- Ensure the column is not NULL
ALTER TABLE public.festivals ALTER COLUMN sales_stage SET NOT NULL; 
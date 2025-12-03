# Sales Monitor

The Sales Monitor page provides a Kanban board interface for tracking festivals through different sales stages:
- Favorited
- Outreach
- Talking
- Offer
- Deal

## Database Setup

Before using the Sales Monitor, you need to add a `sales_stage` column to the `festivals` table. 

### Running the Migration

1. Open the Supabase dashboard for your project
2. Navigate to the SQL Editor
3. Copy and paste the following SQL code:

```sql
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
```

4. Click "Run" to execute the SQL

## Usage

The Sales Monitor allows you to:
1. View festivals in each sales stage
2. Move festivals between stages using the move buttons
3. Track the sales pipeline process from initial interest to final deal

## Data Flow

- Festivals data is fetched from the Supabase database
- The `sales_stage` column determines which column a festival appears in
- When a festival is moved between stages, the database is updated accordingly 
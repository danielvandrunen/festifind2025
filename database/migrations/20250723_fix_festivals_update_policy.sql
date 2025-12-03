-- Migration to fix RLS policies for festivals table updates
-- This allows anonymous users to update user preference fields (favorite, archived, sales_stage, notes)

-- First, let's check if RLS is enabled (it should be)
-- We'll create an UPDATE policy that allows updates to preference fields

-- Allow anonymous users to update preference fields in festivals table
CREATE POLICY IF NOT EXISTS "Allow updates to festival preferences"
  ON public.festivals
  FOR UPDATE
  USING (true)  -- Allow anyone to update
  WITH CHECK (true);  -- Allow any updates

-- Alternative more restrictive policy (if we want to be more secure later):
-- This would only allow updates to specific preference columns
-- CREATE POLICY IF NOT EXISTS "Allow updates to festival preference fields"
--   ON public.festivals  
--   FOR UPDATE
--   USING (true)
--   WITH CHECK (
--     -- Only allow updates to preference fields, not core festival data
--     OLD.id = NEW.id AND
--     OLD.name = NEW.name AND
--     OLD.start_date = NEW.start_date AND
--     OLD.end_date = NEW.end_date AND
--     OLD.location = NEW.location AND
--     OLD.country = NEW.country AND
--     OLD.url = NEW.url AND
--     OLD.source = NEW.source AND
--     OLD.created_at = NEW.created_at
--   );

-- Also ensure INSERT policy exists for completeness (though we probably don't need it)
CREATE POLICY IF NOT EXISTS "Allow anonymous festival inserts"
  ON public.festivals
  FOR INSERT
  WITH CHECK (true);

-- Update the updated_at timestamp trigger to always update on preference changes
CREATE OR REPLACE FUNCTION update_festivals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger to ensure it works
DROP TRIGGER IF EXISTS update_festivals_updated_at_trigger ON public.festivals;
CREATE TRIGGER update_festivals_updated_at_trigger
    BEFORE UPDATE ON public.festivals
    FOR EACH ROW
    EXECUTE FUNCTION update_festivals_updated_at(); 
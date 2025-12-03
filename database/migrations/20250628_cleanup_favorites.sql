-- Cleanup script to reset favorites that were set by aggressive smart favoriting
-- This preserves legitimate favorites while fixing the bulk auto-favoriting issue

-- First, let's see the current state
SELECT 
  COUNT(*) as total_festivals,
  COUNT(CASE WHEN favorite = true THEN 1 END) as currently_favorited,
  COUNT(CASE WHEN sales_stage != 'favorited' THEN 1 END) as in_active_sales_stages,
  COUNT(CASE WHEN favorite = true AND sales_stage = 'favorited' THEN 1 END) as true_favorites_only
FROM festivals;

-- Reset favorites to false for all festivals initially
-- This removes the bulk auto-favoriting done by the aggressive logic
UPDATE festivals SET favorite = false;

-- Re-apply smart favoriting logic only for festivals in active sales stages
-- These should be auto-favorited according to our business rules
UPDATE festivals 
SET favorite = true 
WHERE sales_stage IN ('outreach', 'talking', 'offer', 'deal');

-- Show the result after cleanup
SELECT 
  COUNT(*) as total_festivals,
  COUNT(CASE WHEN favorite = true THEN 1 END) as favorited_after_cleanup,
  COUNT(CASE WHEN sales_stage != 'favorited' THEN 1 END) as in_active_sales_stages,
  COUNT(CASE WHEN favorite = true AND sales_stage = 'favorited' THEN 1 END) as manual_favorites_only
FROM festivals; 
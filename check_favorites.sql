-- Check current state of favorites and sales stages in the database
SELECT 
  COUNT(*) as total_festivals,
  COUNT(CASE WHEN favorite = true THEN 1 END) as favorited_festivals,
  COUNT(CASE WHEN sales_stage != 'favorited' THEN 1 END) as in_sales_stages,
  COUNT(CASE WHEN favorite = true AND sales_stage = 'favorited' THEN 1 END) as true_favorites
FROM festivals; 
-- Function to clear all research references from festivals table
CREATE OR REPLACE FUNCTION clear_festival_research_references()
RETURNS void AS $$
BEGIN
  -- Update festivals table to clear research references
  UPDATE festivals 
  SET research_id = NULL, 
      research_status = NULL;
  
  -- Additionally, delete all entries in the festival_research table
  DELETE FROM festival_research;
  
  -- Return success
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
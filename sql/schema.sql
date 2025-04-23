-- Create festivals table
CREATE TABLE IF NOT EXISTS festivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  country TEXT,
  url TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);

-- Create index for faster date-based filtering
CREATE INDEX IF NOT EXISTS idx_festivals_start_date ON festivals(start_date);

-- Create index for faster source filtering
CREATE INDEX IF NOT EXISTS idx_festivals_source ON festivals(source);

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  selected_sources TEXT[] DEFAULT '{}',
  view_mode TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to festivals table
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON festivals
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Apply the trigger to user_preferences table
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); 
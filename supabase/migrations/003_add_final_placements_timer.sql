-- Add timer columns for final placements phase
ALTER TABLE games ADD COLUMN IF NOT EXISTS final_placements_start_time TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS final_placements_duration INTEGER DEFAULT 10;

-- Add comments explaining the columns
COMMENT ON COLUMN games.final_placements_start_time IS 'Timestamp when the final placements review timer started';
COMMENT ON COLUMN games.final_placements_duration IS 'Duration in seconds for the final placements review phase (default 10s)';

-- Add status column to games table if it doesn't exist
-- This allows tracking game state (waiting, starting, in_progress, completed)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'status'
  ) THEN
    ALTER TABLE games ADD COLUMN status VARCHAR(50) DEFAULT 'waiting';
    COMMENT ON COLUMN games.status IS 'Game status: waiting, starting, in_progress, completed';
  END IF;
END $$;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- Update RLS policies to allow status updates
DROP POLICY IF EXISTS "Allow game status updates" ON games;
CREATE POLICY "Allow game status updates"
  ON games
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

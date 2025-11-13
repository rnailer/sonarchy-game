-- Fix RLS policies for player_votes to allow updates and deletes
-- This allows players to change or remove their votes

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Players can insert their own votes" ON player_votes;
DROP POLICY IF EXISTS "Anyone can view player votes" ON player_votes;

-- Recreate with proper permissions
CREATE POLICY "Players can manage their own votes - INSERT"
ON player_votes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Players can manage their own votes - SELECT"
ON player_votes FOR SELECT
TO anon, authenticated
USING (true);

-- Add UPDATE policy so players can switch votes
CREATE POLICY "Players can manage their own votes - UPDATE"
ON player_votes FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Add DELETE policy so players can remove votes
CREATE POLICY "Players can manage their own votes - DELETE"
ON player_votes FOR DELETE
TO anon, authenticated
USING (true);

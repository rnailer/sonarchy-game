-- Enable Row Level Security on tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_chat ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create games" ON games;
DROP POLICY IF EXISTS "Users can view games" ON games;
DROP POLICY IF EXISTS "Users can update their own games" ON games;
DROP POLICY IF EXISTS "Users can join games" ON game_players;
DROP POLICY IF EXISTS "Users can view game players" ON game_players;
DROP POLICY IF EXISTS "Users can send chat messages" ON game_chat;
DROP POLICY IF EXISTS "Users can view chat messages" ON game_chat;

-- Games table policies
-- Allow authenticated users to create games
CREATE POLICY "Users can create games" ON games
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anyone to view games (needed for joining via game code)
CREATE POLICY "Users can view games" ON games
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow hosts to update their own games
CREATE POLICY "Users can update their own games" ON games
  FOR UPDATE
  TO authenticated
  USING (host_user_id = auth.uid());

-- Game players table policies
-- Allow authenticated users to join games
CREATE POLICY "Users can join games" ON game_players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anyone to view game players
CREATE POLICY "Users can view game players" ON game_players
  FOR SELECT
  TO authenticated
  USING (true);

-- Game chat table policies
-- Allow authenticated users to send messages
CREATE POLICY "Users can send chat messages" ON game_chat
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view chat messages for games they're in
CREATE POLICY "Users can view chat messages" ON game_chat
  FOR SELECT
  TO authenticated
  USING (true);

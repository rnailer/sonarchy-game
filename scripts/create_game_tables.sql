-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code VARCHAR(6) UNIQUE NOT NULL,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, in_progress, completed
  max_players INTEGER DEFAULT 10,
  playback_device VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create game_players table
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  avatar_id VARCHAR(50) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_host BOOLEAN DEFAULT FALSE,
  UNIQUE(game_id, user_id)
);

-- Create game_chat table
CREATE TABLE IF NOT EXISTS game_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_code ON games(game_code);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_chat_game_id ON game_chat(game_id);
CREATE INDEX IF NOT EXISTS idx_game_chat_created_at ON game_chat(created_at);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_chat ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games
CREATE POLICY "Anyone can view games" ON games FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create games" ON games FOR INSERT WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "Host can update their games" ON games FOR UPDATE USING (auth.uid() = host_user_id);

-- RLS Policies for game_players
CREATE POLICY "Anyone can view game players" ON game_players FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join games" ON game_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can update their own record" ON game_players FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for game_chat
CREATE POLICY "Anyone can view game chat" ON game_chat FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send messages" ON game_chat FOR INSERT WITH CHECK (auth.uid() = user_id);

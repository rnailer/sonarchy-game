-- Create spotify_tokens table to store user Spotify OAuth tokens
CREATE TABLE IF NOT EXISTS spotify_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_spotify_tokens_user_id ON spotify_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE spotify_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own tokens
CREATE POLICY "Users can read their own Spotify tokens"
  ON spotify_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own tokens
CREATE POLICY "Users can insert their own Spotify tokens"
  ON spotify_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own tokens
CREATE POLICY "Users can update their own Spotify tokens"
  ON spotify_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own tokens
CREATE POLICY "Users can delete their own Spotify tokens"
  ON spotify_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

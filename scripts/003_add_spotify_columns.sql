-- Add Spotify integration columns to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS spotify_access_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS spotify_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS spotify_connected BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_spotify_connected 
ON public.user_profiles(spotify_connected);

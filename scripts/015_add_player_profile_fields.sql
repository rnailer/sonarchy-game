-- Add player profile fields to user_profiles table
-- These fields store the user's chosen player name and avatar for games

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS player_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE;

-- Create index for faster profile completion lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_complete
ON public.user_profiles(profile_complete);

-- Update profile_complete for users who have both player_name and avatar_id
UPDATE public.user_profiles
SET profile_complete = TRUE
WHERE player_name IS NOT NULL
  AND avatar_id IS NOT NULL
  AND spotify_access_token IS NOT NULL;

-- Make host_user_id nullable so we can use localStorage player IDs
ALTER TABLE games ALTER COLUMN host_user_id DROP NOT NULL;

-- Drop the foreign key constraint if it exists
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_host_user_id_fkey;

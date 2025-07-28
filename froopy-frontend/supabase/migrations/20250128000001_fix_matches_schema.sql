-- Migration: Fix matches table schema issues
-- This migration addresses the user2_id column type mismatch and improves the matching system

-- Step 1: Create a new temporary column for UUID user2_id
ALTER TABLE matches ADD COLUMN user2_id_uuid UUID;

-- Step 2: Update existing bot matches to NULL (since bot IDs are not valid UUIDs)
UPDATE matches 
SET user2_id_uuid = NULL 
WHERE is_bot = true;

-- Step 3: Convert valid UUID strings to UUID type for non-bot matches
UPDATE matches 
SET user2_id_uuid = user2_id::UUID 
WHERE is_bot = false 
  AND user2_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 4: Add a separate column for bot IDs
ALTER TABLE matches ADD COLUMN bot_id TEXT;

-- Step 5: Copy bot IDs to the new column
UPDATE matches 
SET bot_id = user2_id 
WHERE is_bot = true;

-- Step 6: Drop the old unique constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user1_id_user2_id_key;

-- Step 7: Drop the old user2_id column
ALTER TABLE matches DROP COLUMN user2_id;

-- Step 8: Rename the new column
ALTER TABLE matches RENAME COLUMN user2_id_uuid TO user2_id;

-- Step 9: Add foreign key constraint for user2_id (only for non-bot matches)
ALTER TABLE matches 
ADD CONSTRAINT matches_user2_id_fkey 
FOREIGN KEY (user2_id) 
REFERENCES users(id);

-- Step 10: Create a new unique constraint that handles both user and bot matches
CREATE UNIQUE INDEX matches_unique_user_pair 
ON matches (
  LEAST(user1_id, user2_id), 
  GREATEST(user1_id, user2_id)
) 
WHERE is_bot = false AND user2_id IS NOT NULL;

-- Step 11: Create unique constraint for bot matches
CREATE UNIQUE INDEX matches_unique_user_bot 
ON matches (user1_id, bot_id) 
WHERE is_bot = true;

-- Step 12: Add check constraint to ensure proper data
ALTER TABLE matches 
ADD CONSTRAINT matches_user_or_bot_check 
CHECK (
  (is_bot = false AND user2_id IS NOT NULL AND bot_id IS NULL) OR
  (is_bot = true AND user2_id IS NULL AND bot_id IS NOT NULL)
);

-- Step 13: Update RLS policies to handle the new schema
DROP POLICY IF EXISTS "Users can view their own matches" ON matches;
CREATE POLICY "Users can view their own matches" ON matches
  FOR SELECT
  USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id OR 
    is_bot = true
  );

DROP POLICY IF EXISTS "Users can update their own matches" ON matches;
CREATE POLICY "Users can update their own matches" ON matches
  FOR UPDATE
  USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id
  );

-- Step 14: Add unique constraint on waiting_pool to prevent duplicate entries
ALTER TABLE waiting_pool 
ADD CONSTRAINT waiting_pool_user_id_unique 
UNIQUE (user_id);

-- Step 15: Add last_activity timestamp to waiting_pool for cleanup
ALTER TABLE waiting_pool 
ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 16: Create index for efficient cleanup queries
CREATE INDEX idx_waiting_pool_last_activity 
ON waiting_pool (last_activity);

-- Step 17: Add match state enum type
CREATE TYPE match_state AS ENUM ('pending', 'active', 'ended');

-- Step 18: Add state column to matches table
ALTER TABLE matches 
ADD COLUMN state match_state DEFAULT 'active';

-- Step 19: Update existing matches to have proper state
UPDATE matches 
SET state = CASE 
  WHEN ended_at IS NOT NULL THEN 'ended'::match_state
  ELSE 'active'::match_state
END;

-- Step 20: Create function for atomic match creation
CREATE OR REPLACE FUNCTION create_match_atomic(
  p_user1_id UUID,
  p_user2_id UUID,
  p_is_bot BOOLEAN DEFAULT false,
  p_bot_id TEXT DEFAULT NULL,
  p_bot_profile JSONB DEFAULT NULL
) RETURNS matches AS $$
DECLARE
  v_match matches;
  v_existing_match matches;
BEGIN
  -- Start transaction
  -- Check for existing active match between users
  IF NOT p_is_bot THEN
    SELECT * INTO v_existing_match
    FROM matches
    WHERE state != 'ended'
      AND (
        (user1_id = p_user1_id AND user2_id = p_user2_id) OR
        (user1_id = p_user2_id AND user2_id = p_user1_id)
      )
    LIMIT 1;
    
    IF FOUND THEN
      -- Return existing match
      RETURN v_existing_match;
    END IF;
  END IF;
  
  -- Create new match
  INSERT INTO matches (user1_id, user2_id, is_bot, bot_id, bot_profile, state)
  VALUES (p_user1_id, p_user2_id, p_is_bot, p_bot_id, p_bot_profile, 'active')
  RETURNING * INTO v_match;
  
  -- Remove both users from waiting pool
  DELETE FROM waiting_pool 
  WHERE user_id IN (p_user1_id, p_user2_id);
  
  RETURN v_match;
END;
$$ LANGUAGE plpgsql;

-- Step 21: Create function to clean up stale waiting pool entries
CREATE OR REPLACE FUNCTION cleanup_stale_waiting_pool() RETURNS void AS $$
BEGIN
  DELETE FROM waiting_pool 
  WHERE last_activity < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Step 22: Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_match_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_waiting_pool TO authenticated;
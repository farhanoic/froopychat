-- Migration: Fix matches table schema issues (Corrected Version)
-- This migration addresses the user2_id column type mismatch and improves the matching system

-- Step 1: Drop existing policies that depend on user2_id
DROP POLICY IF EXISTS "Users can view their own matches" ON matches;
DROP POLICY IF EXISTS "Users can update their own matches" ON matches;
DROP POLICY IF EXISTS "Users can view messages from their matches" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their matches" ON messages;

-- Step 2: Add match state enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_state') THEN
        CREATE TYPE match_state AS ENUM ('pending', 'active', 'ended');
    END IF;
END$$;

-- Step 3: Add new columns to matches table
ALTER TABLE matches 
  ADD COLUMN IF NOT EXISTS state match_state DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bot_id TEXT;

-- Step 4: Update existing matches to have proper state
UPDATE matches 
SET state = CASE 
  WHEN ended_at IS NOT NULL THEN 'ended'::match_state
  ELSE 'active'::match_state
END
WHERE state IS NULL;

-- Step 5: Add unique constraint on waiting_pool if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waiting_pool_user_id_unique' 
        AND conrelid = 'waiting_pool'::regclass
    ) THEN
        ALTER TABLE waiting_pool 
        ADD CONSTRAINT waiting_pool_user_id_unique UNIQUE (user_id);
    END IF;
END$$;

-- Step 6: Add last_activity column to waiting_pool
ALTER TABLE waiting_pool 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 7: Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_waiting_pool_last_activity ON waiting_pool (last_activity);

-- Step 8: Recreate RLS policies for matches
CREATE POLICY "Users can view their own matches" ON matches
  FOR SELECT
  USING (
    auth.uid()::text = user1_id::text OR 
    auth.uid()::text = user2_id OR 
    is_bot = true
  );

CREATE POLICY "Users can update their own matches" ON matches
  FOR UPDATE
  USING (
    auth.uid()::text = user1_id::text OR 
    auth.uid()::text = user2_id
  );

-- Step 9: Recreate RLS policies for messages with proper type handling
CREATE POLICY "Users can view messages from their matches" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (
        matches.user1_id::text = auth.uid()::text OR 
        matches.user2_id = auth.uid()::text OR
        matches.is_bot = true
      )
    )
  );

CREATE POLICY "Users can send messages to their matches" ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND matches.state = 'active'
      AND (
        matches.user1_id::text = auth.uid()::text OR 
        matches.user2_id = auth.uid()::text
      )
    )
  );

-- Step 10: Create function for atomic match creation (works with mixed types)
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
  v_user2_id_text TEXT;
BEGIN
  -- Convert UUID to TEXT for user2_id column
  IF p_user2_id IS NOT NULL THEN
    v_user2_id_text := p_user2_id::TEXT;
  END IF;
  
  -- Check for existing active match between users
  IF NOT p_is_bot AND p_user2_id IS NOT NULL THEN
    SELECT * INTO v_existing_match
    FROM matches
    WHERE state != 'ended'
      AND (
        (user1_id = p_user1_id AND user2_id = v_user2_id_text) OR
        (user1_id = p_user2_id AND user2_id = p_user1_id::TEXT)
      )
    LIMIT 1;
    
    IF FOUND THEN
      -- Return existing match
      RETURN v_existing_match;
    END IF;
  END IF;
  
  -- Create new match
  IF p_is_bot THEN
    INSERT INTO matches (user1_id, user2_id, is_bot, bot_id, bot_profile, state)
    VALUES (p_user1_id, NULL, true, p_bot_id, p_bot_profile, 'active')
    RETURNING * INTO v_match;
  ELSE
    INSERT INTO matches (user1_id, user2_id, is_bot, bot_id, bot_profile, state)
    VALUES (p_user1_id, v_user2_id_text, false, NULL, NULL, 'active')
    RETURNING * INTO v_match;
  END IF;
  
  -- Remove both users from waiting pool
  DELETE FROM waiting_pool 
  WHERE user_id IN (p_user1_id, p_user2_id);
  
  RETURN v_match;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create function to clean up stale waiting pool entries
CREATE OR REPLACE FUNCTION cleanup_stale_waiting_pool() RETURNS void AS $$
BEGIN
  DELETE FROM waiting_pool 
  WHERE last_activity < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Step 12: Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_match_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_waiting_pool TO authenticated;

-- Step 13: Update bot matches to use bot_id column
UPDATE matches 
SET bot_id = user2_id 
WHERE is_bot = true AND bot_id IS NULL;
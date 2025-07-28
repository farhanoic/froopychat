-- Migration: Fix Bot Support (Corrected)
-- Description: Properly add bot functionality by handling policy dependencies

-- Add bot support columns first
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bot_profile JSONB;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;

-- Drop existing policies that depend on the columns we need to change
DROP POLICY IF EXISTS "Users can view their own matches" ON matches;
DROP POLICY IF EXISTS "Users can update their own matches" ON matches;
DROP POLICY IF EXISTS "Users can view messages from their matches" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their matches" ON messages;

-- Drop foreign key constraints
ALTER TABLE matches 
DROP CONSTRAINT IF EXISTS matches_user2_id_fkey;

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- Change column types to support bot IDs
ALTER TABLE matches ALTER COLUMN user2_id TYPE TEXT;
ALTER TABLE messages ALTER COLUMN sender_id TYPE TEXT;

-- Recreate the policies with bot support
CREATE POLICY "Users can view their own matches" ON matches
  FOR SELECT USING (
    auth.uid()::text = user1_id OR 
    auth.uid()::text = user2_id OR
    is_bot = true
  );

CREATE POLICY "Users can update their own matches" ON matches
  FOR UPDATE USING (
    auth.uid()::text = user1_id OR 
    auth.uid()::text = user2_id
  );

CREATE POLICY "Users can view messages from their matches" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (
        matches.user1_id = auth.uid()::text OR 
        matches.user2_id = auth.uid()::text OR
        matches.is_bot = true
      )
    )
  );

CREATE POLICY "Users can send messages to their matches" ON messages
  FOR INSERT WITH CHECK (
    (auth.uid()::text = sender_id OR is_bot = true) AND
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (
        matches.user1_id = auth.uid()::text OR 
        matches.user2_id = auth.uid()::text OR
        matches.is_bot = true
      )
      AND matches.ended_at IS NULL
    )
  );

-- Add bot-specific policies
CREATE POLICY "Allow bot match creation" ON matches
  FOR INSERT WITH CHECK (is_bot = true);

CREATE POLICY "Allow bot message creation" ON messages  
  FOR INSERT WITH CHECK (is_bot = true);

-- Update the user view policy to handle bot lookups more gracefully
DROP POLICY IF EXISTS "Allow bot user lookups" ON users;
CREATE POLICY "Allow bot user lookups" ON users
  FOR SELECT USING (true);

-- Create indexes for bot queries
CREATE INDEX IF NOT EXISTS idx_matches_is_bot ON matches(is_bot);
CREATE INDEX IF NOT EXISTS idx_messages_is_bot ON messages(is_bot);
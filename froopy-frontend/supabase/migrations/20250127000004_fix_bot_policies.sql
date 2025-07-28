-- Migration: Fix Bot Policies with Proper Type Casting
-- Description: Correctly handle UUID/TEXT comparisons in RLS policies

-- Drop and recreate policies with proper type casting
DROP POLICY IF EXISTS "Users can view their own matches" ON matches;
DROP POLICY IF EXISTS "Users can update their own matches" ON matches;
DROP POLICY IF EXISTS "Users can view messages from their matches" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their matches" ON messages;

-- Create updated policies with proper UUID/TEXT handling
CREATE POLICY "Users can view their own matches" ON matches
  FOR SELECT USING (
    user1_id::text = auth.uid()::text OR 
    user2_id = auth.uid()::text OR
    is_bot = true
  );

CREATE POLICY "Users can update their own matches" ON matches
  FOR UPDATE USING (
    user1_id::text = auth.uid()::text OR 
    user2_id = auth.uid()::text
  );

CREATE POLICY "Users can view messages from their matches" ON messages
  FOR SELECT USING (
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
  FOR INSERT WITH CHECK (
    (sender_id = auth.uid()::text OR is_bot = true) AND
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (
        matches.user1_id::text = auth.uid()::text OR 
        matches.user2_id = auth.uid()::text OR
        matches.is_bot = true
      )
      AND matches.ended_at IS NULL
    )
  );
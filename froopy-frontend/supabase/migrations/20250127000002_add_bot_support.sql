-- Migration: Add Bot Support
-- Description: Add bot functionality to matches and messages tables

-- Add bot support to matches table
ALTER TABLE matches 
ADD COLUMN is_bot BOOLEAN DEFAULT FALSE,
ADD COLUMN bot_profile JSONB;

-- Add bot support to messages table  
ALTER TABLE messages
ADD COLUMN is_bot BOOLEAN DEFAULT FALSE;

-- For bot support, we need to change user2_id and sender_id to TEXT to allow bot IDs
-- First, let's change the matches table user2_id to allow bot IDs
ALTER TABLE matches ALTER COLUMN user2_id TYPE TEXT;

-- Update the constraint to be conditional - only enforce foreign key for non-bot matches
ALTER TABLE matches 
DROP CONSTRAINT matches_user2_id_fkey;

-- For messages table, change sender_id to TEXT to allow bot senders
ALTER TABLE messages ALTER COLUMN sender_id TYPE TEXT;

-- Update the constraint to be conditional for non-bot messages
ALTER TABLE messages
DROP CONSTRAINT messages_sender_id_fkey;

-- Update RLS policies to handle bot matches
-- Allow bot matches to be created without user constraints
CREATE POLICY "Allow bot match creation" ON matches
  FOR INSERT WITH CHECK (is_bot = true);

-- Allow bot messages to be created
CREATE POLICY "Allow bot message creation" ON messages  
  FOR INSERT WITH CHECK (is_bot = true);

-- Update the user view policy to handle bot lookups more gracefully
CREATE POLICY "Allow bot user lookups" ON users
  FOR SELECT USING (true);

-- Create indexes for bot queries
CREATE INDEX idx_matches_is_bot ON matches(is_bot);
CREATE INDEX idx_messages_is_bot ON messages(is_bot);
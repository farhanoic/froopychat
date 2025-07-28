-- Migration: Enable realtime for messages table
-- This migration adds the messages table to the supabase_realtime publication
-- to enable real-time updates for chat messages

-- Add messages table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Also ensure matches table is in realtime (for match updates)
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Add waiting_pool for real-time matching updates
ALTER PUBLICATION supabase_realtime ADD TABLE waiting_pool;

-- Add friends and friend_messages for future real-time friend chat
ALTER PUBLICATION supabase_realtime ADD TABLE friends;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_messages;

-- Verify the tables are added (this is just for documentation)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
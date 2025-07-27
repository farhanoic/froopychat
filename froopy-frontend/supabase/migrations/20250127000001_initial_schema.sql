-- Migration: Initial Froopy Chat Schema
-- Description: Create all necessary tables for chat functionality

-- Users table (Supabase Auth handles email/password)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  interests TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read all users but only update their own
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Waiting pool for matching
CREATE TABLE waiting_pool (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS for waiting_pool
ALTER TABLE waiting_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own waiting pool entries" ON waiting_pool
  FOR ALL USING (auth.uid() = user_id);

-- Active matches
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  UNIQUE(user1_id, user2_id)
);

-- Enable RLS for matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches" ON matches
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "System can create matches" ON matches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own matches" ON matches
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id),
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their matches" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages to their matches" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
      AND matches.ended_at IS NULL
    )
  );

-- Friends system
CREATE TABLE friends (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS for friends
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friendships" ON friends
  FOR DELETE USING (auth.uid() = user_id);

-- Friend messages
CREATE TABLE friend_messages (
  id SERIAL PRIMARY KEY,
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS for friend_messages
ALTER TABLE friend_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friend messages" ON friend_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend messages" ON friend_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM friends 
      WHERE (friends.user_id = auth.uid() AND friends.friend_id = receiver_id)
      OR (friends.user_id = receiver_id AND friends.friend_id = auth.uid())
    )
  );

CREATE POLICY "Users can update read status of received messages" ON friend_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_waiting_pool_user_id ON waiting_pool(user_id);
CREATE INDEX idx_waiting_pool_created_at ON waiting_pool(created_at);
CREATE INDEX idx_matches_user1_id ON matches(user1_id);
CREATE INDEX idx_matches_user2_id ON matches(user2_id);
CREATE INDEX idx_matches_created_at ON matches(created_at);
CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friend_messages_sender_id ON friend_messages(sender_id);
CREATE INDEX idx_friend_messages_receiver_id ON friend_messages(receiver_id);
CREATE INDEX idx_friend_messages_created_at ON friend_messages(created_at);

-- Function to automatically create user profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be called from a trigger, profile creation will happen in the application
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user signup (profile creation handled in app)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
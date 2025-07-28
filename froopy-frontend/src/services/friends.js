// services/friends.js - Supabase Friends System for Froopy Chat
import { supabase } from './supabase';

export const friendsService = {
  /**
   * Add a friend by username - creates bidirectional relationship
   */
  async addFriend(userId, friendUsername) {
    console.log('🤝 Adding friend:', { userId, friendUsername });
    
    try {
      // Get friend's user ID
      const { data: friend, error: friendError } = await supabase
        .from('users')
        .select('id')
        .eq('username', friendUsername)
        .single();

      if (friendError || !friend) {
        console.error('Friend not found:', friendError);
        throw new Error('User not found');
      }

      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', friend.id)
        .single();

      if (existingFriendship) {
        throw new Error('Already friends with this user');
      }

      // Add bidirectional friendship
      const { error: insertError } = await supabase
        .from('friends')
        .insert([
          { user_id: userId, friend_id: friend.id },
          { user_id: friend.id, friend_id: userId }
        ]);

      if (insertError) {
        console.error('Error creating friendship:', insertError);
        throw insertError;
      }

      console.log('✅ Friendship created successfully');
      return { success: true, friendId: friend.id, friendUsername };
    } catch (error) {
      console.error('Error adding friend:', error);
      throw error;
    }
  },

  /**
   * Add friend by ID (used during chat for quick add)
   */
  async addFriendById(userId, friendId, friendUsername) {
    console.log('🤝 Adding friend by ID:', { userId, friendId, friendUsername });
    
    try {
      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .single();

      if (existingFriendship) {
        throw new Error('Already friends with this user');
      }

      // Add bidirectional friendship
      const { error: insertError } = await supabase
        .from('friends')
        .insert([
          { user_id: userId, friend_id: friendId },
          { user_id: friendId, friend_id: userId }
        ]);

      if (insertError) {
        console.error('Error creating friendship:', insertError);
        throw insertError;
      }

      console.log('✅ Friendship created successfully by ID');
      return { success: true, friendId, friendUsername };
    } catch (error) {
      console.error('Error adding friend by ID:', error);
      throw error;
    }
  },

  /**
   * Get user's friends list with details
   */
  async getFriends(userId) {
    console.log('👥 Getting friends for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id(
            id,
            username,
            gender,
            created_at
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching friends:', error);
        throw error;
      }

      // Transform data to match expected format
      const friends = data?.map(f => ({
        id: f.friend.id,
        username: f.friend.username,
        gender: f.friend.gender,
        created_at: f.friend.created_at,
        friendship_created: f.created_at,
        isOnline: false, // Will be updated by presence
        unread_count: 0  // Will be updated by message system
      })) || [];

      console.log(`📋 Found ${friends.length} friends`);
      return friends;
    } catch (error) {
      console.error('Error getting friends:', error);
      return [];
    }
  },

  /**
   * Search users by username (for adding friends)
   */
  async searchUsers(query, currentUserId) {
    console.log('🔍 Searching users:', query);
    
    try {
      // Search for users matching the query (case insensitive)
      const { data, error } = await supabase
        .from('users')
        .select('id, username, gender, email')
        .ilike('username', `%${query}%`)
        .neq('id', currentUserId) // Exclude current user
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        throw error;
      }

      // Get current user's friends to exclude them from results
      const friends = await this.getFriends(currentUserId);
      const friendIds = friends.map(f => f.id);

      // Filter out existing friends
      const filteredResults = data?.filter(user => !friendIds.includes(user.id)) || [];

      console.log(`🔍 Found ${filteredResults.length} search results`);
      return filteredResults.map(user => ({
        ...user,
        isOnline: false // Will be updated by presence if needed
      }));
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  },

  /**
   * Subscribe to friend status using Supabase Presence
   */
  subscribeToFriendStatus(userId, onStatusChange) {
    console.log('📡 Subscribing to friend presence for user:', userId);
    
    const channel = supabase.channel(`friend_presence_${userId}`, {
      config: {
        presence: { key: userId.toString() }
      }
    });

    // Subscribe to presence changes
    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        console.log('👥 Presence state synced:', presenceState);
        
        if (onStatusChange) {
          onStatusChange(presenceState);
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 User joined:', key, newPresences);
        
        if (onStatusChange) {
          const presenceState = channel.presenceState();
          onStatusChange(presenceState);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 User left:', key, leftPresences);
        
        if (onStatusChange) {
          const presenceState = channel.presenceState();
          onStatusChange(presenceState);
        }
      })
      .subscribe(async (status) => {
        console.log('📡 Presence subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          // Track current user's presence
          const trackStatus = await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            status: 'online'
          });
          console.log('📍 Tracking presence:', trackStatus);
        }
      });

    return channel;
  },

  /**
   * Remove friend (bidirectional)
   */
  async removeFriend(userId, friendId) {
    console.log('💔 Removing friend:', { userId, friendId });
    
    try {
      // Remove bidirectional friendship
      const { error } = await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (error) {
        console.error('Error removing friendship:', error);
        throw error;
      }

      console.log('✅ Friendship removed successfully');
      return { success: true };
    } catch (error) {
      console.error('Error removing friend:', error);
      throw error;
    }
  },

  /**
   * Check if users are friends
   */
  async areFriends(userId, friendId) {
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking friendship:', error);
      return false;
    }
  },

  /**
   * Subscribe to friends table changes for real-time updates
   */
  subscribeToFriendsUpdates(userId, onFriendsChanged) {
    console.log('📡 Subscribing to friends updates for user:', userId);
    
    const channel = supabase
      .channel('friends_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('👥 Friends table changed:', payload);
        
        if (onFriendsChanged) {
          onFriendsChanged(payload);
        }
      })
      .subscribe((status) => {
        console.log('📡 Friends updates subscription status:', status);
      });

    return channel;
  },

  /**
   * Get friend's online status from presence
   */
  async getFriendStatus(friendId) {
    try {
      // This would integrate with the presence system
      // For now, return offline as default
      return {
        isOnline: false,
        lastSeen: null
      };
    } catch (error) {
      console.error('Error getting friend status:', error);
      return {
        isOnline: false,
        lastSeen: null
      };
    }
  }
};

// Export individual functions for easier testing
export const {
  addFriend,
  addFriendById,
  getFriends,
  searchUsers,
  subscribeToFriendStatus,
  removeFriend,
  areFriends,
  subscribeToFriendsUpdates,
  getFriendStatus
} = friendsService;
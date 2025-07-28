// services/matching.js - Supabase Realtime Matching Service
import { supabase } from './supabase';

// Logging helper for structured logs
const log = {
  info: (message, data = {}) => {
    console.log(`[MatchingService] ℹ️ ${message}`, data);
  },
  success: (message, data = {}) => {
    console.log(`[MatchingService] ✅ ${message}`, data);
  },
  error: (message, error = {}, data = {}) => {
    console.error(`[MatchingService] ❌ ${message}`, { error, ...data });
  },
  warning: (message, data = {}) => {
    console.warn(`[MatchingService] ⚠️ ${message}`, data);
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MatchingService] 🔍 ${message}`, data);
    }
  }
};

export class MatchingService {
  constructor(userId, onMatchFound, onPhaseChanged) {
    this.userId = userId;
    this.onMatchFound = onMatchFound;
    this.onPhaseChanged = onPhaseChanged;
    this.matchChannel = null;
    this.chatChannel = null;
    this.currentMatchId = null;
    this.searchInterval = null;
    this.phaseTimeout = null;
    this.botTimeout = null;
    this.currentPreferences = null;
    this.searchPhase = 'interests'; // 'interests' or 'gender-only'
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
    this.connectionCheckInterval = null;
    this.lastActivityTime = Date.now();
    this.isRetrying = false;
  }

  /**
   * Start finding a match with given preferences
   */
  async findMatch(preferences) {
    console.log('🔍 Starting match search with preferences:', preferences);
    
    this.currentPreferences = preferences;
    this.searchPhase = preferences.interests && preferences.interests.trim() ? 'interests' : 'gender-only';
    
    try {
      // Add user to waiting pool
      const { data: waitingData, error: waitingError } = await supabase
        .from('waiting_pool')
        .insert({
          user_id: this.userId,
          preferences: {
            userGender: preferences.userGender,
            lookingFor: preferences.lookingFor,
            interests: preferences.interests,
            searchDuration: preferences.searchDuration,
            searchPhase: this.searchPhase
          }
        })
        .select()
        .single();

      if (waitingError) {
        console.error('Error adding to waiting pool:', waitingError);
        throw waitingError;
      }

      console.log('✅ Added to waiting pool:', waitingData);

      // Subscribe to match notifications
      await this.subscribeToMatches();

      // First check for existing active matches
      const existingMatch = await this.checkForExistingMatches();
      if (existingMatch) {
        console.log('🎯 Found existing active match, proceeding to chat:', existingMatch);
        this.handleMatchFound(existingMatch);
        return;
      }

      // Start checking for matches immediately
      await this.checkForMatch();

      // Set up phase transition if interests are provided
      if (this.searchPhase === 'interests' && preferences.searchDuration !== '∞') {
        this.setupPhaseTransition(preferences.searchDuration);
      }

      // Set up periodic matching checks
      this.searchInterval = setInterval(() => {
        this.checkForMatch();
      }, 3000); // Check every 3 seconds

      // Set up bot timeout - trigger bot matching after 60 seconds
      this.botTimeout = setTimeout(() => {
        this.triggerBotMatch();
      }, 60000); // 60 seconds

    } catch (error) {
      console.error('Error starting match search:', error);
      throw error;
    }
  }

  /**
   * Subscribe to matches table changes
   */
  async subscribeToMatches() {
    if (this.matchChannel) {
      await this.matchChannel.unsubscribe();
    }

    this.matchChannel = supabase
      .channel('matches')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `user1_id=eq.${this.userId}`
      }, (payload) => {
        console.log('🎉 Match found via Realtime (as user1):', payload.new);
        this.lastActivityTime = Date.now();
        this.handleMatchFound(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `user2_id=eq.${this.userId}`
      }, (payload) => {
        console.log('🎉 Match found via Realtime (as user2):', payload.new);
        this.lastActivityTime = Date.now();
        this.handleMatchFound(payload.new);
      })
      .subscribe((status) => {
        console.log('Match subscription status:', status);
        if (status === 'SUBSCRIBED') {
          this.connectionRetries = 0;
          this.retryDelay = 1000;
          this.startConnectionMonitoring();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('Match subscription error:', status);
          // Only handle error if not already retrying
          if (!this.isRetrying) {
            this.handleConnectionError();
          }
        }
      });
  }

  /**
   * Start monitoring the connection health
   */
  startConnectionMonitoring() {
    // Clear any existing interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Check connection every 30 seconds
    this.connectionCheckInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      // If no activity for more than 60 seconds, check connection
      if (timeSinceLastActivity > 60000) {
        console.log('🔍 Checking connection health...');
        this.checkConnectionHealth();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Check if the connection is still healthy
   */
  async checkConnectionHealth() {
    try {
      // Try to update the waiting pool last_activity timestamp
      const { error } = await supabase
        .from('waiting_pool')
        .update({ last_activity: new Date().toISOString() })
        .eq('user_id', this.userId);

      if (error) {
        console.error('Connection health check failed:', error);
        this.handleConnectionError();
      } else {
        console.log('✅ Connection healthy');
        this.lastActivityTime = Date.now();
      }
    } catch (error) {
      console.error('Connection health check error:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Handle connection errors with exponential backoff
   */
  async handleConnectionError() {
    // Prevent multiple retry loops
    if (this.isRetrying) {
      return;
    }
    
    if (this.connectionRetries >= this.maxRetries) {
      console.error('❌ Max connection retries reached. Giving up.');
      this.cleanup();
      return;
    }

    this.isRetrying = true;
    this.connectionRetries++;
    console.log(`🔄 Attempting reconnection ${this.connectionRetries}/${this.maxRetries} in ${this.retryDelay}ms...`);

    setTimeout(async () => {
      try {
        // Unsubscribe from existing channels
        if (this.matchChannel) {
          await this.matchChannel.unsubscribe();
          this.matchChannel = null;
        }
        if (this.chatChannel) {
          await this.chatChannel.unsubscribe();
          this.chatChannel = null;
        }

        // Re-subscribe to matches
        await this.subscribeToMatches();

        // Re-setup chat channel if we have an active match
        if (this.currentMatchId) {
          await this.setupChatChannel(this.currentMatchId);
        }

        console.log('✅ Reconnection successful');
        this.isRetrying = false;
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.retryDelay = Math.min(this.retryDelay * 2, 30000); // Max 30 seconds
        this.isRetrying = false;
        // Use setTimeout to avoid stack overflow
        setTimeout(() => this.handleConnectionError(), 100);
      }
    }, this.retryDelay);
  }

  /**
   * Check for existing active matches
   */
  async checkForExistingMatches() {
    try {
      console.log('🔍 Checking for existing active matches...');
      
      // With the new schema, both user1_id and user2_id are UUID columns
      // We need to check if the user is in either position
      const { data: existingMatches, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)
        .eq('state', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking for existing matches:', error);
        return null;
      }

      if (existingMatches && existingMatches.length > 0) {
        console.log('✅ Found existing active match:', existingMatches[0]);
        return existingMatches[0];
      }

      console.log('ℹ️ No existing active matches found');
      return null;
    } catch (error) {
      console.error('Error in checkForExistingMatches:', error);
      return null;
    }
  }

  /**
   * Check for potential matches in waiting pool
   */
  async checkForMatch() {
    try {
      // Get current user's waiting pool entry
      const { data: myEntry, error: myError } = await supabase
        .from('waiting_pool')
        .select('*, users(*)')
        .eq('user_id', this.userId)
        .single();

      if (myError || !myEntry) {
        console.log('User not in waiting pool, checking for active match...');
        
        // Double-check for existing matches before cleanup
        const existingMatch = await this.checkForExistingMatches();
        if (existingMatch) {
          console.log('🎯 Found existing match during checkForMatch:', existingMatch);
          this.handleMatchFound(existingMatch);
          this.cleanup();
          return;
        }
        
        console.log('No active match found, stopping search');
        this.cleanup();
        return;
      }

      // Find compatible users
      const { data: candidates, error: candidatesError } = await supabase
        .from('waiting_pool')
        .select('*, users(*)')
        .neq('user_id', this.userId);

      if (candidatesError) {
        console.error('Error fetching candidates:', candidatesError);
        return;
      }

      console.log(`🔍 Checking ${candidates?.length || 0} candidates for compatibility`);

      // Check each candidate for compatibility
      for (const candidate of candidates || []) {
        if (this.isCompatible(myEntry, candidate)) {
          console.log('✅ Compatible match found:', candidate.users.username);
          await this.createMatch(candidate.user_id, candidate.users);
          return;
        }
      }

      console.log('No compatible matches found this round');
    } catch (error) {
      console.error('Error checking for matches:', error);
    }
  }

  /**
   * Check if two users are compatible
   */
  isCompatible(user1, user2) {
    const prefs1 = user1.preferences;
    const prefs2 = user2.preferences;

    // Basic gender compatibility
    const genderMatch = 
      (prefs1.lookingFor === 'both' || prefs1.lookingFor === user2.users.gender) &&
      (prefs2.lookingFor === 'both' || prefs2.lookingFor === user1.users.gender);

    if (!genderMatch) {
      return false;
    }

    // If both users are in interests phase, check for common interests
    if (prefs1.searchPhase === 'interests' && prefs2.searchPhase === 'interests') {
      const interests1 = prefs1.interests ? prefs1.interests.toLowerCase().split(',').map(i => i.trim()) : [];
      const interests2 = prefs2.interests ? prefs2.interests.toLowerCase().split(',').map(i => i.trim()) : [];
      
      if (interests1.length > 0 && interests2.length > 0) {
        const hasCommonInterests = interests1.some(i => interests2.includes(i));
        return hasCommonInterests;
      }
    }

    // If at least one user is in gender-only phase, they can match
    return prefs1.searchPhase === 'gender-only' || prefs2.searchPhase === 'gender-only';
  }

  /**
   * Create a match between two users
   */
  async createMatch(partnerId, partnerInfo) {
    try {
      console.log('🔄 Creating match with atomic function...');
      
      // Use the atomic match creation function
      const { data: matchData, error: matchError } = await supabase
        .rpc('create_match_atomic', {
          p_user1_id: this.userId,
          p_user2_id: partnerId,
          p_is_bot: false,
          p_bot_id: null,
          p_bot_profile: null
        });

      if (matchError) {
        console.error('Error creating match:', matchError);
        
        // If it's a unique constraint violation, try to find the existing match
        if (matchError.code === '23505' || matchError.message?.includes('duplicate')) {
          console.log('🔄 Match already exists, fetching existing match...');
          
          // Query for existing active match
          const { data: existingMatches, error: fetchError } = await supabase
            .from('matches')
            .select('*')
            .or(`and(user1_id.eq.${this.userId},user2_id.eq.${partnerId}),and(user1_id.eq.${partnerId},user2_id.eq.${this.userId})`)
            .eq('state', 'active');
          
          if (!fetchError && existingMatches && existingMatches.length > 0) {
            console.log('✅ Found existing match:', existingMatches[0]);
            this.handleMatchFound(existingMatches[0], partnerInfo);
            return;
          }
        }
        
        throw matchError;
      }

      if (!matchData) {
        console.error('No match data returned from atomic function');
        return;
      }

      console.log('✅ Match created successfully with atomic function:', matchData);
      
      // The match creation will trigger the Realtime subscription
      // but we can also handle it directly here as a fallback
      this.handleMatchFound(matchData, partnerInfo);

    } catch (error) {
      console.error('Error in createMatch:', error);
      
      // Attempt to clean up waiting pool on error
      try {
        await supabase
          .from('waiting_pool')
          .delete()
          .eq('user_id', this.userId);
        console.log('✅ Cleaned up waiting pool after error');
      } catch (cleanupError) {
        console.error('Error cleaning up waiting pool:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Handle when a match is found
   */
  async handleMatchFound(matchData, partnerInfo = null) {
    console.log('🎉 Processing match found:', matchData);
    
    // Prevent duplicate processing
    if (this.currentMatchId === matchData.id) {
      console.log('Match already being processed, skipping duplicate');
      return;
    }
    
    this.currentMatchId = matchData.id;
    
    // Determine partner ID - handle both UUID and TEXT user2_id
    let partnerId;
    if (matchData.user1_id === this.userId || matchData.user1_id === this.userId.toString()) {
      partnerId = matchData.user2_id;
    } else {
      partnerId = matchData.user1_id;
    }
    
    // Handle bot matches
    if (matchData.is_bot && matchData.bot_id) {
      partnerId = matchData.bot_id;
      partnerInfo = matchData.bot_profile || {
        id: matchData.bot_id,
        username: matchData.bot_profile?.username || 'Bot',
        isBot: true
      };
    }
    
    // If partner info not provided and not a bot, fetch it
    if (!partnerInfo && !matchData.is_bot && partnerId) {
      const { data: partner, error: partnerError } = await supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (partnerError) {
        console.error('Error fetching partner info:', partnerError);
        // Try to continue without full partner info
        partnerInfo = { id: partnerId, username: 'Unknown User' };
      } else {
        partnerInfo = partner;
      }
    }

    // Clean up search
    this.cleanup();

    // Set up chat channel for this match
    await this.setupChatChannel(matchData.id);

    // Notify the UI
    if (this.onMatchFound) {
      this.onMatchFound({
        matchId: matchData.id,
        partnerId: partnerId,
        partnerUsername: partnerInfo?.username || 'Unknown',
        partner: partnerInfo
      });
    }
  }

  /**
   * Set up phase transition timeout
   */
  setupPhaseTransition(duration) {
    const durationMs = this.parseDuration(duration);
    
    if (durationMs > 0) {
      this.phaseTimeout = setTimeout(() => {
        this.transitionToGenderOnlyPhase();
      }, durationMs);
    }
  }

  /**
   * Parse duration string to milliseconds
   */
  parseDuration(duration) {
    switch (duration) {
      case '15s': return 15 * 1000;
      case '30s': return 30 * 1000;
      case '1min': return 60 * 1000;
      case '∞': return 0; // Infinite
      default: return 30 * 1000; // Default 30s
    }
  }

  /**
   * Transition from interests phase to gender-only phase
   */
  async transitionToGenderOnlyPhase() {
    if (this.searchPhase === 'gender-only') return;

    console.log('🔄 Transitioning to gender-only search phase');
    
    this.searchPhase = 'gender-only';

    try {
      // Update waiting pool entry
      await supabase
        .from('waiting_pool')
        .update({
          preferences: {
            ...this.currentPreferences,
            searchPhase: 'gender-only'
          }
        })
        .eq('user_id', this.userId);

      // Notify UI of phase change
      if (this.onPhaseChanged) {
        this.onPhaseChanged({ phase: 'gender-only' });
      }

      console.log('✅ Transitioned to gender-only phase');
    } catch (error) {
      console.error('Error transitioning search phase:', error);
    }
  }

  /**
   * Set up chat channel for real-time messaging
   * NOTE: Disabled in favor of ChatService handling all chat subscriptions
   */
  async setupChatChannel(matchId) {
    // Commenting out to prevent duplicate subscriptions
    // ChatService now handles all chat-related real-time subscriptions
    console.log('📌 Chat channel setup delegated to ChatService for match:', matchId);
    
    /* Original code commented out to prevent conflicts
    if (this.chatChannel) {
      await this.chatChannel.unsubscribe();
    }

    this.chatChannel = supabase
      .channel(`chat:${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        console.log('📨 New message via Realtime:', payload.new);
        this.lastActivityTime = Date.now();
        this.handleNewMessage(payload.new);
      })
      .subscribe((status) => {
        console.log('Chat subscription status:', status);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('Chat subscription error:', status);
          // Only handle error if not already retrying
          if (!this.isRetrying) {
            this.handleConnectionError();
          }
        }
      });
    */
  }

  /**
   * Handle new incoming messages
   */
  handleNewMessage(message) {
    // Only handle messages from partner (not our own)
    if (message.sender_id !== this.userId) {
      // Emit a custom event that MainPage can listen to
      window.dispatchEvent(new CustomEvent('supabase-message', {
        detail: {
          text: message.content,
          timestamp: new Date(message.created_at).getTime(),
          from: message.sender_id,
          isMine: false
        }
      }));
    }
  }

  /**
   * Send a message in the current match
   */
  async sendMessage(messageText) {
    if (!this.currentMatchId) {
      console.error('No active match to send message to');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          match_id: this.currentMatchId,
          sender_id: this.userId,
          content: messageText
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      console.log('✅ Message sent:', data);
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Skip/end current match
   */
  async skipMatch() {
    if (!this.currentMatchId) {
      console.log('No active match to skip');
      return;
    }

    try {
      // Update match to mark it as ended with proper state
      await supabase
        .from('matches')
        .update({ 
          ended_at: new Date().toISOString(),
          state: 'ended'
        })
        .eq('id', this.currentMatchId);

      console.log('✅ Match ended');
      
      // Clean up
      this.cleanup();
      
    } catch (error) {
      console.error('Error ending match:', error);
    }
  }

  /**
   * Trigger bot matching after 60 seconds
   */
  async triggerBotMatch() {
    console.log('🤖 Triggering bot match after 60 seconds timeout');
    
    try {
      // Generate bot profile directly
      const botProfile = this.generateBotProfile();
      console.log('🤖 Generated bot profile:', botProfile);

      // Create bot match using atomic function
      const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: matchData, error: matchError } = await supabase
        .rpc('create_match_atomic', {
          p_user1_id: this.userId,
          p_user2_id: null,  // NULL for bot matches
          p_is_bot: true,
          p_bot_id: botId,
          p_bot_profile: botProfile
        });

      if (matchError) {
        console.error('Error creating bot match:', matchError);
        
        // Clean up waiting pool on error
        await supabase
          .from('waiting_pool')
          .delete()
          .eq('user_id', this.userId);
        
        return;
      }

      if (!matchData) {
        console.error('No match data returned from bot match creation');
        return;
      }

      console.log('✅ Bot match created successfully:', matchData);

      // Send initial bot message
      const conversationStarter = this.generateConversationStarter(botProfile);
      
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          match_id: matchData.id,
          sender_id: botId,
          content: conversationStarter,
          is_bot: true,
          created_at: new Date().toISOString()
        });

      if (messageError) {
        console.error('Error sending bot welcome message:', messageError);
      } else {
        console.log('💬 Bot welcome message sent:', conversationStarter);
      }

      // Handle the bot match as if it was a regular match
      this.handleMatchFound(matchData, {
        id: botId,
        username: botProfile.username,
        gender: 'female',
        isBot: true,
        botProfile: botProfile
      });
      
    } catch (error) {
      console.error('Error triggering bot match:', error);
      
      // Ensure cleanup happens
      try {
        await supabase
          .from('waiting_pool')
          .delete()
          .eq('user_id', this.userId);
      } catch (cleanupError) {
        console.error('Error cleaning up after bot match failure:', cleanupError);
      }
    }
  }

  /**
   * Generate bot profile (moved from Edge Function)
   */
  generateBotProfile() {
    const indianFemaleNames = [
      'Priya', 'Neha', 'Kavya', 'Ananya', 'Shreya', 'Pooja', 'Divya', 'Riya', 
      'Meera', 'Sneha', 'Aditi', 'Nisha', 'Swati', 'Ritika', 'Sakshi'
    ];
    
    const cities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 
      'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Surat'
    ];
    
    const interests = [
      'movies', 'music', 'books', 'travel', 'cooking', 'dancing', 'photography', 
      'art', 'yoga', 'fitness', 'technology', 'fashion', 'cricket', 'bollywood'
    ];
    
    const name = indianFemaleNames[Math.floor(Math.random() * indianFemaleNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const userInterests = interests
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 2)
      .join(', ');
    
    return {
      username: `${name.toLowerCase()}${Math.floor(Math.random() * 999) + 100}`,
      displayName: name,
      city: city,
      interests: userInterests,
      personality: 'friendly',
      responseStyle: 'casual',
      language: 'hinglish'
    };
  }

  /**
   * Generate conversation starter for bot
   */
  generateConversationStarter(botProfile) {
    const starters = [
      `Hi! I'm ${botProfile.displayName} from ${botProfile.city} 👋`,
      `Hey there! Nice to meet you! I'm ${botProfile.displayName} 😊`,
      `Hello! I'm ${botProfile.displayName}. How's your day going? ✨`,
      `Hi! ${botProfile.displayName} here from ${botProfile.city}. What brings you to chat today? 💬`,
      `Hey! I'm ${botProfile.displayName}. Love chatting with new people! 🌟`
    ];
    
    return starters[Math.floor(Math.random() * starters.length)];
  }

  /**
   * Cancel search and clean up
   */
  async cancelSearch() {
    console.log('❌ Cancelling search');
    
    try {
      // Remove from waiting pool
      await supabase
        .from('waiting_pool')
        .delete()
        .eq('user_id', this.userId);

      console.log('✅ Removed from waiting pool');
    } catch (error) {
      console.error('Error removing from waiting pool:', error);
    }

    this.cleanup();
  }

  /**
   * Clean up intervals, timeouts, and subscriptions
   */
  cleanup() {
    if (this.searchInterval) {
      clearInterval(this.searchInterval);
      this.searchInterval = null;
    }

    if (this.phaseTimeout) {
      clearTimeout(this.phaseTimeout);
      this.phaseTimeout = null;
    }

    if (this.botTimeout) {
      clearTimeout(this.botTimeout);
      this.botTimeout = null;
    }

    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    if (this.matchChannel) {
      this.matchChannel.unsubscribe();
      this.matchChannel = null;
    }
  }

  /**
   * Clean up chat channel
   */
  async cleanupChat() {
    // ChatService now handles chat channel cleanup
    /* Original code commented out
    if (this.chatChannel) {
      await this.chatChannel.unsubscribe();
      this.chatChannel = null;
    }
    */
    this.currentMatchId = null;
  }

  /**
   * Destroy the service completely
   */
  async destroy() {
    console.log('🧹 Destroying MatchingService');
    await this.cancelSearch();
    await this.cleanupChat();
  }
}
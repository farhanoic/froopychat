// services/matching.js - Supabase Realtime Matching Service
import { supabase } from './supabase';

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
    this.currentPreferences = null;
    this.searchPhase = 'interests'; // 'interests' or 'gender-only'
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
        filter: `user1_id=eq.${this.userId},user2_id=eq.${this.userId}`
      }, (payload) => {
        console.log('🎉 Match found via Realtime:', payload.new);
        this.handleMatchFound(payload.new);
      })
      .subscribe((status) => {
        console.log('Match subscription status:', status);
      });
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
        console.log('User not in waiting pool, stopping search');
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
      // Remove both users from waiting pool first
      await supabase
        .from('waiting_pool')
        .delete()
        .in('user_id', [this.userId, partnerId]);

      // Create match record
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          user1_id: this.userId,
          user2_id: partnerId
        })
        .select()
        .single();

      if (matchError) {
        console.error('Error creating match:', matchError);
        throw matchError;
      }

      console.log('✅ Match created successfully:', matchData);
      
      // The match creation will trigger the Realtime subscription
      // but we can also handle it directly here as a fallback
      this.handleMatchFound(matchData, partnerInfo);

    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  }

  /**
   * Handle when a match is found
   */
  async handleMatchFound(matchData, partnerInfo = null) {
    console.log('🎉 Processing match found:', matchData);
    
    this.currentMatchId = matchData.id;
    
    // Determine partner ID and info
    const partnerId = matchData.user1_id === this.userId ? matchData.user2_id : matchData.user1_id;
    
    // If partner info not provided, fetch it
    if (!partnerInfo) {
      const { data: partner, error: partnerError } = await supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (partnerError) {
        console.error('Error fetching partner info:', partnerError);
        return;
      }
      partnerInfo = partner;
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
        partnerUsername: partnerInfo.username,
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
   */
  async setupChatChannel(matchId) {
    if (this.chatChannel) {
      await this.chatChannel.unsubscribe();
    }

    this.chatChannel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        console.log('📨 New message via Realtime:', payload.new);
        this.handleNewMessage(payload.new);
      })
      .subscribe((status) => {
        console.log('Chat subscription status:', status);
      });
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
      // Update match to mark it as ended
      await supabase
        .from('matches')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', this.currentMatchId);

      console.log('✅ Match ended');
      
      // Clean up
      this.cleanup();
      
    } catch (error) {
      console.error('Error ending match:', error);
    }
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

    if (this.matchChannel) {
      this.matchChannel.unsubscribe();
      this.matchChannel = null;
    }
  }

  /**
   * Clean up chat channel
   */
  async cleanupChat() {
    if (this.chatChannel) {
      await this.chatChannel.unsubscribe();
      this.chatChannel = null;
    }
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
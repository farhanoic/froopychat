// services/chat.js - Realtime Chat Service for Froopy Chat
import { supabase } from './supabase';

export class ChatService {
  constructor(matchId, userId, onMessage) {
    this.matchId = matchId;
    this.userId = userId;
    this.onMessage = onMessage;
    this.channel = null;
    this.typingTimeout = null;
  }

  /**
   * Initialize chat service - load existing messages and subscribe to new ones
   */
  async initialize() {
    console.log('🚀 Initializing ChatService for match:', this.matchId);
    
    try {
      // Load existing messages from this match
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', this.matchId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error loading existing messages:', messagesError);
        throw messagesError;
      }

      // Send existing messages to UI
      messages?.forEach(msg => {
        this.onMessage({
          text: msg.content,
          sender: msg.sender_id === this.userId ? 'user' : 'partner',
          timestamp: new Date(msg.created_at).getTime(),
          isMine: msg.sender_id === this.userId
        });
      });

      console.log(`📚 Loaded ${messages?.length || 0} existing messages`);

      // Subscribe to new messages
      await this.subscribeToMessages();

      // Subscribe to typing indicators
      await this.subscribeToTyping();

    } catch (error) {
      console.error('Error initializing ChatService:', error);
      throw error;
    }
  }

  /**
   * Subscribe to new messages for this match
   */
  async subscribeToMessages() {
    this.channel = supabase
      .channel(`chat:${this.matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${this.matchId}`
        },
        (payload) => {
          console.log('📨 New message received:', payload.new);
          const msg = payload.new;
          
          // Only handle messages from partner (not our own)
          if (msg.sender_id !== this.userId) {
            this.onMessage({
              text: msg.content,
              sender: 'partner',
              timestamp: new Date(msg.created_at).getTime(),
              isMine: false
            });
          }
        }
      );

    // Subscribe to the channel
    const subscriptionStatus = await this.channel.subscribe();
    console.log('📡 Message subscription status:', subscriptionStatus);

    return subscriptionStatus;
  }

  /**
   * Subscribe to typing indicators using broadcast
   */
  async subscribeToTyping() {
    if (!this.channel) {
      console.error('No channel available for typing indicators');
      return;
    }

    // Add typing broadcast listeners to existing channel
    this.channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        console.log('⌨️ Partner is typing:', payload);
        if (payload.payload?.userId !== this.userId) {
          // Emit typing event for UI
          window.dispatchEvent(new CustomEvent('partner-typing', {
            detail: { isTyping: true }
          }));
        }
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        console.log('✋ Partner stopped typing:', payload);
        if (payload.payload?.userId !== this.userId) {
          // Emit stop typing event for UI
          window.dispatchEvent(new CustomEvent('partner-typing', {
            detail: { isTyping: false }
          }));
        }
      });
  }

  /**
   * Send a message in this match
   */
  async sendMessage(text) {
    if (!text || !text.trim()) {
      console.log('Empty message, not sending');
      return;
    }

    const messageText = text.trim();
    console.log('📤 Sending message:', messageText);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          match_id: this.matchId,
          sender_id: this.userId,
          content: messageText
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      console.log('✅ Message sent successfully:', data);
      return data;

    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Start typing indicator
   */
  startTyping() {
    if (!this.channel) return;

    console.log('⌨️ Starting typing indicator');
    this.channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: this.userId }
    });
  }

  /**
   * Stop typing indicator
   */
  stopTyping() {
    if (!this.channel) return;

    console.log('✋ Stopping typing indicator');
    this.channel.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { userId: this.userId }
    });
  }

  /**
   * Handle typing with automatic timeout
   */
  handleTyping() {
    // Start typing if not already typing
    this.startTyping();

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Stop typing after 2 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  /**
   * End chat and clean up
   */
  async endChat() {
    console.log('🔚 Ending chat for match:', this.matchId);

    try {
      // Mark match as ended
      const { error: updateError } = await supabase
        .from('matches')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', this.matchId);

      if (updateError) {
        console.error('Error ending match:', updateError);
      }

      // Clean up
      await this.cleanup();

    } catch (error) {
      console.error('Error ending chat:', error);
    }
  }

  /**
   * Clean up subscriptions and timeouts
   */
  async cleanup() {
    console.log('🧹 Cleaning up ChatService');

    // Clear typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    // Unsubscribe from channel
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }

  /**
   * Get chat statistics
   */
  async getChatStats() {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('match_id', this.matchId);

      if (error) {
        console.error('Error getting chat stats:', error);
        return { messageCount: 0 };
      }

      return {
        messageCount: data?.length || 0
      };
    } catch (error) {
      console.error('Error getting chat stats:', error);
      return { messageCount: 0 };
    }
  }
}
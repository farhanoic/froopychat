import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContextSupabase';
import { MatchingService } from '../services/matching';
import { ChatService } from '../services/chat';
import { friendsService } from '../services/friends';
import { supabase } from '../services/supabase';
import FriendsSheet from './FriendsSheet';

// View components
function PreferencesView({ onPreferenceSelect, interests, setInterests, selectedDuration, setSelectedDuration, durations, getDurationButtonClass }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4">
      <div className="w-full max-w-xs space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl text-white">I want to chat with</h2>
        </div>
        
        {/* Gender preference buttons */}
        <div className="space-y-4">
          <button 
            onClick={() => onPreferenceSelect('male')}
            className="w-full min-h-[48px] bg-white/10 rounded-full hover:bg-white/20 
                       transition-colors text-white font-medium"
          >
            Male
          </button>
          <button 
            onClick={() => onPreferenceSelect('female')}
            className="w-full min-h-[48px] bg-white/10 rounded-full hover:bg-white/20 
                       transition-colors text-white font-medium"
          >
            Female
          </button>
          <button 
            onClick={() => onPreferenceSelect('both')}
            className="w-full min-h-[48px] bg-blue-600 rounded-full hover:bg-blue-700 
                       transition-colors text-white font-medium"
          >
            Both
          </button>
        </div>
        
        {/* Interest input field */}
        <div className="space-y-2">
          <input
            type="text"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="Interests (optional): gaming, music..."
            className="w-full min-h-[48px] px-4 py-3 bg-gray-800 text-white rounded-full 
                       placeholder-gray-500 focus:outline-none focus:ring-2 
                       focus:ring-blue-500 transition-colors"
            style={{ fontSize: '16px' }}
            maxLength={100}
          />
        </div>

        {/* Duration selector */}
        <div className="space-y-3">
          <p className="text-gray-400 text-sm text-center">Search duration:</p>
          <div className="flex gap-2 justify-center">
            {durations.map(duration => (
              <button
                key={duration}
                onClick={() => setSelectedDuration(duration)}
                className={`${getDurationButtonClass(duration)} min-h-[44px] min-w-[60px]`}
                type="button"
              >
                {duration}
              </button>
            ))}
          </div>
          <p className="text-gray-500 text-xs text-center leading-relaxed">
            {selectedDuration === '∞' 
              ? 'Search indefinitely for interest matches' 
              : `Search ${selectedDuration} for interests, then expand to all`}
          </p>
        </div>
      </div>
    </div>
  );
}

function SearchingView({ onCancel, interests, selectedDuration, searchPhase }) {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Timer useEffect - increment every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000); // Increment every second
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []); // Empty deps - run once on mount
  
  // Format timer display function
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Remove the useEffect with setTimeout - using real socket matching now
  
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4">
      <div className="text-center">
        {/* Animated spinner */}
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent 
                        rounded-full animate-spin mx-auto"></div>
        </div>
        
        {/* Timer display */}
        <p className="text-gray-400 mb-6">Searching for {formatTime(elapsedTime)}</p>
        
        {/* Phase indicator */}
        <div className="mb-6 transition-all duration-500">
          {interests && interests.trim() ? (
            // User has interests
            searchPhase === 'interests' ? (
              <div className="space-y-2 transform transition-all duration-500 scale-100">
                <p className="text-white text-lg flex items-center justify-center gap-2">
                  <span>Looking for shared interests</span>
                  <span className="text-2xl animate-pulse">🎯</span>
                </p>
                <p className="text-gray-500 text-sm">
                  {selectedDuration === '∞' ? 'Searching indefinitely' : `Phase 1 of 2 • ${selectedDuration} remaining`}
                </p>
                <p className="text-gray-600 text-xs">
                  Interests: {interests}
                </p>
              </div>
            ) : (
              <div className="space-y-2 transform transition-all duration-500 scale-100">
                <p className="text-white text-lg flex items-center justify-center gap-2">
                  <span>Expanding search</span>
                  <span className="text-2xl animate-pulse">🌍</span>
                </p>
                <p className="text-gray-500 text-sm">
                  Phase 2 of 2 • Looking for anyone compatible
                </p>
              </div>
            )
          ) : (
            // User has no interests
            <p className="text-white text-lg">
              Finding someone for you...
            </p>
          )}
        </div>
        
        <button 
          onClick={onCancel}
          className="bg-white/10 px-6 py-3 rounded-full hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ChattingView({ messages, onSkip, onSendMessage, isPartnerTyping, partnerUsername, currentUsername, getAvatarUrl, getUserAvatar, handleContextMenu, addedFriends, _partner, chatMode = 'random', activeFriendInfo, activeFriendId, showToastMessage, chatService }) {
  const [input, setInput] = useState('');
  const [isSkipping, setIsSkipping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  const chatContainerRef = useRef(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when entering chat
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        if (chatMode === 'random' && chatService) {
          chatService.stopTyping();
        }
        // Note: Friend typing will be implemented with Supabase in future phase
      }
    };
  }, [isTyping, chatMode, chatService, activeFriendId]);


  // Format timestamp helper
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Typing handler function
  const handleTyping = () => {
    if (chatMode === 'random' && chatService) {
      // Use ChatService for random chat typing
      chatService.handleTyping();
    }
    // Note: Friend chat typing will be implemented with Supabase in future phase
  };
  
  const sendMessage = () => {
    // Stop typing when sending
    if (chatMode === 'random' && chatService) {
      chatService.stopTyping();
    }
    // Note: Friend chat typing will be implemented with Supabase in future phase

    const trimmedInput = input.trim();
    if (!trimmedInput) return;
    
    if (trimmedInput.length > 500) {
      alert('Message too long! Keep it under 500 characters.');
      return;
    }
    
    const message = {
      text: trimmedInput,
      timestamp: Date.now()
    };
    
    onSendMessage(message);
    setInput('');
  };

  const handleSkip = () => {
    // Clear typing state
    if (chatMode === 'random' && chatService) {
      chatService.stopTyping();
    }
    // Note: Friend chat typing will be implemented with Supabase in future phase
    setIsSkipping(true);
    onSkip();
  };

  // Simple add friend handler for ChattingView
  const handleAddFriendInChat = () => {
    // Don't allow adding bot as friend
    if (!partnerUsername || partnerUsername === 'bot') {
      return;
    }
    
    // Don't allow if already added this session
    if (addedFriends.has(_partner)) {
      showToastMessage('Already added as friend!', 'tangerine');
      return;
    }
    
    // Call the main handleAddFriend function
    handleAddFriend({
      partnerId: _partner,
      partnerUsername: partnerUsername
    });
  };


  return (
    <div 
      ref={chatContainerRef}
      className="relative flex flex-col h-screen bg-dark-navy" 
      style={{ 
        height: '100dvh'
      }}
    >
      
      {/* Chat header with centered username and skip button - no avatar */}
      <div className="relative flex items-center justify-center p-4 border-b border-white/10">
        {/* Center: Username and status - centered without avatar */}
        <div className="text-center flex-1">
          <div className="flex items-center gap-2 justify-center">
            <h2 className="text-white font-semibold select-none truncate">
              {partnerUsername || 'Anonymous'}
              {chatMode === 'friend' && (
                <span className="ml-2 text-xs text-royal-blue">Friend</span>
              )}
              {chatMode === 'random' && addedFriends.has(_partner) && (
                <span className="ml-2 text-xs text-blue-400">✓ Friend</span>
              )}
            </h2>
            {/* Simple Add Friend button - only show for random chat and if not already added */}
            {chatMode === 'random' && !addedFriends.has(_partner) && partnerUsername && partnerUsername !== 'bot' && (
              <button 
                onClick={handleAddFriendInChat}
                className="text-xs px-3 py-1 bg-royal-blue hover:bg-blue-600 text-white rounded-full transition-colors"
              >
                Add Friend
              </button>
            )}
          </div>
          <p className="text-sm text-white/70 truncate">
            {chatMode === 'friend' 
              ? (activeFriendInfo?.isOnline ? '🟢 Online' : '⚫ Offline')
              : partnerUsername === 'bot' ? '🤖 AI Companion' : 'Matched partner'
            }
          </p>
        </div>
        
        {/* Right: Skip/Exit button - positioned absolutely with more padding from edge */}
        <button 
          onClick={handleSkip}
          disabled={isSkipping}
          className="absolute right-8 bg-tangerine px-6 py-2 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50 z-50 pointer-events-auto"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {isSkipping ? (chatMode === 'friend' ? 'Exiting...' : 'Skipping...') : (chatMode === 'friend' ? 'Exit' : 'Skip')}
        </button>
      </div>

      {/* Connection status indicator */}
      {!navigator.onLine && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-tangerine px-4 py-1 rounded-full">
          <p className="text-white text-sm">Offline - Messages will send when reconnected</p>
        </div>
      )}


      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/50 mt-8">
            <p>You're now chatting!</p>
            <p className="text-sm mt-2">Say hi 👋</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              // Handle both random chat and friend chat message formats
              const isYou = chatMode === 'friend' 
                ? (msg.sender_id === parseInt(currentUsername) || msg.sender === 'You')  // Friend message format
                : msg.isMine;  // Random chat format
              const msgUsername = isYou ? currentUsername : partnerUsername;
              
              return (
                <div key={i} className={`mb-4 flex items-end gap-2 ${isYou ? 'justify-end' : 'justify-start'}`}>
                  {/* Avatar for partner messages (left side) */}
                  {!isYou && (
                    <img 
                      src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${msgUsername}&backgroundColor=2563EB`}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  )}
                  
                  {/* Message bubble */}
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                    isYou 
                      ? msg.pending 
                        ? 'bg-royal-blue/50 text-white/70 rounded-br-none' 
                        : 'bg-royal-blue text-white rounded-br-none'
                      : 'bg-white/10 text-white rounded-bl-none'
                  }`}>
                    <p className="break-words">{msg.message || msg.text}</p>
                    {chatMode === 'friend' && msg.created_at && (
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {chatMode === 'random' && (
                      <p className="text-xs opacity-70 mt-1">
                        {formatTime(msg.timestamp)}
                      </p>
                    )}
                  </div>
                  
                  {/* Avatar for your messages (right side) */}
                  {isYou && (
                    <img 
                      src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${currentUsername}&backgroundColor=2563EB`}
                      alt="Your avatar"
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {isPartnerTyping && (
        <div className="px-4 py-2 animate-fade-in">
          <p className="text-white/50 text-sm flex items-center">
            <span>Someone is typing</span>
            <span className="flex ml-1">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse" style={{animationDelay: '0.2s'}}>.</span>
              <span className="animate-pulse" style={{animationDelay: '0.4s'}}>.</span>
            </span>
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <input 
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          className="w-full p-4 rounded-full bg-white/10 text-white placeholder-white/50 focus:outline-none focus:bg-white/20 transition-colors text-base"
          style={{ fontSize: '16px' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              sendMessage();
            } else if (e.key !== 'Enter') {
              handleTyping();
            }
          }}
          onBlur={() => {
            // Note: Friend typing will be implemented with Supabase in future phase
          }}
        />
      </div>
    </div>
  );
}

function MainPage() {
  const [state, setState] = useState('PREFERENCES');
  const [_preferences, setPreferences] = useState(null);
  const [_partner, setPartner] = useState(null);
  const [partnerUsername, setPartnerUsername] = useState(null); // Add partner username state
  const [interests, setInterests] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('30s'); // Default 30s
  const [searchPhase, setSearchPhase] = useState('interests'); // 'interests' or 'gender-only'
  const [isConnected, setIsConnected] = useState(true); // Always connected with Supabase
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [matchingService, setMatchingService] = useState(null);
  const [chatService, setChatService] = useState(null);
  const [currentMatchId, setCurrentMatchId] = useState(null);
  
  // Friend system states (using Supabase)
  const [friendsList, setFriendsList] = useState([]);
  const [addedFriends, setAddedFriends] = useState(new Set()); // Track added friends in session
  const [friends, setFriends] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [showFriendsSheet, setShowFriendsSheet] = useState(false);
  const [friendsChannel, setFriendsChannel] = useState(null);
  const [presenceChannel, setPresenceChannel] = useState(null);
  
  // Friend chat states
  const [chatMode, setChatMode] = useState('random'); // 'random' or 'friend'
  const [activeFriendId, setActiveFriendId] = useState(null);
  const [activeFriendInfo, setActiveFriendInfo] = useState(null);
  const [friendMessages, setFriendMessages] = useState({});
  const [friendTypingStatus, setFriendTypingStatus] = useState({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [appTheme, setAppTheme] = useState('dark'); // Default dark theme
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const { user, loading } = useUser();
  const navigate = useNavigate();
  
  // Avatar generation using DiceBear API
  const avatarCache = useRef(new Map());
  
  const getAvatarUrl = (username) => {
    if (!username) return null; // Return null instead of empty string
    
    // Check cache first
    if (avatarCache.current.has(username)) {
      return avatarCache.current.get(username);
    }
    
    // Use 'shapes' style for a modern, abstract look
    // backgroundColor matches our royal blue theme
    const style = 'shapes';
    const backgroundColor = '2563EB';
    const size = 96; // High quality for retina displays
    
    const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(username)}&backgroundColor=${backgroundColor}&size=${size}`;
    
    // Cache the URL
    avatarCache.current.set(username, url);
    
    return url;
  };

  // Get current user's avatar (using their username from context)
  const getUserAvatar = () => {
    return getAvatarUrl(user?.username || 'default');
  };
  
  // Removed Socket.io reconnection logic - Supabase handles connection automatically

  // Duration options
  const durations = ['15s', '30s', '1min', '∞'];

  // Helper to style selected duration
  const getDurationButtonClass = (duration) => {
    const baseClass = "px-4 py-2 rounded-full text-sm font-medium transition-all ";
    const isSelected = selectedDuration === duration;
    
    return baseClass + (isSelected 
      ? "bg-blue-600 text-white" 
      : "bg-gray-800 text-gray-400 hover:bg-gray-700");
  };

  // Auth validation - wait for loading to complete
  useEffect(() => {
    if (!loading && (!user || !user.email || !user.gender)) {
      console.log('No authenticated user found, redirecting to auth');
      navigate('/auth');
      return;
    }
  }, [user, loading, navigate]);

  // Initialize MatchingService when user is available
  useEffect(() => {
    if (user?.id) {
      const service = new MatchingService(
        user.id,
        handleMatchFound,
        handlePhaseChanged
      );
      setMatchingService(service);
      
      // Check for existing active match on load
      checkForActiveMatch(service);

      // Cleanup on unmount
      return () => {
        service.destroy();
      };
    }
  }, [user?.id]);

  // PWA install prompt listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Initialize Friends System with Supabase
  useEffect(() => {
    if (user?.id) {
      console.log('🤝 Initializing friends system for user:', user.id);
      
      // Load initial friends list
      loadFriends();
      
      // Subscribe to friends updates
      const friendsUpdateChannel = friendsService.subscribeToFriendsUpdates(
        user.id,
        handleFriendsUpdated
      );
      setFriendsChannel(friendsUpdateChannel);
      
      // Subscribe to friend presence
      const friendPresenceChannel = friendsService.subscribeToFriendStatus(
        user.id,
        handleFriendPresenceChanged
      );
      setPresenceChannel(friendPresenceChannel);
      
      // Cleanup on unmount
      return () => {
        console.log('🧹 Cleaning up friends system');
        if (friendsUpdateChannel) {
          friendsUpdateChannel.unsubscribe();
        }
        if (friendPresenceChannel) {
          friendPresenceChannel.unsubscribe();
        }
      };
    }
  }, [user?.id]);
  
  // Initialize ChatService when match is found
  useEffect(() => {
    if (currentMatchId && user?.id && !chatService) {
      console.log('🚀 Initializing ChatService for match:', currentMatchId);
      
      const service = new ChatService(currentMatchId, user.id, handleNewMessage);
      service.initialize().catch(error => {
        console.error('Failed to initialize ChatService:', error);
        setToastMessage('Failed to connect to chat. Please try again.');
        setShowToast(true);
      });
      
      setChatService(service);

      return () => {
        console.log('🧹 Cleaning up ChatService');
        service.cleanup();
      };
    }
  }, [currentMatchId, user?.id]);

  // Listen for partner typing indicators
  useEffect(() => {
    const handlePartnerTyping = (event) => {
      console.log('Partner typing event:', event.detail);
      setIsPartnerTyping(event.detail.isTyping);
    };

    window.addEventListener('partner-typing', handlePartnerTyping);
    
    return () => {
      window.removeEventListener('partner-typing', handlePartnerTyping);
    };
  }, []);
  
  // Friends System Functions
  const loadFriends = async () => {
    try {
      console.log('📋 Loading friends list...');
      const friendsList = await friendsService.getFriends(user.id);
      setFriends(friendsList);
      setFriendCount(friendsList.length);
      console.log(`✅ Loaded ${friendsList.length} friends`);
    } catch (error) {
      console.error('Error loading friends:', error);
      setToastMessage('Failed to load friends');
      setShowToast(true);
    }
  };

  const handleFriendsUpdated = (payload) => {
    console.log('👥 Friends updated:', payload);
    // Reload friends when the friends table changes
    loadFriends();
  };

  const handleFriendPresenceChanged = (presenceState) => {
    console.log('👋 Friend presence changed:', presenceState);
    
    // Update friends with online status
    setFriends(prevFriends => 
      prevFriends.map(friend => ({
        ...friend,
        isOnline: Object.keys(presenceState).some(key => 
          presenceState[key]?.some(p => p.user_id === friend.id)
        )
      }))
    );
  };

  const handleAddFriend = async (partnerInfo) => {
    if (!partnerInfo.partnerId || !partnerInfo.partnerUsername) {
      console.log('Invalid partner info for adding friend');
      return;
    }

    // Don't allow adding bot as friend
    if (partnerInfo.partnerUsername === 'bot' || partnerInfo.partnerId.toString().startsWith('bot_')) {
      setToastMessage('Cannot add bot as friend!');
      setShowToast(true);
      return;
    }
    
    // Don't allow if already added this session
    if (addedFriends.has(partnerInfo.partnerId)) {
      setToastMessage('Already added as friend!');
      setShowToast(true);
      return;
    }
    
    try {
      console.log('🤝 Adding friend via service:', partnerInfo);
      
      await friendsService.addFriendById(
        user.id, 
        partnerInfo.partnerId, 
        partnerInfo.partnerUsername
      );
      
      // Mark as added in current session
      setAddedFriends(prev => new Set([...prev, partnerInfo.partnerId]));
      
      setToastMessage(`Added ${partnerInfo.partnerUsername} as friend! 🎉`);
      setShowToast(true);
      
      // Reload friends list
      await loadFriends();
    } catch (error) {
      console.error('Error adding friend:', error);
      setToastMessage(error.message || 'Failed to add friend');
      setShowToast(true);
    }
  };

  // Handle new message from ChatService
  const handleNewMessage = (message) => {
    console.log('📨 New message received:', message);
    setChatMessages(prev => [...prev, message]);
  };

  // Check for existing active match on page load
  const checkForActiveMatch = async (matchingServiceInstance) => {
    try {
      console.log('🔍 Checking for existing active match...');
      const existingMatch = await matchingServiceInstance.checkForExistingMatches();
      
      if (existingMatch) {
        console.log('✅ Found existing active match, restoring chat state:', existingMatch);
        
        // Determine partner ID
        const partnerId = existingMatch.user1_id === user.id ? existingMatch.user2_id : existingMatch.user1_id;
        
        // For bot matches, use bot_id
        const actualPartnerId = existingMatch.is_bot ? existingMatch.bot_id : partnerId;
        
        // For non-bot matches, fetch partner info
        let partnerUsername = null;
        let partnerInfo = null;
        
        if (existingMatch.is_bot) {
          partnerUsername = existingMatch.bot_profile?.username || 'Bot';
          partnerInfo = existingMatch.bot_profile;
        } else if (partnerId) {
          // Fetch partner user info from Supabase
          const { data: partnerData, error: partnerError } = await supabase
            .from('users')
            .select('*')
            .eq('id', partnerId)
            .single();
          
          if (!partnerError && partnerData) {
            partnerUsername = partnerData.username;
            partnerInfo = partnerData;
          } else {
            console.error('Error fetching partner info:', partnerError);
            // Try to get from localStorage as fallback
            const storedMatch = localStorage.getItem('activeMatch');
            if (storedMatch) {
              const parsed = JSON.parse(storedMatch);
              partnerUsername = parsed.partnerUsername || 'Anonymous';
            }
          }
        }
        
        // Restore the match state
        handleMatchFound({
          matchId: existingMatch.id,
          partnerId: actualPartnerId,
          partnerUsername: partnerUsername,
          partner: partnerInfo
        });
        
        // Don't load messages here - ChatService will handle it
        // The handleMatchFound will trigger ChatService initialization
        // which loads messages automatically
      } else {
        console.log('ℹ️ No active match found');
      }
    } catch (error) {
      console.error('Error checking for active match:', error);
    }
  };
  
  // Load existing messages for a match
  const loadExistingMessages = async (matchId) => {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (messages && messages.length > 0) {
        // Convert messages to the format expected by the chat view
        const formattedMessages = messages.map(msg => ({
          text: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          sender: msg.sender_id === user.id ? 'user' : 'partner',
          isMine: msg.sender_id === user.id
        }));
        
        setChatMessages(formattedMessages);
        console.log(`✅ Loaded ${messages.length} existing messages`);
      }
    } catch (error) {
      console.error('Error loading existing messages:', error);
    }
  };

  // Handle match found from MatchingService
  const handleMatchFound = (data) => {
    console.log('Match found!', data);
    setPartner(data.partnerId);
    setPartnerUsername(data.partnerUsername);
    setCurrentMatchId(data.matchId); // Set match ID for ChatService
    
    // Store partner avatar if provided
    if (data.partner) {
      avatarCache.current.set(data.partnerUsername, getAvatarUrl(data.partnerUsername));
    }
    
    // Clear previous chat messages
    setChatMessages([]);
    
    setInterests(''); // Clear interests after match
    setSelectedDuration('30s'); // Reset to default
    setSearchPhase('interests'); // Reset phase for next search
    setState('CHATTING');
    
    // Store match info in localStorage for persistence
    if (data.matchId) {
      localStorage.setItem('activeMatch', JSON.stringify({
        matchId: data.matchId,
        partnerId: data.partnerId,
        partnerUsername: data.partnerUsername,
        timestamp: Date.now()
      }));
    }
  };
  
  const handlePhaseChanged = (data) => {
    console.log('🔄 Search phase changed:', data.phase);
    setSearchPhase(data.phase === 'gender-only' ? 'gender-only' : 'interests');
  };

  // Note: Message handling is now done via MatchingService and Supabase Realtime
  // Friend system socket listeners are commented out for now - will be migrated later
  // useEffect(() => {
  //   // Friend system socket listeners would go here
  //   // Will be migrated to Supabase in a future phase
  // }, []);
  
  // Note: Typing indicators will be implemented with Supabase Realtime in future
  // useEffect(() => {
  //   // Typing indicators via Supabase channels
  // }, []);

  // Note: Friends list refresh will be handled by Supabase Realtime in future
  // useEffect(() => {
  //   // Friend list refresh via Supabase
  // }, [friendCount, chatMode]);
  

  const handleBlockUser = () => {
    if (!partnerUsername || !_partner) return;
    
    const confirmBlock = window.confirm(
      `Block this user?\n\nYou won't be matched with them again.`
    );
    
    if (confirmBlock) {
      // Note: Block functionality will be implemented with Supabase in future
      console.log('Block user functionality not yet migrated to Supabase');
      setToastMessage('Block feature coming soon!');
      setShowToast(true);
    }
  };


  // Prevent context menu on long press
  const handleContextMenu = (e) => {
    e.preventDefault();
  };
  
  const handlePreferenceSelect = async (preference) => {
    console.log('Selected preference:', preference);
    setPreferences(preference);
    setState('SEARCHING');
    
    // Reset phase based on whether interests are provided
    if (interests && interests.trim()) {
      setSearchPhase('interests');
    } else {
      setSearchPhase('gender-only');
    }
    
    // Start matching with MatchingService
    if (matchingService) {
      try {
        await matchingService.findMatch({
          userGender: user?.gender || 'male',
          lookingFor: preference,
          interests: interests.trim(),
          searchDuration: selectedDuration
        });
      } catch (error) {
        console.error('Error starting match:', error);
        setToastMessage('Error starting search. Please try again.');
        setShowToast(true);
        setState('PREFERENCES');
      }
    }
  };

  // Action Menu Component (shows on long press)
  const ActionMenu = () => {
    if (!showActionMenu) return null;
    
    const handleBlockClick = () => {
      setShowActionMenu(false);
      handleBlockUser();
    };
    
    const handleReportClick = () => {
      setShowActionMenu(false);
      setShowReportModal(true);
    };
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowActionMenu(false)}
        />
        
        {/* Menu */}
        <div className="absolute top-16 left-4 bg-gray-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            onClick={handleBlockClick}
            className="w-full px-6 py-3 text-left text-white hover:bg-gray-700 transition-colors flex items-center gap-3"
          >
            <span className="text-xl">🚫</span>
            <span>Block {partnerUsername || 'User'}</span>
          </button>
          
          <div className="border-t border-gray-700" />
          
          <button
            onClick={handleReportClick}
            className="w-full px-6 py-3 text-left text-white hover:bg-gray-700 transition-colors flex items-center gap-3"
          >
            <span className="text-xl">⚠️</span>
            <span>Report {partnerUsername || 'User'}</span>
          </button>
        </div>
      </>
    );
  };

  // Helper function to show toast notifications
  // Handler for starting friend chat (placeholder for future implementation)
  const startFriendChat = (friendId) => {
    console.log('Starting friend chat with:', friendId);
    
    // Note: Friend chat functionality will be implemented in a future phase
    // For now, show a message that it's coming soon
    setToastMessage('Friend chat coming soon! 🚀');
    setShowToast(true);
    setShowFriendsSheet(false);
  };

  // Handler for exiting friend chat (placeholder for future implementation)
  const exitFriendChat = () => {
    console.log('Exiting friend chat');
    
    setChatMode('random');
    setActiveFriendId(null);
    setActiveFriendInfo(null);
    setChatMessages([]);
    setState('PREFERENCES');
  };

  const showToastMessage = (message, type = 'tangerine') => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Main Header Component
  const MainHeader = () => {
    // Only show settings icon when user is logged in
    if (!user) return null;
    
    return (
      <div className="absolute top-0 left-0 right-0 z-40 p-4">
        {/* Settings gear - top left with improved styling */}
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 bg-gray-800/90 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm border border-white/10 shadow-lg"
          aria-label="Settings"
        >
          <svg 
            className="w-5 h-5 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Friends indicator - top right */}
        {friendCount > 0 && (
          <button
            onClick={() => {
              console.log('Opening friends sheet');
              setShowFriendsSheet(true);
            }}
            className="fixed top-4 right-4 w-12 h-12 bg-royal-blue 
                       rounded-full flex items-center justify-center
                       text-white font-bold shadow-lg z-50
                       transition-all duration-200 hover:scale-110
                       active:scale-95 animate-in fade-in zoom-in relative"
            aria-label={`${friendCount} friends`}
          >
            {/* Friend count */}
            <span className={`transition-all duration-300`}>
              {friendCount > 99 ? '99+' : friendCount}
            </span>
            
            {/* Total unread badge */}
            {(() => {
              const totalUnread = friends.reduce((sum, f) => sum + (f.unread_count || 0), 0);
              return totalUnread > 0 && (
                <div className="absolute -top-1 -right-1 bg-tangerine text-white 
                              text-xs font-bold rounded-full min-w-[16px] h-4 
                              px-1 flex items-center justify-center border-2 
                              border-dark-navy">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              );
            })()}
            
            {/* Online indicator dot */}
            {friends.some(f => f.isOnline) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 
                            rounded-full border-2 border-dark-navy" />
            )}
          </button>
        )}
      </div>
    );
  };

  // Settings Bottom Sheet Component
  const SettingsSheet = () => {
    const handleLogout = () => {
      if (window.confirm('Are you sure you want to logout?')) {
        // Clear user context
        localStorage.removeItem('user');
        window.location.href = '/auth'; // Force redirect to auth
      }
    };

    // Enhanced animation transitions
    const sheetTransition = showSettings 
      ? 'translate-y-0 ease-out duration-300' 
      : 'translate-y-full ease-in duration-200';

    const backdropTransition = showSettings
      ? 'opacity-50 ease-out duration-300'
      : 'opacity-0 ease-in duration-200';
    
    return (
      <>
        {/* Enhanced Backdrop */}
        <div 
          className={`fixed inset-0 bg-black transition-opacity z-40 ${backdropTransition} ${
            showSettings ? '' : 'pointer-events-none'
          }`}
          onClick={() => setShowSettings(false)}
        />
        
        {/* Enhanced Bottom Sheet */}
        <div 
          className={`fixed bottom-0 left-0 right-0 bg-gray-800 rounded-t-2xl z-50 transform transition-transform ${sheetTransition}`}
        >
          {/* Header with close button */}
          <div className="flex justify-between items-center pt-4 pb-3 px-6">
            <h2 className="text-white text-xl font-semibold">Settings</h2>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-white/50 hover:text-white transition-colors p-1"
              aria-label="Close settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Settings Content */}
          <div className="px-6 pb-6 space-y-4">
            
            {/* App Info */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">About Froopy</h3>
              <p className="text-gray-400 text-sm">Version 1.0.0-phase4</p>
              <p className="text-gray-400 text-sm">Phase 4 Complete 🎉</p>
              <p className="text-gray-400 text-xs mt-1">Built for mobile-first chat experiences</p>
            </div>

            {/* PWA Install Button */}
            {deferredPrompt && (
              <button
                onClick={async () => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                      setDeferredPrompt(null);
                      showToastMessage('App installed successfully! 🎉');
                    }
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-full font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>📱</span>
                <span>Install Froopy App</span>
              </button>
            )}
            
            {/* User Info */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Your Account</h3>
              <p className="text-gray-400 text-sm">{user?.email}</p>
              <p className="text-gray-400 text-sm">@{user?.username}</p>
              <p className="text-gray-400 text-xs mt-1">
                Gender: {user?.gender?.charAt(0).toUpperCase() + user?.gender?.slice(1)}
              </p>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-full font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
            
            {/* Close Button */}
            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-full font-medium transition-colors"
            >
              Close
            </button>
          </div>
          
          {/* Safe area padding for iOS */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </>
    );
  };

  // Report Modal Component
  const ReportModal = () => {
    if (!showReportModal) return null;
    
    const reportReasons = [
      { value: 'spam', label: 'Spam or bot behavior' },
      { value: 'inappropriate', label: 'Inappropriate messages' },
      { value: 'harassment', label: 'Harassment or bullying' },
      { value: 'offensive', label: 'Offensive content' },
      { value: 'other', label: 'Other' }
    ];
    
    const handleReport = () => {
      if (!reportReason) {
        showToastMessage('Please select a reason');
        return;
      }
      
      socket.emit('report-user', {
        reportedUserId: _partner,
        reportedUsername: partnerUsername,
        reason: reportReason,
        timestamp: new Date().toISOString()
      });
      
      showToastMessage('User reported. Thank you for keeping Froopy safe!');
      setShowReportModal(false);
      setReportReason('');
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
          <h3 className="text-white text-lg font-semibold mb-4">
            Report {partnerUsername}
          </h3>
          
          <p className="text-gray-400 text-sm mb-4">
            Help us understand what happened
          </p>
          
          <div className="space-y-2 mb-6">
            {reportReasons.map(reason => (
              <label
                key={reason.value}
                className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={reason.value}
                  checked={reportReason === reason.value}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-white text-sm">{reason.label}</span>
              </label>
            ))}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowReportModal(false);
                setReportReason('');
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReport}
              className="flex-1 bg-tangerine hover:bg-orange-600 text-white py-2 px-4 rounded-full transition-colors"
            >
              Report
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Show loading state while authentication is being resolved
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-navy text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If not loading and no user, the useEffect will handle redirect
  if (!user || !user.email || !user.gender) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-navy text-white">
        <div className="text-center">
          <div className="text-lg mb-2">Redirecting to authentication...</div>
          <div className="text-sm text-white/60">Please complete your profile</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-dark-navy min-h-screen flex flex-col relative">
      {/* Add header at the top */}
      <MainHeader />
      
      {/* Connection status indicator - Always green for Supabase */}
      <div className="fixed top-4 right-4 z-50">
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
      </div>
      
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 
                        bg-dark-navy border border-white/20 rounded-full 
                        px-6 py-3 text-white shadow-lg z-50 
                        animate-fade-in">
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}
      
      {/* Main content with padding for header */}
      <div className="flex-1 flex flex-col text-white" style={{ paddingTop: state === 'CHATTING' ? '0' : '4rem' }}>
        {state === 'PREFERENCES' && (
        <PreferencesView 
          onPreferenceSelect={handlePreferenceSelect}
          interests={interests}
          setInterests={setInterests}
          selectedDuration={selectedDuration}
          setSelectedDuration={setSelectedDuration}
          durations={durations}
          getDurationButtonClass={getDurationButtonClass}
        />
      )}
      {state === 'SEARCHING' && (
        <SearchingView 
          onCancel={async () => {
            if (matchingService) {
              await matchingService.cancelSearch();
            }
            setState('PREFERENCES');
            setPreferences(null);
            setSearchPhase('interests'); // Reset phase
          }}
          interests={interests}
          selectedDuration={selectedDuration}
          searchPhase={searchPhase}
        />
      )}
      {state === 'CHATTING' && (
        <ChattingView 
          messages={chatMessages}
          partnerUsername={chatMode === 'friend' ? activeFriendInfo?.username : partnerUsername}
          currentUsername={user?.username}
          getAvatarUrl={getAvatarUrl}
          getUserAvatar={getUserAvatar}
          isPartnerTyping={chatMode === 'friend' ? friendTypingStatus[activeFriendId] : isPartnerTyping}
          handleContextMenu={handleContextMenu}
          addedFriends={addedFriends}
          _partner={_partner}
          chatMode={chatMode}
          activeFriendInfo={activeFriendInfo}
          activeFriendId={activeFriendId}
          showToastMessage={showToastMessage}
          chatService={chatService}
          onSkip={chatMode === 'friend' ? exitFriendChat : async () => {
            // Clean up ChatService
            if (chatService) {
              await chatService.endChat();
              setChatService(null);
            }
            
            // Clean up MatchingService
            if (matchingService) {
              await matchingService.skipMatch();
            }
            
            // Clear stored active match from localStorage
            localStorage.removeItem('activeMatch');
            console.log('🧹 Cleared activeMatch from localStorage');
            
            // Reset state
            setState('PREFERENCES');
            setPreferences(null);
            setPartner(null);
            setPartnerUsername(null);
            setCurrentMatchId(null);
            setChatMessages([]);
            setSearchPhase('interests');
          }}
          onSendMessage={async (message) => {
            const messageText = message.text.trim();
            if (!messageText) return;
            
            if (chatMode === 'friend') {
              // Friend chat message - still using Socket.io for now
              // socket.emit('friend-message', {
              //   friendId: activeFriendId,
              //   message: messageText
              // });
              console.log('Friend chat not yet migrated to Supabase');
            } else {
              // Random chat message via ChatService
              const outgoingMessage = {
                text: messageText,
                timestamp: Date.now(),
                sender: 'user',
                isMine: true
              };
              
              // Optimistically add to UI
              setChatMessages(prev => [...prev, outgoingMessage]);
              
              // Send via ChatService
              if (chatService) {
                try {
                  await chatService.sendMessage(messageText);
                  console.log('✅ Message sent via ChatService');
                } catch (error) {
                  console.error('Error sending message via ChatService:', error);
                  setToastMessage('Failed to send message. Please try again.');
                  setShowToast(true);
                  
                  // Remove optimistic message on failure
                  setChatMessages(prev => prev.filter(msg => msg !== outgoingMessage));
                }
              } else {
                console.warn('ChatService not available, falling back to MatchingService');
                // Fallback to MatchingService if ChatService not available
                if (matchingService) {
                  try {
                    await matchingService.sendMessage(messageText);
                  } catch (error) {
                    console.error('Error sending message via MatchingService:', error);
                    setToastMessage('Failed to send message. Please try again.');
                    setShowToast(true);
                    setChatMessages(prev => prev.filter(msg => msg !== outgoingMessage));
                  }
                }
              }
            }
          }}
        />
      )}
      </div>
      
      {/* Add ActionMenu, ReportModal, SettingsSheet, and FriendsSheet - positioned relative to main container */}
      <ActionMenu />
      <ReportModal />
      <SettingsSheet />
      
      {/* Friends Sheet */}
      <FriendsSheet 
        isOpen={showFriendsSheet}
        onClose={() => setShowFriendsSheet(false)}
        friends={friends}
        friendsService={friendsService}
        currentUserId={user?.id}
        onStartChat={startFriendChat}
        onFriendAdded={loadFriends}
        showToastMessage={showToastMessage}
      />
    </div>
  );
}

export default MainPage;
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import socket, { findMatch, cancelSearch, sendMessage as socketSendMessage, sendSkip, onReconnecting, onReconnected, onReconnectError, startTyping, stopTyping, onPartnerTypingStart, onPartnerTypingStop, queueMessage, canSendDirectly, getMessageQueue } from '../services/socket';
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

function ChattingView({ messages, onSkip, onSendMessage, isPartnerTyping, partnerUsername, currentUsername, getAvatarUrl, getUserAvatar, handleTouchStartForBlock, handleTouchEndForBlock, isLongPressing, handleUsernamePress, handleUsernameRelease, handleContextMenu, addedFriends, _partner, chatMode = 'random', activeFriendInfo, socket, activeFriendId }) {
  const [input, setInput] = useState('');
  const [isSkipping, setIsSkipping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Touch state variables for swipe functionality
  const [touchStart, setTouchStart] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [touchStartY, setTouchStartY] = useState(0);
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
        if (isTyping) {
          stopTyping();
        }
      }
    };
  }, [isTyping]);

  // Auto-hide swipe hint after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 8000); // Hide after 8 seconds
    
    return () => clearTimeout(timer);
  }, []);

  // Format timestamp helper
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Typing handler function
  const handleTyping = () => {
    // If not already typing, start
    if (!isTyping) {
      setIsTyping(true);
      startTyping();
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping();
    }, 2000);
  };
  
  const sendMessage = () => {
    // Stop typing when sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }

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
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }
    setIsSkipping(true);
    onSkip();
  };

  // Touch handler functions for swipe-to-skip
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsSwiping(false);
    setSwipeDistance(0);
  };
  
  const handleTouchMove = (e) => {
    const horizontalDistance = e.targetTouches[0].clientX - touchStart;
    const verticalDistance = Math.abs(e.targetTouches[0].clientY - touchStartY);
    
    // Only swipe if horizontal movement is greater than vertical and it's a right swipe
    if (Math.abs(horizontalDistance) > verticalDistance && horizontalDistance > 10) {
      // Prevent message input focus during swipe
      const messageInput = document.querySelector('input[type="text"]');
      if (messageInput === document.activeElement) {
        return; // Don't swipe while typing
      }
      
      setIsSwiping(true);
      setSwipeDistance(Math.min(horizontalDistance, 150)); // Cap at 150px
      
      // Prevent vertical scroll during horizontal swipe
      e.preventDefault();
      
      // Hide hint after first swipe attempt
      if (showSwipeHint) {
        setShowSwipeHint(false);
      }
    }
  };
  
  const handleTouchEnd = () => {
    if (!isSwiping) return;
    
    const swipeThreshold = 100; // 100px to trigger skip
    
    if (swipeDistance > swipeThreshold) {
      // Reset swipe states immediately
      setSwipeDistance(0);
      setIsSwiping(false);
      
      // Clear typing if active
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        setIsTyping(false);
        stopTyping();
      }
      
      // console.log('Swipe skip triggered!'); // Dev log - cleaned up for production
      handleSkip();
    } else {
      // Snap back
      setSwipeDistance(0);
    }
    
    // Reset states
    setIsSwiping(false);
    setTouchStart(0);
  };

  return (
    <div 
      ref={chatContainerRef}
      className="relative flex flex-col h-screen bg-dark-navy" 
      style={{ 
        height: '100dvh',
        transform: `translateX(${swipeDistance}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        opacity: 1 - (swipeDistance / 300) // Fade as swipe progresses
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip indicator that appears during swipe */}
      {isSwiping && swipeDistance > 50 && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 
                        bg-tangerine text-white px-4 py-2 rounded-full
                        transition-opacity duration-200 z-10"
             style={{ opacity: swipeDistance > 100 ? 1 : 0.5 }}>
          <span className="font-medium">Skip →</span>
        </div>
      )}
      
      {/* Chat header with centered username and skip button - no avatar */}
      <div className="relative flex items-center justify-center p-4 border-b border-white/10">
        {/* Center: Username and status - centered without avatar */}
        <div className="text-center flex-1">
          <h2 
            className={`text-white font-semibold select-none truncate ${chatMode === 'random' ? 'cursor-pointer' : ''}
                        ${isLongPressing ? 'opacity-70 scale-95' : ''}
                        transition-all duration-200`}
            {...(chatMode === 'random' ? {
              onMouseDown: handleUsernamePress,
              onMouseUp: handleUsernameRelease,
              onMouseLeave: handleUsernameRelease,
              onTouchStart: handleUsernamePress,
              onTouchEnd: handleUsernameRelease,
              onTouchCancel: handleUsernameRelease,
              onContextMenu: handleContextMenu
            } : {})}
          >
            {partnerUsername || 'Anonymous'}
            {chatMode === 'friend' && (
              <span className="ml-2 text-xs text-royal-blue">Friend</span>
            )}
            {chatMode === 'random' && addedFriends.has(_partner) && (
              <span className="ml-2 text-xs text-blue-400">✓ Friend</span>
            )}
          </h2>
          <p className="text-sm text-white/70 truncate">
            {chatMode === 'friend' 
              ? (activeFriendInfo?.isOnline ? '🟢 Online' : '⚫ Offline')
              : partnerUsername === 'bot' ? '🤖 AI Companion' : 'Matched partner'
            }
          </p>
          {/* Visual feedback during long press - only for random chat */}
          {chatMode === 'random' && isLongPressing && (
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/50 whitespace-nowrap">
              Hold to add friend...
            </div>
          )}
        </div>
        
        {/* Right: Skip/Exit button - positioned absolutely */}
        <button 
          onClick={handleSkip}
          disabled={isSkipping}
          className="absolute right-4 bg-tangerine px-6 py-2 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50"
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

      {/* Swipe hint for new users */}
      {showSwipeHint && (
        <div className="mx-4 mb-2 p-3 bg-white/5 rounded-lg text-center
                        animate-fade-in">
          <p className="text-white/70 text-sm">
            💡 Tip: Swipe right to skip to next person
          </p>
        </div>
      )}

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        onTouchStart={(e) => e.stopPropagation()}
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
              // Friend typing indicator
              if (chatMode === 'friend' && socket && activeFriendId) {
                socket.emit('friend-typing', {
                  friendId: activeFriendId,
                  isTyping: true
                });
              }
            }
          }}
          onBlur={() => {
            // Stop friend typing indicator when input loses focus
            if (chatMode === 'friend' && socket && activeFriendId) {
              socket.emit('friend-typing', {
                friendId: activeFriendId,
                isTyping: false
              });
            }
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
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [messageQueue, setMessageQueue] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  // Friend system states
  const [friendsList, setFriendsList] = useState([]);
  const [addedFriends, setAddedFriends] = useState(new Set()); // Track added friends in session
  const [friends, setFriends] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [showFriendsSheet, setShowFriendsSheet] = useState(false); // For future use
  
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
  const { user } = useUser();
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
  
  const MAX_RECONNECTION_ATTEMPTS = 5;

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

  // Auth validation
  useEffect(() => {
    if (!user || !user.email || !user.gender) {
      console.log('No authenticated user found, redirecting to auth');
      navigate('/auth');
      return;
    }
  }, [user, navigate]);

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

  // Load friends on component mount
  useEffect(() => {
    // Only request friends if we have a valid socket connection
    if (socket && socket.connected) {
      console.log('Requesting friends list on mount');
      socket.emit('get-friends');
    }
  }, []); // Empty dependency array - only run on mount
  
  // Listen for connection status changes
  useEffect(() => {
    // console.log('MainPage mounted, socket:', socket.connected); // Dev log - cleaned up
    
    const handleConnect = () => {
      // console.log('Socket connected'); // Dev log - cleaned up
      setIsConnected(true);
    };
    
    const handleDisconnect = () => {
      // console.log('Socket disconnected'); // Dev log - cleaned up
      setIsConnected(false);
      setIsReconnecting(true);
      setIsPartnerTyping(false);
      
      // Add disconnection handling during active chat
      if (state === 'CHATTING' && !navigator.onLine) {
        setToastMessage('Connection lost - messages will send when reconnected');
      } else {
        setToastMessage('Connection lost');
      }
      setShowToast(true);
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Add reconnection listeners
    onReconnecting(() => {
      setReconnectionAttempts(prev => {
        const newAttempts = prev + 1;
        
        if (newAttempts >= MAX_RECONNECTION_ATTEMPTS) {
          setToastMessage(`Connection failed after ${MAX_RECONNECTION_ATTEMPTS} attempts. Please refresh.`);
          setIsReconnecting(false);
          return newAttempts;
        }
        
        setIsReconnecting(true);
        setToastMessage(`Reconnecting... (${newAttempts}/${MAX_RECONNECTION_ATTEMPTS})`);
        setShowToast(true);
        return newAttempts;
      });
    });
    
    onReconnected(() => {
      setReconnectionAttempts(0); // Reset counter on successful connection
      setIsReconnecting(false);
      setIsConnected(true);
      setToastMessage('Connected!');
      
      // Send queued messages
      if (messageQueue.length > 0) {
        messageQueue.forEach(msg => socketSendMessage(msg));
        setMessageQueue([]);
      }
      
      // Hide toast after 2 seconds
      setTimeout(() => setShowToast(false), 2000);
    });
    
    // Handle reconnection errors
    onReconnectError(() => {
      if (reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
        setToastMessage('Connection permanently failed. Please refresh the page.');
        setIsReconnecting(false);
        setShowToast(true);
      }
    });
    
    return () => {
      // console.log('MainPage unmounting'); // Dev log - cleaned up
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [messageQueue, reconnectionAttempts, state]);
  
  // Listen for match found event
  useEffect(() => {
    const handleMatchFound = (data) => {
      console.log('Match found!', data);
      setPartner(data.partnerId || data.partnerUsername);
      // Use actual partner username from bot or partnerId for regular users
      setPartnerUsername(data.partnerUsername || data.partnerId); 
      // Store partner avatar if provided (for bots)
      if (data.partnerAvatar) {
        avatarCache.current.set(data.partnerUsername || data.partnerId, data.partnerAvatar);
      }
      setInterests(''); // Clear interests after match
      setSelectedDuration('30s'); // Reset to default
      setSearchPhase('interests'); // Reset phase for next search
      setState('CHATTING');
    };
    
    const handlePhaseChanged = (data) => {
      console.log('🔄 Search phase changed:', data.phase);
      setSearchPhase(data.phase === 'gender-only' ? 'gender-only' : 'interests');
    };
    
    socket.on('match-found', handleMatchFound);
    socket.on('search-phase-changed', handlePhaseChanged);
    
    return () => {
      socket.off('match-found', handleMatchFound);
      socket.off('search-phase-changed', handlePhaseChanged);
    };
  }, []);

  // Add message listener
  useEffect(() => {
    const handleMessage = (message) => {
      console.log('Received message:', message);
      // Ensure received messages are properly marked as not mine
      const incomingMessage = {
        text: message.message || message.text,
        timestamp: message.timestamp || Date.now(),
        from: message.from,
        isMine: false
      };
      setChatMessages(prev => [...prev, incomingMessage]);
    };
    
    const handlePartnerSkipped = () => {
      console.log('Partner skipped');
      alert('Your partner left the chat');
      setState('PREFERENCES');
      setPreferences(null);
      setPartner(null);
      setPartnerUsername(null); // Clear partner username
      setChatMessages([]);
      setSearchPhase('interests'); // Reset phase
    };
    
    const handlePartnerDisconnected = () => {
      console.log('Partner disconnected');
      alert('Your partner disconnected');
      setState('PREFERENCES');
      setPreferences(null);
      setPartner(null);
      setPartnerUsername(null); // Clear partner username
      setChatMessages([]);
      setSearchPhase('interests'); // Reset phase
    };

    const handleUserBlocked = (data) => {
      console.log('User blocked:', data);
      setToastMessage(data.message || 'User blocked. Finding new match...');
      setShowToast(true);
      
      // Reset to preferences state
      setState('PREFERENCES');
      setPreferences(null);
      setPartner(null);
      setPartnerUsername(null);
      setChatMessages([]);
      setSearchPhase('interests');
      setIsPartnerTyping(false);
      
      // Auto-hide toast and return to preferences
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    };

    const handleBlockedByUser = (data) => {
      console.log('Blocked by user:', data);
      setToastMessage(data.message || 'You have been blocked. Finding new match...');
      setShowToast(true);
      
      // Same cleanup as above
      setState('PREFERENCES');
      setPreferences(null);
      setPartner(null);
      setPartnerUsername(null);
      setChatMessages([]);
      setSearchPhase('interests');
      setIsPartnerTyping(false);
      
      // Auto-hide toast
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    };

    const handleReportAcknowledged = (data) => {
      console.log('Report acknowledged:', data);
      // Toast already shown in handleReport, but log for debugging
    };
    
    socket.on('message', handleMessage);
    socket.on('partner-skipped', handlePartnerSkipped);
    socket.on('partner-disconnected', handlePartnerDisconnected);
    socket.on('user-blocked', handleUserBlocked);
    socket.on('blocked-by-user', handleBlockedByUser);
    socket.on('report-acknowledged', handleReportAcknowledged);
    
    // Friend system socket listeners
    socket.on('friend-added', ({ friendId, friendUsername }) => {
      console.log('Friend added:', friendUsername);
      setAddedFriends(prev => new Set(prev).add(friendId));
      showToastMessage(`${friendUsername} added as friend!`, 'royal-blue');
      
      // Request updated friends list
      socket.emit('get-friends');
    });

    socket.on('friend-already-added', ({ friendUsername }) => {
      showToastMessage(`${friendUsername} is already your friend!`, 'tangerine');
    });

    socket.on('friend-added-by', ({ friendId, message }) => {
      showToastMessage(message, 'royal-blue');
    });

    // Listen for friends list updates
    socket.on('friends-list', (friendsList) => {
      console.log('Received friends list:', friendsList);
      setFriends(friendsList);
      setFriendCount(friendsList.length);
    });

    // Friend chat listeners
    socket.on('friend-messages', ({ friendId, friendInfo, messages }) => {
      console.log(`Received ${messages.length} messages for friend ${friendId}`);
      
      setActiveFriendInfo(friendInfo);
      
      // Store messages for this friend
      setFriendMessages(prev => ({
        ...prev,
        [friendId]: messages
      }));
      
      // If this is the active friend, display messages
      if (activeFriendId === friendId) {
        setChatMessages(messages);
      }
    });

    socket.on('friend-message-sent', (message) => {
      console.log('Friend message sent:', message);
      
      // Add to current messages if in friend chat
      if (chatMode === 'friend' && activeFriendId === message.receiver_id) {
        setChatMessages(prev => [...prev, message]);
      }
      
      // Update stored messages
      setFriendMessages(prev => ({
        ...prev,
        [message.receiver_id]: [...(prev[message.receiver_id] || []), message]
      }));
    });

    socket.on('friend-message-received', (message) => {
      console.log('Friend message received:', message);
      
      // If currently chatting with this friend, add to messages
      if (chatMode === 'friend' && activeFriendId === message.senderId) {
        setChatMessages(prev => [...prev, message]);
      } else {
        // Show notification toast
        showToastMessage(`New message from ${message.sender_username}`, 'royal-blue');
      }
      
      // Update stored messages
      setFriendMessages(prev => ({
        ...prev,
        [message.senderId]: [...(prev[message.senderId] || []), message]
      }));
    });

    socket.on('friend-typing-status', ({ userId, isTyping }) => {
      setFriendTypingStatus(prev => ({
        ...prev,
        [userId]: isTyping
      }));
    });

    // Friend online/offline status changes
    socket.on('friend-status-changed', ({ friendId, isOnline }) => {
      console.log(`Friend ${friendId} is now ${isOnline ? 'online' : 'offline'}`);
      
      // Update friends list
      setFriends(prev => prev.map(friend => 
        friend.id === friendId 
          ? { ...friend, isOnline } 
          : friend
      ));
      
      // Update active friend info if chatting
      if (chatMode === 'friend' && activeFriendId === friendId) {
        setActiveFriendInfo(prev => prev ? { ...prev, isOnline } : prev);
      }
      
      // Show toast notification
      const friend = friends.find(f => f.id === friendId);
      if (friend) {
        showToastMessage(
          `${friend.username} is now ${isOnline ? 'online' : 'offline'}`,
          isOnline ? 'royal-blue' : 'gray'
        );
      }
    });
    
    return () => {
      socket.off('message', handleMessage);
      socket.off('partner-skipped', handlePartnerSkipped);
      socket.off('partner-disconnected', handlePartnerDisconnected);
      socket.off('user-blocked', handleUserBlocked);
      socket.off('blocked-by-user', handleBlockedByUser);
      socket.off('report-acknowledged', handleReportAcknowledged);
      socket.off('friend-added');
      socket.off('friend-already-added');
      socket.off('friend-added-by');
      socket.off('friends-list');
      socket.off('friend-messages');
      socket.off('friend-message-sent');
      socket.off('friend-message-received');
      socket.off('friend-typing-status');
      socket.off('friend-status-changed');
    };
  }, []);
  
  // Typing event listeners
  useEffect(() => {
    onPartnerTypingStart(() => {
      // console.log('Partner started typing'); // Dev log - cleaned up
      setIsPartnerTyping(true);
    });
    
    onPartnerTypingStop(() => {
      // console.log('Partner stopped typing'); // Dev log - cleaned up
      setIsPartnerTyping(false);
    });
  }, []);

  // Refresh friends list periodically for unread counts
  useEffect(() => {
    let refreshInterval;
    
    if (socket && socket.connected && friendCount > 0) {
      // Refresh every 30 seconds if not in friend chat
      refreshInterval = setInterval(() => {
        if (chatMode !== 'friend') {
          console.log('Refreshing friends list');
          socket.emit('get-friends');
        }
      }, 30000);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [socket, friendCount, chatMode]);
  
  // Long press completion handler - shows action menu
  const handleLongPressComplete = () => {
    setIsLongPressing(false);
    setShowActionMenu(true); // Show menu instead of direct block
  };

  // Long press handling for blocking
  const handleTouchStartForBlock = (e) => {
    // Don't interfere with existing swipe-to-skip or buttons
    if (e.target.closest('button')) return;
    
    const timer = setTimeout(() => {
      setIsLongPressing(true);
      handleLongPressComplete(); // Changed from handleBlockUser
    }, 800); // 800ms for long press
    
    setLongPressTimer(timer);
  };

  const handleTouchEndForBlock = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
  };

  const handleBlockUser = () => {
    if (!partnerUsername || !_partner) return;
    
    const confirmBlock = window.confirm(
      `Block this user?\n\nYou won't be matched with them again.`
    );
    
    if (confirmBlock) {
      // Use partner's socket ID from the match
      socket.emit('block-user', { 
        blockedUserId: _partner // _partner contains partner's socket ID
      });
    }
  };

  // Long press handlers for adding friends
  const handleUsernamePress = () => {
    // Don't allow adding bot as friend
    if (!partnerUsername || partnerUsername === 'bot') {
      return;
    }
    
    // Don't allow if already added this session
    if (addedFriends.has(_partner)) {
      showToastMessage('Already added as friend!', 'tangerine');
      return;
    }
    
    setIsLongPressing(true);
    const timer = setTimeout(() => {
      // Vibrate if available (mobile feedback)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Trigger friend add
      socket.emit('add-friend', { 
        partnerId: _partner,
        partnerUsername: partnerUsername 
      });
      
      setIsLongPressing(false);
    }, 800); // 800ms long press
    
    setLongPressTimer(timer);
  };

  const handleUsernameRelease = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
  };

  // Prevent context menu on long press
  const handleContextMenu = (e) => {
    e.preventDefault();
  };
  
  const handlePreferenceSelect = (preference) => {
    // console.log('Selected preference:', preference); // Dev log - cleaned up
    setPreferences(preference);
    setState('SEARCHING');
    
    // Reset phase based on whether interests are provided
    if (interests && interests.trim()) {
      setSearchPhase('interests');
    } else {
      setSearchPhase('gender-only');
    }
    
    // Start real matching - use test data when user not available
    findMatch({
      userGender: user?.gender || 'male',
      lookingFor: preference,
      interests: interests.trim(), // Include interests in match request
      searchDuration: selectedDuration // ADD this line
    });
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
  // Handler for starting friend chat
  const startFriendChat = (friendId) => {
    console.log('Starting friend chat with:', friendId);
    
    // Exit random chat if active
    if (state === 'CHATTING' && chatMode === 'random') {
      socket.emit('skip');
    }
    
    // Switch to friend chat mode
    setChatMode('friend');
    setActiveFriendId(friendId);
    setShowFriendsSheet(false);
    setState('CHATTING'); // Show chat UI
    setChatMessages([]); // Clear random chat messages
    
    // Load friend messages
    socket.emit('get-friend-messages', { friendId });
    
    // Mark messages as read after a short delay
    setTimeout(() => {
      socket.emit('mark-messages-read', { friendId });
    }, 1000);
  };

  // Handler for exiting friend chat
  const exitFriendChat = () => {
    console.log('Exiting friend chat');
    
    setChatMode('random');
    setActiveFriendId(null);
    setActiveFriendInfo(null);
    setChatMessages([]);
    setState('PREFERENCES');
    
    socket.emit('exit-friend-chat');
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
    const [touchStart, setTouchStart] = useState(0);

    const handleLogout = () => {
      if (window.confirm('Are you sure you want to logout?')) {
        // Clear user context
        localStorage.removeItem('user');
        window.location.href = '/auth'; // Force redirect to auth
      }
    };

    const handleTouchStart = (e) => {
      setTouchStart(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const diff = touchY - touchStart;
      
      // If swiped down more than 50px, close sheet
      if (diff > 50) {
        setShowSettings(false);
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-600 rounded-full" />
          </div>
          
          {/* Settings Content */}
          <div className="px-6 pb-6 space-y-4">
            <h2 className="text-white text-xl font-semibold">Settings</h2>
            
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
      
      {/* Connection status indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`w-3 h-3 rounded-full ${
          isConnected 
            ? 'bg-green-500' 
            : isReconnecting 
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
        }`}></div>
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
          onCancel={() => {
            cancelSearch(); // Notify backend
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
          handleTouchStartForBlock={handleTouchStartForBlock}
          handleTouchEndForBlock={handleTouchEndForBlock}
          isLongPressing={isLongPressing}
          handleUsernamePress={handleUsernamePress}
          handleUsernameRelease={handleUsernameRelease}
          handleContextMenu={handleContextMenu}
          addedFriends={addedFriends}
          _partner={_partner}
          chatMode={chatMode}
          activeFriendInfo={activeFriendInfo}
          socket={socket}
          activeFriendId={activeFriendId}
          onSkip={chatMode === 'friend' ? exitFriendChat : () => {
            sendSkip();
            setState('PREFERENCES');
            setPreferences(null);
            setPartner(null);
            setPartnerUsername(null); // Clear partner username
            setChatMessages([]);
            setSearchPhase('interests'); // Reset phase
          }}
          onSendMessage={(message) => {
            const messageText = message.text.trim();
            if (!messageText) return;
            
            if (chatMode === 'friend') {
              // Friend chat message
              socket.emit('friend-message', {
                friendId: activeFriendId,
                message: messageText
              });
            } else {
              // Random chat message
              const outgoingMessage = {
                text: messageText,
                timestamp: Date.now(),
                from: user?.username,
                isMine: true
              };
              
              // Optimistically add to UI
              setChatMessages(prev => [...prev, outgoingMessage]);
              
              // Check if we can send directly or need to queue
              if (canSendDirectly()) {
                socketSendMessage({ text: messageText });
              } else {
                // Queue the message
                queueMessage({ text: messageText });
                
                // Show offline toast
                if (!navigator.onLine) {
                  setToastMessage('You\'re offline - messages will send when reconnected');
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
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
        socket={socket}
        onStartChat={startFriendChat}
      />
    </div>
  );
}

export default MainPage;
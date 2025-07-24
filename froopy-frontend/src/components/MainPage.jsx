import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import socket, { findMatch, cancelSearch, sendMessage as socketSendMessage, sendSkip, onReconnecting, onReconnected, onReconnectError, startTyping, stopTyping, onPartnerTypingStart, onPartnerTypingStop } from '../services/socket';

// View components
function PreferencesView({ onPreferenceSelect }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4">
      <h2 className="text-2xl mb-8">I want to chat with</h2>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button 
          onClick={() => onPreferenceSelect('male')}
          className="bg-white/10 p-4 rounded-full hover:bg-white/20 transition-colors"
        >
          Male
        </button>
        <button 
          onClick={() => onPreferenceSelect('female')}
          className="bg-white/10 p-4 rounded-full hover:bg-white/20 transition-colors"
        >
          Female
        </button>
        <button 
          onClick={() => onPreferenceSelect('both')}
          className="bg-royal-blue p-4 rounded-full hover:bg-blue-600 transition-colors"
        >
          Both
        </button>
      </div>
    </div>
  );
}

function SearchingView({ onCancel }) {
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
        <h2 className="text-2xl font-semibold text-white mb-8">
          Searching... ({formatTime(elapsedTime)})
        </h2>
        
        {/* Simple loading animation */}
        <div className="flex gap-2 justify-center mb-8">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
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

function ChattingView({ messages, onSkip, onSendMessage, isPartnerTyping }) {
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
      
      {/* Chat header with skip button */}
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <span className="text-white">Anonymous</span>
        <button 
          onClick={handleSkip}
          disabled={isSkipping}
          className="bg-tangerine px-6 py-2 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSkipping ? 'Skipping...' : 'Skip'}
        </button>
      </div>

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
            {messages.map((msg, i) => (
              <div key={i} className={`mb-4 ${msg.isMine ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-xs ${msg.isMine ? 'text-right' : 'text-left'}`}>
                  <span className={`block p-3 rounded-2xl break-words ${
                    msg.isMine 
                      ? msg.pending 
                        ? 'bg-royal-blue/50 text-white/70' 
                        : 'bg-royal-blue text-white'
                      : 'bg-white/10 text-white'
                  }`}>
                    {msg.text}
                  </span>
                  <span className="text-xs text-white/40 mt-1 px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}
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
        />
      </div>
    </div>
  );
}

function MainPage() {
  const [state, setState] = useState('PREFERENCES');
  const [_preferences, setPreferences] = useState(null);
  const [_partner, setPartner] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [messageQueue, setMessageQueue] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const { user } = useUser();
  const navigate = useNavigate();
  
  const MAX_RECONNECTION_ATTEMPTS = 5;

  // Auth validation
  useEffect(() => {
    if (!user || !user.email || !user.gender) {
      console.log('No authenticated user found, redirecting to auth');
      navigate('/auth');
      return;
    }
  }, [user, navigate]);
  
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
      setToastMessage('Connection lost');
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
  }, [messageQueue, reconnectionAttempts]);
  
  // Listen for match found event
  useEffect(() => {
    const handleMatchFound = (data) => {
      console.log('Match found!', data);
      setPartner(data.partnerId);
      setState('CHATTING');
    };
    
    socket.on('match-found', handleMatchFound);
    
    return () => {
      socket.off('match-found', handleMatchFound);
    };
  }, []);

  // Add message listener
  useEffect(() => {
    const handleMessage = (message) => {
      console.log('Received message:', message);
      setChatMessages(prev => [...prev, { ...message, isMine: false }]);
    };
    
    const handlePartnerSkipped = () => {
      console.log('Partner skipped');
      alert('Your partner left the chat');
      setState('PREFERENCES');
      setPreferences(null);
      setPartner(null);
      setChatMessages([]);
    };
    
    const handlePartnerDisconnected = () => {
      console.log('Partner disconnected');
      alert('Your partner disconnected');
      setState('PREFERENCES');
      setPreferences(null);
      setPartner(null);
      setChatMessages([]);
    };
    
    socket.on('message', handleMessage);
    socket.on('partner-skipped', handlePartnerSkipped);
    socket.on('partner-disconnected', handlePartnerDisconnected);
    
    return () => {
      socket.off('message', handleMessage);
      socket.off('partner-skipped', handlePartnerSkipped);
      socket.off('partner-disconnected', handlePartnerDisconnected);
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
  
  const handlePreferenceSelect = (preference) => {
    // console.log('Selected preference:', preference); // Dev log - cleaned up
    setPreferences(preference);
    setState('SEARCHING');
    
    // Start real matching - use test data when user not available
    findMatch({
      userGender: user?.gender || 'male',
      lookingFor: preference
    });
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
    <div className="min-h-screen bg-dark-navy text-white relative">
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
      
      {state === 'PREFERENCES' && <PreferencesView onPreferenceSelect={handlePreferenceSelect} />}
      {state === 'SEARCHING' && (
        <SearchingView 
          onCancel={() => {
            cancelSearch(); // Notify backend
            setState('PREFERENCES');
            setPreferences(null);
          }}
        />
      )}
      {state === 'CHATTING' && (
        <ChattingView 
          messages={chatMessages}
          isPartnerTyping={isPartnerTyping}
          onSkip={() => {
            sendSkip();
            setState('PREFERENCES');
            setPreferences(null);
            setPartner(null);
            setChatMessages([]);
          }}
          onSendMessage={(message) => {
            try {
              if (isConnected) {
                // Normal send
                setChatMessages(prev => [...prev, { ...message, isMine: true }]);
                socketSendMessage(message);
              } else {
                // Queue the message
                setChatMessages(prev => [...prev, { 
                  ...message, 
                  isMine: true, 
                  pending: true 
                }]);
                setMessageQueue(prev => [...prev, message]);
                setToastMessage('Message queued - will send when reconnected');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
              }
            } catch (error) {
              console.error('Error sending message:', error);
              setToastMessage('Failed to send message. Please try again.');
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            }
          }}
        />
      )}
    </div>
  );
}

export default MainPage;
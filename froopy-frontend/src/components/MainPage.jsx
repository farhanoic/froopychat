import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import socket, { findMatch, cancelSearch, sendMessage as socketSendMessage, sendSkip } from '../services/socket';

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
  // Remove the useEffect with setTimeout - using real socket matching now
  
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4">
      <div className="text-center">
        <h2 className="text-2xl mb-4">Finding someone...</h2>
        
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

function ChattingView({ messages, onSkip, onSendMessage }) {
  const [input, setInput] = useState('');
  const [isSkipping, setIsSkipping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when entering chat
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Format timestamp helper
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const sendMessage = () => {
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
    setIsSkipping(true);
    onSkip();
  };

  return (
    <div className="flex flex-col h-screen bg-dark-navy" style={{ height: '100dvh' }}>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
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
                    msg.isMine ? 'bg-royal-blue text-white' : 'bg-white/10 text-white'
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
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
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
  const [chatMessages, setChatMessages] = useState([]);
  const { user } = useUser();
  const navigate = useNavigate();

  // Auth validation - redirect to auth if no user (moved before other effects)
  useEffect(() => {
    if (!user || !user.email || !user.gender) {
      console.log('No authenticated user found, redirecting to auth');
      navigate('/auth');
      return;
    }
  }, [user, navigate]);
  
  // Listen for connection status changes
  useEffect(() => {
    console.log('MainPage mounted, socket:', socket.connected);
    
    const handleConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    return () => {
      console.log('MainPage unmounting');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);
  
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
  
  const handlePreferenceSelect = (preference) => {
    console.log('Selected preference:', preference);
    setPreferences(preference);
    setState('SEARCHING');
    
    // Start real matching
    findMatch({
      userGender: user?.gender,
      lookingFor: preference
    });
  };
  
  const _handleMatchFound = useCallback(() => {
    console.log('Match found!');
    setState('CHATTING');
  }, []);
  
  // Don't render if user is not authenticated - check after all hooks
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
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      </div>
      
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
          onSkip={() => {
            sendSkip();
            setState('PREFERENCES');
            setPreferences(null);
            setPartner(null);
            setChatMessages([]);
          }}
          onSendMessage={(message) => {
            setChatMessages(prev => [...prev, { ...message, isMine: true }]);
            socketSendMessage(message);
          }}
        />
      )}
    </div>
  );
}

export default MainPage;
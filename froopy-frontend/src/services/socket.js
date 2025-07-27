import { io } from 'socket.io-client';

// Offline message queue system
let messageQueue = [];
let isOnline = navigator.onLine;
let queueFlushInProgress = false;

// Export queue for debugging
export const getMessageQueue = () => [...messageQueue];
export const getOnlineStatus = () => isOnline;

// Create socket instance with environment-based URL and aggressive reconnection options
const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
  // Match backend transport order - polling first for better reliability
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,        // Faster initial retry
  reconnectionDelayMax: 2000,    // Shorter max delay for faster recovery
  timeout: 10000,               // Shorter timeout for faster failure detection
  // Add connection timeout for faster failure detection
  connectTimeout: 20000,        // Reduced from 45s
  // Add upgrade timeout 
  upgradeTimeout: 10000,        // Reduced from 30s
  // Force new connection on reconnect
  forceNew: false,
  // Additional resilience options
  randomizationFactor: 0.2
});

// Online/offline detection
window.addEventListener('online', () => {
  console.log('[Socket] Network online detected');
  isOnline = true;
  
  // Only flush queue if we have a socket connection
  if (socket.connected && messageQueue.length > 0) {
    flushMessageQueue();
  }
});

window.addEventListener('offline', () => {
  console.log('[Socket] Network offline detected');
  isOnline = false;
});

// Debug connection
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
  isOnline = true;
  
  // Authenticate immediately if user is logged in
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.email) {
        console.log('Auto-authenticating socket for user:', user.email);
        socket.emit('authenticate', {
          email: user.email
        });
      }
    } catch (error) {
      console.error('Error parsing user data for authentication:', error);
    }
  }
  
  // Flush any pending messages
  if (messageQueue.length > 0) {
    flushMessageQueue();
  }
  
  // Retry match request if we were searching when disconnected
  setTimeout(() => {
    retryMatch();
  }, 1000); // Small delay to ensure authentication completes
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected. Reason:', reason);
  // Log the disconnect reason for debugging
  if (reason === 'io server disconnect') {
    console.warn('Server forcibly disconnected. Manual reconnection needed.');
  } else if (reason === 'transport close') {
    console.warn('Connection lost. Auto-reconnecting...');
  }
  // Don't set isOnline = false here, as we might still have network
});

// Add connection error debugging
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', {
    message: error.message,
    description: error.description,
    context: error.context,
    type: error.type
  });
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Socket reconnection attempt #${attemptNumber}`);
});

socket.on('reconnect_failed', () => {
  console.error('Socket reconnection failed after all attempts');
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Socket reconnected successfully after ${attemptNumber} attempts`);
});

// Authentication event handlers
socket.on('authenticated', (data) => {
  console.log('Socket authenticated successfully:', data);
});

socket.on('auth-error', (error) => {
  console.error('Socket authentication failed:', error);
});

// Match-related functions with automatic retry
let lastMatchPreferences = null;
let matchRetryCount = 0;
const MAX_MATCH_RETRIES = 3;

export const findMatch = (preferences) => {
  console.log('Emitting find-match with:', preferences);
  lastMatchPreferences = preferences;
  matchRetryCount = 0;
  
  if (socket.connected) {
    socket.emit('find-match', preferences);
  } else {
    console.log('Socket not connected, will retry when connected');
    // Connection will trigger retry in the connect handler
  }
};

// Retry match request after reconnection
const retryMatch = () => {
  if (lastMatchPreferences && matchRetryCount < MAX_MATCH_RETRIES) {
    matchRetryCount++;
    console.log(`Retrying match request (attempt ${matchRetryCount})`);
    socket.emit('find-match', lastMatchPreferences);
  }
};

export const cancelSearch = () => {
  console.log('Cancelling search');
  lastMatchPreferences = null; // Clear retry preferences
  matchRetryCount = 0;
  socket.emit('cancel-search');
};

// Message-related functions
export const sendMessage = (message) => {
  console.log('Emitting message:', message);
  socket.emit('message', message);
};

export const sendSkip = () => {
  console.log('Emitting skip');
  socket.emit('skip');
};

// Reconnection event handlers
export const onReconnecting = (callback) => {
  socket.io.on('reconnect_attempt', callback);
};

export const onReconnected = (callback) => {
  socket.io.on('reconnect', callback);
};

export const onReconnectError = (callback) => {
  socket.io.on('reconnect_error', callback);
};

// Typing event functions
export const startTyping = () => {
  // console.log('Emitting typing-start event'); // Dev log - cleaned up for production
  socket.emit('typing-start');
};

export const stopTyping = () => {
  // console.log('Emitting typing-stop event'); // Dev log - cleaned up for production
  socket.emit('typing-stop');
};

export const onPartnerTypingStart = (callback) => {
  socket.on('partner-typing-start', callback);
};

export const onPartnerTypingStop = (callback) => {
  socket.on('partner-typing-stop', callback);
};

// Add message to queue
export const queueMessage = (messageData) => {
  messageQueue.push({
    ...messageData,
    queuedAt: Date.now(),
    id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  });
  console.log('[Socket] Message queued:', messageData);
  return messageQueue[messageQueue.length - 1];
};

// Flush all queued messages
const flushMessageQueue = async () => {
  if (queueFlushInProgress || messageQueue.length === 0) {
    return;
  }
  
  console.log(`[Socket] Flushing ${messageQueue.length} queued messages`);
  queueFlushInProgress = true;
  
  // Copy queue and clear it
  const messagesToSend = [...messageQueue];
  messageQueue = [];
  
  // Send each message with a small delay to avoid overwhelming
  for (const msg of messagesToSend) {
    if (socket.connected) {
      socket.emit('message', { text: msg.text });
      console.log('[Socket] Sent queued message:', msg.text);
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      // If disconnected again, re-queue the remaining messages
      messageQueue.unshift(...messagesToSend.slice(messagesToSend.indexOf(msg)));
      break;
    }
  }
  
  queueFlushInProgress = false;
};

// Check if we should queue or send directly
export const canSendDirectly = () => isOnline && socket.connected;

// Manual authentication function (called when user logs in)
export const authenticateSocket = (userData) => {
  if (socket.connected && userData?.email) {
    console.log('Manually authenticating socket for user:', userData.email);
    socket.emit('authenticate', {
      email: userData.email
    });
    
    // Store in localStorage for auto-authentication on reconnect
    localStorage.setItem('user', JSON.stringify(userData));
  }
};

// Export socket for event listeners
export default socket;